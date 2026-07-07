---
title: Local Dev with Docker
sidebar_label: Local Dev with Docker
---

## Quick Start

```bash
cp .env.example .env
docker compose up -d
```

## Host Configuration

Add to `/etc/hosts`:

```
127.0.0.1 example.com auth.example.com signup.example.com admin-panel-backend.example.com ldap-rest.example.com dashboard.example.com docs.example.com
```

## Services

| Service                   | URL / Port                             | Credentials                           |
| ------------------------- | -------------------------------------- | ------------------------------------- |
| Registration              | http://signup.example.com              | -                                     |
| Auth (SSO)                | http://auth.example.com                | -                                     |
| Admin Panel API           | http://admin-panel-backend.example.com | -                                     |
| LDAP-REST                 | http://ldap-rest.example.com           | HMAC auth only                        |
| phpLDAPadmin              | http://localhost:6443                  | `cn=admin,dc=twake,dc=test` / `admin` |
| RabbitMQ                  | http://localhost:15672                 | `admin` / `admin`                     |
| OpenLDAP                  | localhost:3389                         | -                                     |
| PostgreSQL (registration) | localhost:5432                         | -                                     |
| PostgreSQL (auth)         | localhost:5433                         | -                                     |
| PostgreSQL (admin)        | localhost:5434                         | -                                     |
| Dashboard                 | http://dashboard.example.com           | -                                     |

:::tip Documentation site
The documentation site has its own `docker-compose.yml` in the `documentation/` directory. See the [Documentation Deployment](/overview/getting-started) section for how to run it separately, including optional OIDC protection.
:::

## Commands

```bash
# Start
docker compose up -d

# Start with rebuild
docker compose up -d --build

# Stop
docker compose down

# Stop and delete data
docker compose down -v

# Logs
docker compose logs -f <service>

# Status
docker compose ps

# Restart service
docker compose restart <service>

# Rebuild single service
docker compose up -d --build <service>
```

## Environment Variables

Copy `.env.example` to `.env`.

### OpenLDAP

| Variable               | Purpose                   | Default            |
| ---------------------- | ------------------------- | ------------------ |
| `LDAP_ORGANISATION`    | Organization name in LDAP | `Twake`            |
| `LDAP_DOMAIN`          | LDAP domain               | `twake.test`       |
| `LDAP_BASE_DN`         | Base DN for LDAP queries  | `dc=twake,dc=test` |
| `LDAP_ADMIN_PASSWORD`  | Admin password            | `admin`            |
| `LDAP_CONFIG_PASSWORD` | Config admin password     | `config`           |
| `LDAP_TLS`             | Enable TLS                | `false`            |

### LDAP-REST

| Variable             | Purpose                                          | Default                     |
| -------------------- | ------------------------------------------------ | --------------------------- |
| `DM_PORT`            | API port                                         | `3399`                      |
| `DM_LDAP_URL`        | LDAP server URL                                  | `ldap://openldap:389`       |
| `DM_LDAP_BASE`       | Base DN                                          | `dc=twake,dc=test`          |
| `DM_LDAP_DN`         | Bind DN                                          | `cn=admin,dc=twake,dc=test` |
| `DM_LDAP_PWD`        | Bind password                                    | `admin`                     |
| `DM_LOG_LEVEL`       | Log level                                        | `info`                      |
| `DM_AUTH_HMAC`       | HMAC credentials (format: `id:secret:label,...`) | -                           |
| `DM_TRUSTED_PROXIES` | Trusted proxy CIDRs                              | `172.16.0.0/12,...`         |
| `DM_PLUGINS`         | Plugin chain                                     | -                           |

### Dashboard

| Variable               | Purpose                                              | Default     |
| ---------------------- | ---------------------------------------------------- | ----------- |
| `LDAP_REST_URL`        | LDAP-REST API URL                                    | -           |
| `LDAP_REST_SERVICE_ID` | HMAC service identifier                              | -           |
| `LDAP_REST_SECRET`     | HMAC shared secret (32+ chars)                       | -           |
| `AUTH_ENABLED`         | Enable OIDC authentication                           | `false`     |
| `OIDC_ISSUER`          | OIDC provider URL (when auth enabled)                | -           |
| `OIDC_CLIENT_ID`       | OIDC client identifier (when auth enabled)           | -           |
| `OIDC_CLIENT_SECRET`   | OIDC client secret (when auth enabled)               | -           |
| `OIDC_REDIRECT_URI`    | OIDC callback URL (when auth enabled)                | -           |
| `SESSION_SECRET`       | Cookie encryption key, 32+ chars (when auth enabled) | -           |
| `ADMIN_DN_PATTERN`     | Regex for authorized DNs (when auth enabled)         | `ou=admins` |

