---
title: LDAP Structure
---

:::tip
For the complete data model and uniqueness rules, see [LDAP REST Architecture](https://github.com/linagora/twake-workplace-private/tree/main/twake-ldap-rest/docs/architecture) on GitHub.
:::

The plugin manages three branches of the LDAP directory tree, following the ADR 024 v2 specification.

## Overview

```
dc=twake,dc=app
|
+-- ou=users                              # B2C individual accounts
|   +-- uid=johndoe
|   +-- uid=janedoe
|
+-- ou=b2b                                # B2B organizations
|   +-- ou=acme.example.com               # One org
|   |   +-- ou=users
|   |   |   +-- uid=john.doe
|   |   |   +-- uid=jane.smith
|   |   +-- ou=groups
|   |       +-- cn=engineering
|   |       +-- cn=sales
|   +-- ou=other.com                      # Another org
|       +-- ou=users
|       +-- ou=groups
|
+-- ou=appAccounts                        # Per-device app passwords
    +-- uid=johndoe@example.com           # Principal entry (one userPassword per device)
    +-- uid=johndoe_c04729183             # One device
    +-- uid=johndoe_c09812345             # Another device
```

## B2C Users

Individual user accounts stored directly under `ou=users`.

```
uid=johndoe,ou=users,dc=twake,dc=app
  objectClass: inetOrgPerson, twakeAccount, twakeWhitePages
  cn: John Doe
  sn: Doe
  givenName: John
  mail: johndoe@example.com
  mobile: +33612345678
  twakeAccountStatus: active
  twakeEmails: [{"address":"johndoe@example.com","type":"work"}]
  twakePhones: [{"number":"+33612345678","type":"cell"}]
  twakeAddresses: [...]
  twakeImpp: [...]
```

## B2B Organizations

Each organization is an `organizationalUnit` with custom `twakeOrganization` attributes.

```
ou=acme.example.com,ou=b2b,dc=twake,dc=app
  objectClass: organizationalUnit, top, twakeOrganization
  ou: acme.example.com
  description: Acme Corporation
  twakeDomain: acme.example.com
  twakeOrgStatus: active
  twakeCreatedAt: 2025-01-23T10:00:00Z
  twakeOrgMetadata: {"plan":"enterprise"}
  twakeOrganizationOwner: uid=john.doe,ou=users,ou=acme.example.com,ou=b2b,dc=twake,dc=app
```

The `twakeOrganizationOwner` references the **B2B user DN** (not the B2C user), since a user can exist in both branches.

## B2B Users

Users within an organization, stored under `ou=users` of the org.

```
uid=john.doe,ou=users,ou=acme.example.com,ou=b2b,dc=twake,dc=app
  objectClass: inetOrgPerson, twakeAccount, twakeWhitePages
  twakeOrganizationRole: owner
  twakeAccountStatus: active
  cn: John Doe
  mail: john.doe@acme.example.com
  ...
```

The `twakeOrganizationRole` attribute stores the user's role: `owner`, `admin`, `moderator`, or `member`.

## B2B Groups

Groups use standard `groupOfNames` with member DNs pointing to B2B users.

```
cn=engineering,ou=groups,ou=acme.example.com,ou=b2b,dc=twake,dc=app
  objectClass: groupOfNames, top
  cn: engineering
  description: Engineering team
  member: uid=john.doe,ou=users,ou=acme.example.com,ou=b2b,dc=twake,dc=app
  member: uid=jane.smith,ou=users,ou=acme.example.com,ou=b2b,dc=twake,dc=app
```

## Applicative Accounts

Applicative (app) accounts are what let a user connect external clients that speak password-based protocols: a mail client over IMAP and SMTP (Thunderbird, Outlook, the iOS or Android mail app), a calendar over CalDAV, or a contacts app over CardDAV. Instead of putting the primary password into each client, the user creates a dedicated per-device credential for it. Each one is revocable on its own, so losing a device or removing an app never forces a primary password reset.

**Why a separate account instead of the user's own?** The primary password is hashed on the client during signup, so the value stored on the user entry is a derivation the directory cannot verify on a simple bind (see [LDAP Password Policy](./ldap-password-policy)). Mail, calendar, and contacts servers authenticate by binding with the password the client sends, so they have no way to check a user against that primary credential. App account passwords are instead generated server-side and hashed by the directory, so a normal bind can verify them, which is exactly what IMAP, SMTP, CalDAV, and CardDAV need.

They live in their own flat branch under `ou=appAccounts`, separate from the user tree. Two kinds of entry exist:

- A **principal entry** (`uid=<mail>`) that mirrors the user and holds **every** device password, so single-point authentication keeps working against any device credential.
- One **device entry** per device (`uid=<username>_c<8 digits>`), each carrying a single credential and an optional `description` label.

```
uid=johndoe@example.com,ou=appAccounts,dc=twake,dc=app   # principal: one userPassword per device
  objectClass: inetOrgPerson
  uid: johndoe@example.com
  mail: johndoe@example.com
  cn: John Doe
  sn: Doe
  userPassword: {SSHA}...        # credential for device 1
  userPassword: {SSHA}...        # credential for device 2

uid=johndoe_c04729183,ou=appAccounts,dc=twake,dc=app     # one device
  objectClass: inetOrgPerson
  uid: johndoe_c04729183
  mail: johndoe@example.com
  description: Work laptop
  userPassword: {SSHA}...
```

The principal entry holds one `userPassword` value per device, so several passwords coexist on a single entry, added one at a time. See [LDAP Password Policy](./ldap-password-policy) for how the directory allows multiple password values and hashes them.

Two plugins keep the branch consistent:

- **`appAccountsConsistency`** syncs the principal entry from user change hooks: it creates `uid=<mail>` when a mail is set, renames it when the mail changes, and removes all of a user's app accounts when the user is deleted. The principal copies the user's attributes minus operational and end-to-end encryption key material, so `userPassword` and key attributes are not duplicated from the user entry.
- **`appAccountsApi`** exposes the HMAC endpoints to list, create, and delete device accounts. Creating one generates the `uid` and a one-time password and adds that password to the principal entry.

For the full API and lifecycle, see [Applicative Accounts](https://github.com/linagora/twake-workplace-private/tree/main/twake-ldap-rest/docs/api/app-accounts.md) on GitHub.

## Custom LDAP Schema

The plugin requires custom object classes and attributes. See the [full OpenLDAP Schema LDIF](../b2b-deployment/openldap-schema) for the complete installable schema definition.

### Required Attributes

**Organization (`twakeOrganization`):**

| Attribute                | Type   | Description                 |
| ------------------------ | ------ | --------------------------- |
| `twakeDomain`            | String | Organization's domain       |
| `twakeOrgStatus`         | String | `active` or `suspended`     |
| `twakeCreatedAt`         | String | ISO 8601 creation timestamp |
| `twakeOrgMetadata`       | String | JSON-encoded metadata       |
| `twakeOrganizationOwner` | DN     | DN of the owner's B2B user  |

**User (`twakeAccount`):**

| Attribute               | Type   | Description                             |
| ----------------------- | ------ | --------------------------------------- |
| `twakeOrganizationRole` | String | `owner`, `admin`, `moderator`, `member` |
| `twakeAccountStatus`    | String | `active` or `disabled`                  |

**User (`twakeWhitePages`):**

| Attribute             | Type   | Description                   |
| --------------------- | ------ | ----------------------------- |
| `twakeEmails`         | String | JSON array of email objects   |
| `twakePhones`         | String | JSON array of phone objects   |
| `twakeAddresses`      | String | JSON array of address objects |
| `twakeImpp`           | String | JSON array of IMPP objects    |
| `twakeAdditionalName` | String | Middle / additional name      |
| `twakeNamePrefix`     | String | Name prefix (Mr., Mrs., etc.) |

### Installing the Schema

```bash
# Copy schema file
sudo cp ldap/schema/twake.schema /etc/ldap/schema/

# Add to cn=config (recommended)
ldapadd -Y EXTERNAL -H ldapi:/// -f ldap/schema/twake.ldif
```
