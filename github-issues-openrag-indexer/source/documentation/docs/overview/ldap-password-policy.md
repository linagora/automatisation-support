---
title: LDAP Password Policy
---

How OpenLDAP enforces password rules, how passwords are hashed at rest, and how a single account can safely hold several passwords (one per device or application). Examples use `dc=example,dc=com` as a placeholder base.

:::tip
For the directory layout and data model, see [LDAP Structure](./ldap-structure).
:::

## The ppolicy overlay

Password policy in OpenLDAP is provided by the `ppolicy` overlay. It is not enabled by default: the module must be loaded and the overlay attached to a database. Once active, it governs how the password attribute (`userPassword`) may be written, optionally hashes incoming passwords, and tracks state such as failure counts and password history.

A policy is described by a `pwdPolicy` entry. The overlay points at a default policy through `olcPPolicyDefault`, and individual entries can override it with a `pwdPolicySubentry` attribute.

### What a policy controls

| Attribute             | Meaning                                                            |
| --------------------- | ----------------------------------------------------------------- |
| `pwdAttribute`        | The attribute governed by the policy (almost always `userPassword`) |
| `pwdMinLength`        | Minimum password length                                           |
| `pwdCheckQuality`     | `0` no check, `1` check when possible, `2` always require a check |
| `pwdInHistory`        | How many previous passwords are remembered and refused on reuse   |
| `pwdMaxAge`           | Seconds before a password expires (`0` means never)               |
| `pwdLockout`          | Whether repeated failures can lock the account                    |
| `pwdMaxFailure`       | Number of failed binds before lockout                             |
| `pwdLockoutDuration`  | Seconds an account stays locked (`0` means until an admin unlocks) |
| `pwdMustChange`       | Force a password change after an administrative reset             |
| `pwdGraceAuthNLimit`  | Allowed logins after expiry before the password is unusable       |

:::warning
`pwdLockout: TRUE` does nothing on its own. Without `pwdMaxFailure`, the overlay never counts failures, so accounts are never actually locked. Set both together if you want brute force protection at the directory level.
:::

## Configuring the overlay

The schema for `pwdPolicy` ships with OpenLDAP. Enabling the policy takes three steps: load the module, attach the overlay, then create the policy entry.

### 1. Load the module

```ldif
dn: cn=module{0},cn=config
changetype: modify
add: olcModuleLoad
olcModuleLoad: ppolicy.so
```

### 2. Attach the overlay to the database

```ldif
dn: olcOverlay=ppolicy,olcDatabase={1}mdb,cn=config
objectClass: olcOverlayConfig
objectClass: olcPPolicyConfig
olcOverlay: ppolicy
olcPPolicyDefault: cn=defaultPasswordPolicy,ou=policies,dc=example,dc=com
olcPPolicyHashCleartext: TRUE
olcPPolicyUseLockout: TRUE
```

Apply config changes over the local administrative socket:

```bash
ldapmodify -Y EXTERNAL -H ldapi:/// -f ppolicy-overlay.ldif
```

### 3. Create the default policy entry

```ldif
dn: ou=policies,dc=example,dc=com
objectClass: organizationalUnit
ou: policies

dn: cn=defaultPasswordPolicy,ou=policies,dc=example,dc=com
objectClass: top
objectClass: device
objectClass: pwdPolicyChecker
objectClass: pwdPolicy
cn: defaultPasswordPolicy
pwdAttribute: userPassword
pwdInHistory: 3
pwdMinLength: 8
pwdCheckQuality: 0
pwdLockout: TRUE
pwdMaxFailure: 5
pwdLockoutDuration: 300
```

This entry lives in the data tree and is added as the directory administrator, not over the configuration socket.

## How passwords are stored

A stored `userPassword` value is either a hash with a recognized scheme prefix, or an opaque value with no prefix.

| Stored value          | What it means                                                       |
| --------------------- | ------------------------------------------------------------------ |
| `{SSHA}...`           | Salted SHA-1, hashed by the directory. Verifiable by a simple bind |
| `{ARGON2}...`         | Argon2, if the argon2 module is loaded and selected                |
| no `{scheme}` prefix  | Stored verbatim. The directory treats it as opaque                 |

### Hashing on write

