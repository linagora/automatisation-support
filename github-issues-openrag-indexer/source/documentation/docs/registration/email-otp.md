---
title: Email OTP
sidebar_position: 2
pagination_next: null
pagination_prev: null
---

Phone OTPs are delegated to external providers (Twilio Verify, Octopush), which generate the code, deliver it, and own its lifecycle. **Email OTPs are different: Registration runs its own challenge system in-house** and only uses TMail as a transport. Twake owns the code, its storage, and its TTL; the mail gateway just delivers the message.

This backs every email-OTP flow: account recovery, 2FA enablement, and recovery-email verification.

## Challenge lifecycle

The challenge store is `emailOtpService` (`registration/src/lib/services/email-otp/`), backed by the PostgreSQL `email_otps` table (`src/db/email-otp.schema.ts`).

1. **Generate.** A 6-digit code is drawn from a CSPRNG (`crypto.randomInt`).
2. **Store as digests, never plaintext.** Both the email and the code are stored as HMAC-SHA256 digests keyed on the server `SECRET` (`hmacSha256`). The plaintext code lives only in the email that is sent; the plaintext email is never written to the table. A leak of the `email_otps` table reveals neither the recipient nor a usable code.
3. **Invalidate prior challenges.** Creating a new challenge for an email deletes that email's earlier unconsumed rows, so only the latest code is ever valid.
4. **Verify in constant time.** On submission, the candidate code is HMAC'd and compared with `timingSafeEqual` to avoid timing side-channels.

A challenge is single-use and time-bounded:

| Property     | Source                          | Default |
| ------------ | ------------------------------- | ------- |
| Code length  | `EMAIL_OTP_CODE_LENGTH` (fixed) | 6       |
| TTL          | `EMAIL_OTP_TTL_SECONDS`         | 600     |
| Max attempts | `EMAIL_OTP_MAX_ATTEMPTS`        | 3       |

`verify` returns `timeout` once the row is past `expiresAt` or has reached the attempt cap, and marks the row `consumedAt` on success so it cannot be replayed.

## Table shape

```text
email_otps
  id          uuid (pk)
  email_hash  HMAC-SHA256(email, SECRET)
  code_hash   HMAC-SHA256(code, SECRET)
  expires_at  timestamp
  attempts    int (default 0)
  consumed_at timestamp (null until verified)
  created_at  timestamp
```

The table is append-only per challenge; there is no plaintext PII to purge, and expired rows are safe to prune on a schedule.

## Delivery: the TMail private gateway

`TMailEmailProvider` (`src/lib/services/messaging/providers/tmail.ts`) is the transport. It submits the OTP email to the **cluster-internal TMail SMTP endpoint** over nodemailer and delegates all challenge storage and verification to `emailOtpService`.

SMTP auth is optional by design: when `SMTP_USER` / `SMTP_PASSWORD` are unset, nodemailer posts without authentication, matching a cluster-internal TMail that relies on **network isolation** rather than SMTP credentials. The two must be set together or not at all.

| Variable                      | Purpose                                      | Default |
| ----------------------------- | -------------------------------------------- | ------- |
| `SMTP_HOST`                   | TMail SMTP host (required)                   | -       |
| `SMTP_FROM_ADDRESS`           | From-header address (required)               | -       |
| `SMTP_PORT`                   | SMTP port                                    | `25`    |
| `SMTP_SECURE`                 | Implicit TLS                                 | `false` |
| `SMTP_FROM_NAME`              | From-header display name                     | `Twake` |
| `SMTP_USER` / `SMTP_PASSWORD` | Optional SMTP auth (set together or neither) | -       |

## Why in-house instead of a provider

- **No third party sees recovery/2FA codes.** The code never leaves the cluster except inside the email itself.
- **Twake controls TTL, attempt caps, and single-use semantics** rather than inheriting a provider's defaults.
- **Storage is privacy-preserving by construction:** HMAC digests mean the OTP table holds no plaintext email or code.

See [Account recovery](../b2c/account-recovery.md) and [Two-factor authentication](../b2c/two-factor-auth.md) for the flows that consume it.
