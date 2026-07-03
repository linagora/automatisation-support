---
title: Glossary
sidebar_position: 9
---

Twake-specific terms that recur across the docs and code. One-line each, with a link to the definitive source.

## Platform & deployment

- **Twake Workplace** — the umbrella product: chat, mail, drive, video on a single auth fabric.
- **B2C** — self-service users on `twake.app`. See [B2C](../b2c/).
- **B2B** — multi-tenant orgs on customer-owned domains. See [B2B](../b2b/).
- **Tenant** — synonym for "organization" in B2B contexts; a single org with its own LDAP branch and (often) its own chat tenant.
- **Instance** — usually a Cozy instance: one per user. Can also mean a Synapse tenant in chat-deployment context. Disambiguate by the surrounding service.

## Identity & auth

- **LemonLDAP::NG (LLNG)** — the SSO portal and OIDC provider. Owns sessions and 2FA challenges. Not the password authority — Twake's PBKDF2/Scrypt pipeline lives in Registration; see [SSO & OIDC Proxy](./sso.md).
- **OpenLDAP** — the directory store. Holds users, orgs, groups, and the Twake schema (`twakeOrganization`, `twakeOrganizationRole`, `twakeAccountStatus`, `twakeDomain`, scrypt params).
- **HMAC-SHA256** — the only auth mechanism for service-to-service REST. See [Authentication](./authentication.md).
- **OIDC proxy** — Registration acts as the OIDC provider for downstream apps so it can apply PBKDF2/Scrypt before the LDAP bind. See [SSO & OIDC Proxy](./sso.md).
- **Chat B2B SSO Proxy** — separate small service that fronts LLNG with a distinct OIDC client identity for per-tenant Synapse instances.
- **Auth-User header** — LLNG handler injects this header after validating the session cookie; backends read it instead of doing their own auth.

## Cozy

- **Cozy Stack** — the per-user app server; serves Drive, Notes, Home, Settings. Often shortened to "the stack". Subdomains: `<uid>.<domain>`.
- **Cozy Admin** — admin UI for Cozy operators (separate from Twake's admin panel).
- **Cozy Apps** — the in-instance applications (drive, notes, home, settings, mail, chat, calendar, admin). Installed/uninstalled via the `app.installation.requested` RabbitMQ command.
- **Cloudery** — Cozy's provisioning + billing service (repo `backend-cozy`). Reached over HTTPS + a RabbitMQ bridge. Provisions Cozy instances on `user.created` and `organization.created`. See [Cloudery](../cloudery/).
- **Registry** — the Cozy app registry that the stack pulls app artefacts from. URLs look like `registry://<app>/stable`.
- **The Stack** vs **SaaS Control Plane** — both terms appear in event-consumer lists. "The Stack" = Cozy Stack. "SaaS Control Plane" = Cozy's SaaS-side orchestration that consumes lifecycle events.

## Chat

- **Synapse** — the Matrix homeserver. One per B2B tenant; shared in B2C.
- **TOM** — Twake's gateway service in front of Synapse. Reads Synapse's PostgreSQL directly for some lookups. Holds its own state in KVRocks.
- **Fed** — federated identity service for Matrix federation.
- **Chat B2B Control Plane** — the orchestration service that provisions Synapse + TOM instances per B2B org via GitLab CI pipelines.
- **Matrix ID (MXID)** — `@user:<domain>`. In B2B, the domain segment is the org's custom domain.

## Mail

- **Apache James** — the mail backend. Handles SMTP, IMAP (internal), and JMAP (used by the web client).
- **JMAP** — JSON Meeting Access Protocol; the API the Twake Mail web client uses to talk to James.
- **TMail** — the Twake Mail product (web + mobile + backend).
- **Cassandra** — durable mail data store (outside the K8s cluster).
- **DKIM selectors** — Twake provisions three (`twake1`, `twake2`, `twake3`) per customer domain. CNAMEs to `<selector>._domainkey.twake.app` lets us rotate keys without touching customer DNS.

## Storage

- **KVRocks** — Redis-compatible persistent KV store; used by TOM.
- **OpenSearch** — full-text search backend for TMail.
- **Swift** — OVH object storage for Cozy file blobs.
- **OVH S3** — S3-compatible object storage for mail attachments.
- **MinIO** — separate object store for Meet recordings.

## Anti-abuse

- **Sentinel / ALTCHA** — proof-of-work captcha service. Twake calls it on public-surface actions (OTP send is the canonical call site; signup, login, recovery follow the same pattern). See [`registration/docs/anti-abuse.md`](https://github.com/linagora/twake-workplace-private/blob/main/registration/docs/anti-abuse.md) for the defense-in-depth ordering.
- **CrowdSec** — open-source IP banning system. Registration reports rate-limit strikes and OTP-velocity events; CrowdSec issues bans that Registration enforces on every request. ADR 036.
- **Twilio Verify Fraud Guard** — Twilio's built-in toll-fraud detection on OTP sends.
- **Octopush** — legacy SMS provider, used alongside Twilio.

## Internal

- **`@linagora/ldap-rest-client`** — TypeScript client library. Always use this rather than calling LDAP REST's HMAC API directly.
- **`@linagora/rabbitmq-client`** — internal RabbitMQ wrapper with retry/DLQ helpers.
- **DLQ** — Dead Letter Queue. Twake uses two: `lifecycle.failed` (lifecycle handler errors) and per-queue `*.dlx` exchanges (consumer-side retry exhaustion).
- **ADR** — Architecture Decision Record. See [ADRs](../adrs/).

## Cross-section quick map

| If you see…                 | Read…                                                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `app.install`, `slug`       | [B2B → App provisioning](../b2b/app-provisioning.md)                                                        |
| `domain.user.deleted`       | [B2B → User lifecycle](../b2b/user-lifecycle.md)                                                            |
| `dns.validated`             | [B2B → Domain validation](../b2b/domain-validation.md)                                                      |
| `organization.created`      | [B2B → Org & instance creation](../b2b/org-creation.md)                                                     |
| `user.password.updated`     | [B2C → Account recovery](../b2c/account-recovery.md)                                                        |
| Sentinel, CrowdSec, OTP cap | [Anti-abuse](https://github.com/linagora/twake-workplace-private/blob/main/registration/docs/anti-abuse.md) |