### LemonLDAP (auth)

| Variable    | Purpose                      | Default   |
| ----------- | ---------------------------- | --------- |
| `PG_SERVER` | PostgreSQL host for sessions | `auth-db` |
| `LOGLEVEL`  | Log level                    | `notice`  |

### Admin Panel Backend

| Variable                                | Purpose                                   | Default                          |
| --------------------------------------- | ----------------------------------------- | -------------------------------- |
| `PORT`                                  | Server port                               | `8081`                           |
| `BASE_URL`                              | Public URL                                | -                                |
| `CORS_ALLOWED_ORIGINS`                  | Allowed CORS origins                      | `*.example.com,localhost`        |
| `COOKIE_SECURE`                         | Secure cookies (production: true)         | `false`                          |
| `TRUST_PROXY`                           | Trust reverse proxy headers               | `true`                           |
| `LOG_LEVEL`                             | Log level                                 | `info`                           |
| `LDAP_REST_URL`                         | LDAP-REST API URL                         | -                                |
| `LDAP_REST_HMAC_SERVICE_ID`             | HMAC service identifier                   | -                                |
| `LDAP_REST_HMAC_SECRET`                 | HMAC secret (32+ chars)                   | -                                |
| `REGISTRATION_SERVICE_URL`              | Registration service URL                  | -                                |
| `REGISTRATION_ACCESS_TOKEN`             | Registration API token                    | -                                |
| `ADMIN_PANEL_DATABASE_URL`              | PostgreSQL connection string              | -                                |
| `DNS_TXT_VERIFICATION_PREFIX`           | TXT record prefix for domain verification | `twake-verification`             |
| `DNS_CHAT_CNAME_TARGET`                 | CNAME target for chat subdomains          | -                                |
| `DNS_MX`                                | MX record hostname                        | -                                |
| `DNS_SPF_INCLUDE`                       | SPF include directive                     | -                                |
| `DNS_DKIM_SELECTORS`                    | DKIM selectors (comma-separated)          | `twake1,twake2,twake3`           |
| `DNS_DKIM_BASE_DOMAIN`                  | DKIM base domain                          | -                                |
| `DNS_DMARC_POLICY`                      | DMARC policy                              | `quarantine`                     |
| `DNS_REVALIDATION_GRACE_PERIOD_SECONDS` | Grace period before revalidation          | `60`                             |
| `PROXY_TIMEOUT_MS`                      | LDAP REST proxy timeout (ms)              | `30000`                          |
| `REGISTRATION_TIMEOUT_MS`               | Registration service timeout (ms)         | `10000`                          |
| `APPLICATIONS`                          | Toggleable app slugs (comma-separated)    | `drive,chat,mail,calendar,notes` |
| `APP_ADMIN_SLUG`                        | Admin app slug (always present)           | `admin`                          |
| `APP_ADMIN_SOURCE`                      | Admin app registry source                 | `registry://admin/stable`        |
| `APP_{SLUG}_SLUG`                       | Slug for any app in `APPLICATIONS`        | `{slug}`                         |
| `APP_{SLUG}_SOURCE`                     | Registry source for any app               | `registry://{slug}/stable`       |
| `LLNG_MANAGER_URL`                      | LLNG Manager API URL (optional)           | -                                |
| `LLNG_PORTAL_URL`                       | LLNG Portal URL (optional)                | -                                |
| `LLNG_MANAGER_ADMIN_USER`               | LLNG Manager admin username (optional)    | -                                |
| `LLNG_MANAGER_ADMIN_PASSWORD`           | LLNG Manager admin password (optional)    | -                                |
| `LLNG_COOKIE_NAME`                      | LLNG session cookie name                  | `lemonldap`                      |
| `OIDC_PROVIDER_URL`                     | OIDC Provider URL (optional)              | -                                |
| `OIDC_CLIENT_ID`                        | OIDC RP client ID (optional)              | -                                |
| `OIDC_CLIENT_SECRET`                    | OIDC RP client secret (optional)          | -                                |
| `OIDC_REDIRECT_URI`                     | OIDC RP redirect URI (optional)           | -                                |
| `OIDC_SCOPES`                           | OIDC scopes (optional)                    | `openid`                         |
| `OIDC_COOKIE_NAME`                      | Session cookie name (optional)            | `lemonldap`                      |

