---
title: Configuration
sidebar_position: 4
---

## Backend configuration

The TMail backend is configured through properties files located in the `conf/` directory of the server application. The distributed variant uses these key files:

### jmap.properties

Controls the JMAP protocol layer, authentication, and feature limits.

| Property                                         | Description                                                                                                                  |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `tls.keystoreURL` / `tls.secret`                 | TLS keystore location and password                                                                                           |
| `jwt.publickeypem.url` / `jwt.privatekeypem.url` | JWT key pair for token signing/validation                                                                                    |
| `authentication.strategy.rfc8621`                | Ordered list of auth strategies: `JWTAuthenticationStrategy`, `BasicAuthenticationStrategy`, `OidcJwtAuthenticationStrategy` |
| `oidc.introspection.url`                         | OIDC token introspection endpoint                                                                                            |
| `oidc.userInfo.url`                              | OIDC UserInfo endpoint for claim resolution                                                                                  |
| `oidc.claim`                                     | JWT claim used as the user identifier (default: `email`)                                                                     |
| `email.recovery.maxEmailRecoveryPerRequest`      | Max emails per recovery request (default: `5`)                                                                               |
| `email.recovery.restorationHorizon`              | Recovery window (default: `15` days)                                                                                         |
| `upload.max.size`                                | Max upload size in bytes (default: `20971520` / 20 MB)                                                                       |

### cassandra.properties

Connection settings for the Cassandra metadata store.

### opensearch.properties

Connection and indexing settings for OpenSearch full-text search.

### rabbitmq.properties

RabbitMQ connection and exchange configuration for the distributed event bus.

### blob.properties

S3-compatible object storage configuration for email blobs and attachments.

### mailbox.properties

Feature toggles for the mailbox layer.

| Property                | Description                          |
| ----------------------- | ------------------------------------ |
| `gpg.encryption.enable` | Enable GPG-encrypted mailbox storage |

### linagora-ecosystem.properties

Integration settings for Twake Workplace services (settings sync, SSO).

### SMTP and IMAP

`smtpserver.xml` and `imapserver.xml` configure listener ports, TLS certificates, and protocol-specific options. The default configuration exposes:

- SMTP on ports 25, 465 (TLS), and 587 (submission)
- IMAP on ports 143 (STARTTLS) and 993 (TLS)

## Client configuration

The TMail Flutter client is configured through environment variables at build time (web) or compile-time constants (mobile).

### env.file (web)

| Variable              | Description                                                   |
| --------------------- | ------------------------------------------------------------- |
| `SERVER_URL`          | JMAP backend URL                                              |
| `DOMAIN_REDIRECT_URL` | OIDC redirect URL                                             |
| `WEB_OIDC_CLIENT_ID`  | OIDC client identifier                                        |
| `OIDC_SCOPES`         | OAuth scopes (default: `openid profile email offline_access`) |
| `APP_GRID_AVAILABLE`  | Enable the application grid launcher                          |
| `FCM_AVAILABLE`       | Enable Firebase push notifications                            |
| `COZY_INTEGRATION`    | Enable Cozy ecosystem integration                             |
| `SENTRY_ENABLED`      | Enable Sentry error tracking                                  |

### Firebase (FCM)

Push notification configuration is stored in `configurations/env.fcm` with separate sections for Android and Web, including API keys, sender IDs, and VAPID public keys.

### OIDC

- **Web**: configured via `WEB_OIDC_CLIENT_ID` and `DOMAIN_REDIRECT_URL` in env.file
- **Android**: redirect scheme `teammail.mobile` registered in the Android manifest
- **iOS**: redirect scheme registered in Info.plist

See the [TMail Flutter OIDC configuration guide](https://github.com/linagora/tmail-flutter/blob/master/docs/configuration/oidc_configuration.md) for details.
