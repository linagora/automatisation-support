---
title: Best Practices
---

Rules of thumb gathered from across the platform. These are the things that bite you if you miss them.

## Authentication

- **HMAC secrets must be at least 32 characters.** This applies to every service that talks to LDAP REST.
- **HMAC credential format is `service-id:secret:label`**, comma-separated when registering multiple services.
- **HMAC credentials must match on both sides.** If Registration's secret doesn't match what LDAP REST expects, requests silently fail with 401.
- **Use `@linagora/ldap-rest-client`** for service-to-service calls -- it handles HMAC signing automatically.
- **Passwords are triple-hashed** (PBKDF2 on the client, Scrypt on the backend, SHA256 in OpenLDAP). The raw password never leaves the browser.
- **All applications must implement Back-Channel Logout with `sid` required** (ADR-035). Exceptions: offline mobile sessions and Matrix (temporary).
- **In production:** enable `COOKIE_SECURE=true`, use LDAPS, enforce TLS 1.3+.

## RabbitMQ

- **Use `@linagora/rabbitmq-client`** instead of talking to `amqplib` directly — it standardises connection handling, JSON (de)serialisation and the message-envelope format we use across services.
- **Producers create exchanges, consumers create queues and bind them** (ADR-002).
- **Use quorum queues with 3 replicas** (`x-queue-type: quorum`, `x-quorum-initial-group-size: 3`).
- **Mark messages and queues as durable.** Transient messages are lost on broker restart.
- **Manual ACK only** -- never use auto-ack in production.
- **Dead letter queues must be monitored.** Messages landing there indicate bugs or infrastructure failures, not normal operation.
- **Queue naming convention:** `<exchange>.<message_type>.<consumer_identifier>` (e.g., `user.settings.updates.domainA`).
- **Retry with exponential backoff:** immediate, 2s, 4s, then dead letter.
- **Messages are JSON** with metadata (emitter, type, timestamp) and identifiers (organizationId, userId, domain). Never include sensitive data in event payloads.
- **Prefetch 10** -- process 10 messages at a time, acknowledge individually.
- Distinguish between **commands** (action requests like `app.installation.requested`) and **events** (fact notifications like `user.created`). Producers don't care who consumes events; consumers don't care who sent commands.

## LDAP

- **B2C users** live under `ou=users,dc=twake,dc=app`.
- **B2B organizations** live under `ou=b2b`, each as `ou=domain.com` containing `ou=users` and `ou=groups`.
- **`twakeOrganizationOwner` references the B2B user DN**, not the B2C user. Getting this wrong breaks ownership lookups.
- **B2B group members must reference B2B user DNs**, not B2C users.
- **Organization roles are exactly one of:** `owner`, `admin`, `moderator`, `member`.
- **Organization status is exactly one of:** `active`, `suspended`. User status: `active`, `disabled`.
- **Install the Twake LDAP schema before starting B2B operations:** `ldapadd -Y EXTERNAL -H ldapi:/// -f twake.ldif`.

## Organization & User Lifecycle

- **When deleting an organization, publish `user.deleted` for every user before `domain.organization.deleted`** (ADR-034). Consumers depend on this ordering.
- **Deletion is eventually consistent.** There's a brief window where a deleted user may still have active sessions in chat. Reconciliation jobs catch orphans.
- **All deletion consumers must be idempotent** -- use `organizationId + userId` as the idempotency key.
- **Partial failures are expected.** If chat deactivation fails, the user retains Matrix access until the retry or DLQ alert fires.

## Configuration

- **Every service needs its HMAC credentials synced with LDAP REST.** Registration, Admin Panel Backend, Dashboard, Chat Control Plane -- they all share the same trust chain.
- **Set `LOCAL_DEV=true`** in Registration to skip Cloudery interactions during local development.
- **Dashboard caches aggressively:** org list (5 min), org detail (2 min), owner/groups (5 min). Append `?refresh=true` to force a cache refresh.
- **DNS validation requires all six variables** on Admin Panel Backend: `DNS_TXT_VERIFICATION_PREFIX`, `DNS_CHAT_CNAME_TARGET`, `DNS_MX`, `DNS_SPF_INCLUDE`, `DNS_DKIM_BASE_DOMAIN`, `DNS_DKIM_SELECTORS`. Missing any one silently breaks domain validation.
- **Rate limits have sensible defaults** but are all configurable. OTP endpoints are the most aggressive (1/min per IP).

## Deployment

- **Health check endpoints:**
  - LDAP REST: `GET /api/health`
  - Admin Panel Backend: `GET /health/live` (liveness), `GET /health/ready` (readiness), `GET /health/detailed`
  - Registration: `GET /health`
- **Production checklist:** replace all default passwords, enable TLS/LDAPS, set `COOKIE_SECURE=true`, set log level to `warn` or `error`, configure `CORS_ALLOWED_ORIGINS` for your domain, configure `DM_TRUSTED_PROXIES`.
- **Port map for local development:** LDAP 3389, LDAP REST 3399, Registration 3000, Admin Panel Backend 8081, Dashboard 8081, Auth (SSO) 80, PostgreSQL 5432/5433/5434, RabbitMQ Management 15672.
- **To nuke local state:** `docker compose down -v && docker compose up -d --build`. The `-v` flag deletes all LDAP data and databases.

## Development

- **Run `npm run lint` and `npm run format` before committing.** Run `npm run check` for TypeScript validation.
- **Use Drizzle ORM** for database schema and migrations. Generate with `npx drizzle-kit generate`, apply with `npx drizzle-kit migrate`.
- **Testing layers:** unit tests (pure logic, no external deps), integration tests (mocked LDAP), API tests (real OpenLDAP container). Run all with `npm test`.
- **Start Docker dependencies before the dev server.** Services need LDAP, PostgreSQL, and RabbitMQ running.

## LemonLDAP (B2B)

- **Export these LDAP variables** in virtual host configuration: `twakeOrganizationId`, `twakeWorkspaceUrl`, `twakeOrganizationRole`, plus standard attributes.
- **Required macros:** `_whatToTrace` (email tracking), `cozyStackSub` (OIDC sub for Cloudery), `instanceWorkplaceUrl` (B2C/B2B switch), `userDomain` (domain extraction).
- **OIDC Relying Parties must force claims into tokens** -- Cozy RP needs user claims in both ID and access tokens; ChatB2B RP needs organizationId and organizationRole.