### Registration Service

| Variable                     | Purpose                            | Default             |
| ---------------------------- | ---------------------------------- | ------------------- |
| `SECRET`                     | Session encryption key (32+ chars) | -                   |
| `SECRET_API_KEY`             | Internal API authentication        | -                   |
| `DATABASE_URL`               | PostgreSQL connection string       | -                   |
| `AUTH_URL`                   | LemonLDAP portal URL               | -                   |
| `PUBLIC_AUTHORISATION_URL`   | OAuth2 authorize endpoint          | -                   |
| `PUBLIC_OIDC_PROVIDER`       | OIDC provider URL                  | -                   |
| `LOGIN_MAX_RETRIES`          | Max login retry attempts           | `3`                 |
| `LOGIN_RETRY_BASE_MS`        | Retry backoff base delay (ms)      | `500`               |
| `LOGIN_RETRY_MAX_MS`         | Retry backoff max delay (ms)       | `5000`              |
| `SMS_SERVICE_KEY`            | Octopush API key                   | -                   |
| `SMS_SERVICE_LOGIN`          | Octopush login                     | -                   |
| `SMS_SERVICE_API`            | Octopush API URL                   | -                   |
| `TWILIO_ACCOUNT_SID`         | Twilio account (US/CA SMS)         | -                   |
| `TWILIO_AUTH_TOKEN`          | Twilio auth token                  | -                   |
| `TWILIO_VERIFY_SERVICE_SID`  | Twilio Verify service              | -                   |
| `TWILIO_RISK_CHECK`          | Fraud Guard mode (`enable`, `disable`) | `enable`   |
| `TWILIO_COUNTRIES`           | Countries using Twilio             | `us,ca`             |
| `SMTP_HOST`                  | TMail SMTP host (email OTP)        | -                   |
| `SMTP_FROM_ADDRESS`          | From-header address for OTP emails | -                   |
| `SMTP_PORT`                  | SMTP port                          | `25`                |
| `SMTP_SECURE`                | Use implicit TLS                   | `false`             |
| `SMTP_FROM_NAME`             | From-header display name           | `Twake`             |
| `SMTP_USER`                  | Optional SMTP auth user            | -                   |
| `SMTP_PASSWORD`              | Optional SMTP auth password        | -                   |
| `EMAIL_OTP_TTL_SECONDS`      | Email OTP code lifetime            | `600`               |
| `EMAIL_OTP_MAX_ATTEMPTS`     | Wrong-code cap before timeout      | `3`                 |
| `CHALLENGE_SECRET`           | CAPTCHA secret                     | -                   |
| `CLOUDERY_MANAGER_URL`       | Cloudery API URL                   | -                   |
| `CLOUDERY_MANAGER_TOKEN`     | Cloudery API token                 | -                   |
| `CLOUDERY_OFFER`             | B2C offer name                     | `twake_default`     |
| `CLOUDERY_B2B_OFFER`         | B2B offer name                     | `b2b_twake_default` |
| `PUBLIC_SIGNUP_EMAIL_DOMAIN` | Email domain for accounts          | -                   |
| `PUBLIC_REGISTRATION_URL`    | Registration app URL               | -                   |
| `PUBLIC_SUPPORT_EMAIL`       | Support email address              | -                   |
| `PUBLIC_MAINTENANCE_MODE`    | Enable maintenance mode            | `false`             |
| `DEMO_MODE`                  | Enable demo mode                   | `true`              |
| `LOCAL_DEV`                  | Skip Cloudery calls for local dev  | `false`             |
| `ADMIN_OTP`                  | Bypass OTP for testing             | -                   |

#### Rate Limiting (optional)

All rate limits are configurable. If not set, sensible defaults are used.

