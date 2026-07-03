---
title: Two-factor authentication
sidebar_position: 3
---

Twake supports TOTP-based 2FA. Enabling it sets a flag in LDAP and binds a recovery email; the actual TOTP secret and verification at login time are owned by LemonLDAP::NG. Registration is the management UI; LemonLDAP is the authority during login.

## Where state lives

| Attribute (LDAP)   | Set by                             | Meaning                                                                                     |
| ------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------- |
| `twoFactorEnabled` | Registration on enable / disable   | `'1'` if 2FA is on, absent if off                                                           |
| `recoveryEmail`    | Registration on enable + on change | Email used for the enable OTP and for recovery flows                                        |
| TOTP secret        | LemonLDAP                          | Written by LemonLDAP into LDAP directly — Registration never reads or writes this attribute |

The TOTP secret never passes through Registration. Registration only flips its own boolean and tracks the recovery email; LemonLDAP handles enrolment and verification, and stores the secret on its own LDAP attribute.

## Enable

Routed under `/configure-2fa` (protected — user must already be logged in).

1. **Password re-prompt** if no recovery email is set yet (`initConfigure2faPasswordAction`).
2. **Recovery email submitted** (`submitConfigure2faEmailAction`) — Registration sends an OTP to that email.
3. **OTP verified** (`checkConfigure2faOTPAction`) → `userService.enable2FA(user, recoveryEmail)`:
   - Writes `twoFactorEnabled: '1'` and `recoveryEmail: <email>` via LDAP REST.
   - `POST /api/user/2fa` publishes `user.2fa.updated` only. The recovery email is written to LDAP but Registration does not emit a separate `user.recovery-email.updated` event from the enable path.
4. The user is then prompted (UI-side) to scan a QR code and confirm the first TOTP code **with LemonLDAP** — that step is outside Registration.

If the user already has a recovery email, step 1 is skipped: `sendConfigure2faOTPAction` sends the OTP directly to the existing recovery address.

## Use during login

The login-side handshake (Registration handles the password, LemonLDAP handles the TOTP, and the two are verified at different moments) is documented in [SSO & OIDC Proxy → Two-Factor Authentication](../overview/sso.md#two-factor-authentication). The split exists because Registration owns the PBKDF2/Scrypt pipeline; LemonLDAP doesn't see the plaintext password and Registration doesn't see the TOTP secret.

## Disable

`DELETE /api/user/2fa` (authenticated):

- Sets `twoFactorEnabled: null` (deletes the attribute) via LDAP REST.
- Publishes `user.2fa.updated` with `twoFactorEnabled: false` in the payload.

Registration does not re-prompt for the password or the current TOTP code at the API level. The UI may add a confirmation step. Once the LDAP attribute is gone, LemonLDAP no longer challenges for 2FA on the next login.

## Update recovery email

`PUT /api/user/2fa` (authenticated, body `{ email }`):

- Writes the new `recoveryEmail` to LDAP via `userService.update2FA` and publishes `user.recovery-email.updated`.
- The endpoint itself does not send or verify an OTP for the new email. If an OTP-confirmation step is required, it is handled at the UI/form layer before this endpoint is called.

## Recovery codes

Not implemented in Registration. The recovery email is the recovery mechanism — losing the TOTP device means using the recovery email to disable 2FA, then re-enrolling. There is no "8 backup codes" flow.

## RabbitMQ events

| Event                         | Routing key                                                                             | When                                      |
| ----------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------- |
| `user.2fa.updated`            | `RABBITMQ_AUTH_ROUTING_KEY_USER_2FA_UPDATED` (`user.2fa.updated`)                       | 2FA enabled or disabled                   |
| `user.recovery-email.updated` | `RABBITMQ_AUTH_ROUTING_KEY_USER_RECOVERY_EMAIL_UPDATED` (`user.recovery-email.updated`) | Recovery email changed (enable or update) |

Both publish on the `auth` exchange (`RABBITMQ_AUTH_EXCHANGE`). Consumers update local caches; no app behaviour changes downstream.
