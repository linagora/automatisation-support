---
title: B2C
sidebar_position: 1
---

B2C is the self-service track on `twake.app`: a single user signs themselves up, manages their own credentials, and can self-delete. The same Registration service handles B2B onboarding — see [B2B](../b2b/) — but B2C and B2B differ in who initiates each operation, where users live in LDAP, and which events fire.

This section covers the B2C-specific flows that aren't already in [Concepts](../overview/) or in the in-repo flow docs.

## B2C scope

| Operation                        | Where it lives                                                              |
| -------------------------------- | --------------------------------------------------------------------------- |
| Signup                           | [Account Creation — B2C section](https://github.com/linagora/twake-workplace-private/blob/main/registration/docs/account-creation.md#1-b2c-signup) |
| Login (PBKDF2 + Scrypt + LLNG)   | [SSO & OIDC Proxy](../overview/sso.md)                                      |
| Account recovery (forgot password)| [Account recovery](./account-recovery.md)                                  |
| Two-factor authentication        | [Two-factor authentication](./two-factor-auth.md)                           |
| Multi-account login (phone or recovery email) | [Account recovery — Multi-account](./account-recovery.md#multi-account-login) |
| Account self-deletion            | [Account deletion](./account-deletion.md)                                   |
| Password change (logged in)      | [`registration/src/routes/(protected)/change-password/`](https://github.com/linagora/twake-workplace-private/tree/main/registration/src/routes/(protected)/change-password) — same hashing pipeline as recovery |
| Phone change                     | [`registration/src/routes/(protected)/change-phone/`](https://github.com/linagora/twake-workplace-private/tree/main/registration/src/routes/(protected)/change-phone) — OTP-verified |
| Recovery email change            | [`registration/src/routes/(protected)/change-recovery-email/`](https://github.com/linagora/twake-workplace-private/tree/main/registration/src/routes/(protected)/change-recovery-email) |

## What differs from B2B

| Dimension                 | B2C                                                       | B2B                                                       |
| ------------------------- | --------------------------------------------------------- | --------------------------------------------------------- |
| Signup actor              | The user themselves                                       | An org admin (creates the LDAP entry, then sends an invite) |
| LDAP location             | `ou=users,dc=twake,dc=app`                                | `ou=users,ou=<domain>,ou=b2b,dc=twake,dc=app`             |
| Account deletion          | User-initiated (DELETE `/api/delete-user`)                | Admin-initiated; cascading per-user `user.deleted` events  |
| `user.created` event      | Always emitted on `auth` exchange after Cloudery succeeds | Emitted on invitation completion (members) or on owner provisioning |
| Cozy app set on creation  | Default offer (`CLOUDERY_OFFER`)                          | B2B offer with org context (`CLOUDERY_B2B_OFFER`); admin app installed for owners/admins |

## Cross-refs

- Authentication primer: [Authentication](../overview/authentication.md)
- OIDC pipeline: [SSO & OIDC Proxy](../overview/sso.md)
- Anti-abuse stack (captcha, rate limits, fraud guard, CrowdSec): [`registration/docs/anti-abuse.md`](https://github.com/linagora/twake-workplace-private/blob/main/registration/docs/anti-abuse.md)
- LDAP layout: [LDAP Structure](../overview/ldap-structure.md)