| Variable                                       | Purpose                           | Default |
| ---------------------------------------------- | --------------------------------- | ------- |
| `RATE_LIMIT_LOGIN_IPUA_PER_MINUTE`             | Login: IP+UA limit per minute     | `15`    |
| `RATE_LIMIT_LOGIN_COOKIE_PER_MINUTE`           | Login: Cookie limit per minute    | `15`    |
| `RATE_LIMIT_OTP_IP_PER_MINUTE`                 | OTP: IP limit per minute          | `1`     |
| `RATE_LIMIT_OTP_IP_PER_DAY`                    | OTP: IP limit per day             | `25`    |
| `RATE_LIMIT_OTP_IPUA_PER_MINUTE`               | OTP: IP+UA limit per minute       | `1`     |
| `RATE_LIMIT_OTP_IPUA_PER_DAY`                  | OTP: IP+UA limit per day          | `25`    |
| `RATE_LIMIT_OTP_COOKIE_PER_MINUTE`             | OTP: Cookie limit per minute      | `1`     |
| `RATE_LIMIT_RECOVERY_IP_PER_MINUTE`            | Recovery: IP limit per minute     | `1`     |
| `RATE_LIMIT_RECOVERY_IP_PER_DAY`               | Recovery: IP limit per day        | `25`    |
| `RATE_LIMIT_RECOVERY_IPUA_PER_MINUTE`          | Recovery: IP+UA limit per minute  | `1`     |
| `RATE_LIMIT_RECOVERY_IPUA_PER_DAY`             | Recovery: IP+UA limit per day     | `25`    |
| `RATE_LIMIT_RECOVERY_COOKIE_PER_MINUTE`        | Recovery: Cookie limit per minute | `1`     |
| `RATE_LIMIT_PASSWORD_CHANGE_USER_PER_MINUTE`       | Password change limit per user per minute       | `2`     |
| `RATE_LIMIT_PASSWORD_CHANGE_USER_PER_HOUR`         | Password change limit per user per hour         | `10`    |
| `RATE_LIMIT_PASSWORD_CHANGE_USER_PER_DAY`          | Password change limit per user per day          | `25`    |
| `RATE_LIMIT_PHONE_CHANGE_USER_PER_MINUTE`          | Phone change limit per user per minute          | `2`     |
| `RATE_LIMIT_PHONE_CHANGE_USER_PER_HOUR`            | Phone change limit per user per hour            | `10`    |
| `RATE_LIMIT_PHONE_CHANGE_USER_PER_DAY`             | Phone change limit per user per day             | `25`    |
| `RATE_LIMIT_RECOVERY_EMAIL_CHANGE_USER_PER_MINUTE` | Recovery email change limit per user per minute | `2`     |
| `RATE_LIMIT_CREATE_BUSINESS_USER_PER_MINUTE`       | Create business OTP limit per user per minute   | `1`     |
| `RATE_LIMIT_CREATE_BUSINESS_USER_PER_HOUR`         | Create business OTP limit per user per hour     | `10`    |
| `RATE_LIMIT_CREATE_BUSINESS_USER_PER_DAY`          | Create business OTP limit per user per day      | `25`    |
| `RATE_LIMIT_B2B_INVITATION_PER_MINUTE`             | B2B invitation OTP limit per invitation per min | `2`     |
| `RATE_LIMIT_B2B_INVITATION_CREATION_ORG_PER_MINUTE`| B2B invitation creation limit per org per minute| `10`    |
| `RATE_LIMIT_B2B_INVITATION_CREATION_ORG_PER_HOUR`  | B2B invitation creation limit per org per hour  | `60`    |
| `RATE_LIMIT_B2B_INVITATION_CREATION_ORG_PER_DAY`   | B2B invitation creation limit per org per day   | `200`   |
| `RATE_LIMIT_CHECK_PHONE_USER_PER_MINUTE`       | Check phone: per authenticated user per minute  | `10`    |
| `RATE_LIMIT_CHECK_EMAIL_IP_PER_MINUTE`         | Check email: IP per minute        | `60`    |
| `RATE_LIMIT_CHECK_EMAIL_IP_PER_DAY`            | Check email: IP per day           | `1000`  |
| `RATE_LIMIT_CHECK_EMAIL_IPUA_PER_MINUTE`       | Check email: IP+UA per minute     | `20`    |
| `RATE_LIMIT_CHECK_EMAIL_IPUA_PER_DAY`          | Check email: IP+UA per day        | `200`   |
| `RATE_LIMIT_SUGGEST_NICKNAMES_IP_PER_MINUTE`   | Suggest nicknames: IP per minute  | `60`    |
| `RATE_LIMIT_SUGGEST_NICKNAMES_IP_PER_DAY`      | Suggest nicknames: IP per day     | `1000`  |
| `RATE_LIMIT_SUGGEST_NICKNAMES_IPUA_PER_MINUTE` | Suggest nicknames: IP+UA per min  | `20`    |
| `RATE_LIMIT_SUGGEST_NICKNAMES_IPUA_PER_DAY`    | Suggest nicknames: IP+UA per day  | `200`   |
| `RATE_LIMIT_OTP_PHONE_PER_DAY`                 | OTP: max sends per phone per day (all clients)  | `10`    |
| `RATE_LIMIT_OTP_PREFIX_PER_HOUR`               | OTP: max sends per ISO country per hour         | `100`   |
| `RATE_LIMIT_OTP_EMAIL_PER_DAY`                 | OTP: max sends per recovery email per day       | `10`    |