When `olcPPolicyHashCleartext` is `TRUE`, the overlay hashes any value it considers cleartext at write time, using the directory default scheme. That default is `{SSHA}` unless `olcPasswordHash` is set to something stronger.

Two consequences follow from how prefixes are handled:

- A value that already carries a `{scheme}` prefix is stored as is. The directory never double hashes it.
- A value with no recognized prefix is treated as cleartext. With hashing on it becomes `{SSHA}`; with hashing off it is written verbatim, and because the directory cannot interpret it, a simple bind cannot verify it. In that case authentication has to be performed by the application that wrote the value.

:::note
`{SSHA}` is salted SHA-1: fast and not memory hard. If the directory is the authority for password verification, prefer a memory hard scheme by loading the argon2 module and setting `olcPasswordHash: {ARGON2}`. A separate application side hash (for example PBKDF2 or scrypt computed before the value reaches the directory) provides strength independently of the directory scheme.
:::

## Multiple passwords on one account

The policy proposal that `ppolicy` implements assumes a single password per entry, and the overlay enforces that **per write operation**: a single modify that tries to set more than one `userPassword` value is rejected with:

```
Password policy only allows one password value
```

What it does **not** do is cap the total number of values already present. Passwords added one at a time, in separate operations, accumulate on the same entry. This is what makes per device and per application passwords possible: a principal account can hold one `userPassword` per device, each added individually and each revocable on its own, while single point authentication keeps working against any of them.

```ldif
# Rejected: two values in one operation
dn: uid=principal,ou=appAccounts,dc=example,dc=com
changetype: modify
replace: userPassword
userPassword: first-secret
userPassword: second-secret
```

```ldif
# Accepted: one value per operation, repeated
dn: uid=principal,ou=appAccounts,dc=example,dc=com
changetype: modify
add: userPassword
userPassword: another-device-secret
```

To rehash a value that was stored without a scheme (for example after turning hashing on), delete that single value and add it back in the same operation. The re-added value passes the one value per operation rule and is hashed on the way in.

## Version note: history and rapid writes

The password history feature (`pwdInHistory` greater than `0`) records each superseded password with a timestamp at one second resolution. On OpenLDAP 2.4, adding several passwords to the same entry within the same second can collide on that timestamp and fail with:

```
pwdHistory: value #0 already exists
```

This affects exactly the per device password pattern above when several credentials are created in quick succession. OpenLDAP 2.6 handles it correctly. If you rely on multiple passwords per account, prefer 2.6 or later. On 2.4 the workarounds are to set `pwdInHistory: 0` or to space the writes so they fall in different seconds.

## Decisions for Twake Workplace

Twake Workplace applies the concepts above with the following choices.

- **Passwords are derived before they reach the directory.** The registration flow runs a client side PBKDF2 pass and a server side scrypt pass, so the value written to `userPassword` is already a strong salted derivation rather than a raw password. Directory side hashing is kept enabled as a backstop, so any value that ever arrives without a scheme prefix is still hashed at rest instead of stored in the clear.

- **One password per device, not one per account.** Authentication to password based protocols (IMAP, SMTP, CalDAV, CardDAV) uses dedicated per device credentials held on a single principal entry, so several `userPassword` values coexist there. Each is added in its own write, respecting the one value per operation rule, and each can be revoked on its own without forcing a primary password reset.

- **OpenLDAP 2.6 or later is required.** Because the per device model writes several credentials to the same entry, sometimes in quick succession, the older history bookkeeping described in the version note is not acceptable. 2.6 handles those rapid writes correctly.

- **Password history is enabled** so a rotated or recovered credential cannot immediately reuse a recent value.

## Quick reference

| Symptom                                            | Likely cause                                                        |
| -------------------------------------------------- | ------------------------------------------------------------------- |
| `Password policy only allows one password value`   | A single operation carried more than one `userPassword` value       |
| `pwdHistory: value #0 already exists`              | Rapid multi password writes with history enabled on an older server |
| Passwords stored in cleartext                      | Hashing is off, or the value arrived with no `{scheme}` prefix      |
| Accounts never lock despite `pwdLockout: TRUE`     | `pwdMaxFailure` is not set                                          |
| Simple bind fails on a value the app can verify    | The value has no `{scheme}` prefix, so the directory cannot check it |