### RabbitMQ

| Variable                          | Purpose                 | Default                       |
| --------------------------------- | ----------------------- | ----------------------------- |
| `RABBITMQ_URL`                    | Connection URL          | `amqp://admin:admin@rabbitmq` |
| `RABBITMQ_DEFAULT_USER`           | Username                | `admin`                       |
| `RABBITMQ_DEFAULT_PASS`           | Password                | `admin`                       |
| `RABBITMQ_MAX_RETRIES`            | Max publish retries     | `5`                           |
| `RABBITMQ_RETRY_DELAY`            | Retry delay (ms)        | `1000`                        |
| `RABBITMQ_CONNECTION_RETRY_DELAY` | Reconnection delay (ms) | `5000`                        |
| `RABBITMQ_INIT_MAX_ATTEMPTS`      | Max init attempts       | `5`                           |
| `RABBITMQ_PUBLISH_MAX_ATTEMPTS`   | Max publish attempts    | `5`                           |
| `RABBITMQ_AUTH_EXCHANGE`          | Auth events exchange    | `auth`                        |
| `RABBITMQ_B2B_EXCHANGE`           | B2B events exchange     | `b2b`                         |

### Seed (test data)

| Variable          | Purpose                    | Default        |
| ----------------- | -------------------------- | -------------- |
| `HMAC_SERVICE_ID` | Service ID for seed script | `seed-service` |
| `HMAC_SECRET`     | HMAC secret (32+ chars)    | -              |

Run the seed (idempotent):

```bash
docker compose --profile seed up seed
```

Test accounts created (all use password `Password123!`):

| Login               | Type       | Branch        |
| ------------------- | ---------- | ------------- |
| `alice`             | B2C        | `ou=users`    |
| `owner@example.com` | B2B owner  | org `example` |
| `bob@example.com`   | B2B member | org `example` |
| `carol@example.com` | B2B member | org `example` |

The org `example` lives at `ou=example,ou=b2b,dc=twake,dc=test` with `twakeDomain=example.com`. Sign in at [signup.example.com](http://signup.example.com).

Hard-delete LDAP entries to reset the dev state (binds as `cn=admin,...`):

```bash
docker compose --profile cleanup run --rm cleanup --org example
docker compose --profile cleanup run --rm cleanup --user alice --user bob
docker compose --profile cleanup run --rm cleanup --b2b   # all B2B orgs
docker compose --profile cleanup run --rm cleanup --b2c   # all B2C users
docker compose --profile cleanup run --rm cleanup --all   # both
```

Flags are combinable. Cleanup goes around the LDAP-REST API on purpose: that path soft-deletes B2B users and blocks owner removal, which would prevent re-seeding.

## Troubleshooting

**Port conflicts:**

```bash
sudo lsof -i :80 -i :3389 -i :5432
```

**Check service health:**

```bash
docker compose ps
```

**Test LDAP:**

```bash
docker compose exec openldap ldapsearch -x -H ldap://localhost -b "dc=twake,dc=test" -D "cn=admin,dc=twake,dc=test" -w admin
```

**Reset everything:**

```bash
docker compose down -v
docker compose up -d --build
```

## Production

- Replace all default passwords
- Set `LDAP_TLS=true`
- Set `COOKIE_SECURE=true`
- Configure real DNS instead of `/etc/hosts`
- Update `CORS_ALLOWED_ORIGINS`
