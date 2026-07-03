---
title: Environments
---

Twake Workplace runs across several environments. This page lists the public hostnames and notable per-environment quirks. Internal credentials and secrets live in the deployment repository, not here.

When a specific environment diverges from the narrative on the [Architecture](./architecture) page, the internal Helm deployment repo is the source of truth.

There are two production environments:

- **Twake SaaS production** on `*.twake.app`.
- **LINAGORA production** on `*.linagora.com`.

Both share the same service fabric: Cozy Stack for files, TMail for email, TChat for messaging, Meet for video, and the common platform services (Registration, Admin Panel Backend, LDAP REST, Common Settings, SaaS Control Plane, OIDC B2B proxy, ALTCHA). Hostnames differ per environment; quirks are called out below.

## Twake SaaS production

Domain: `*.twake.app`

PostgreSQL runs on the OVH managed database service rather than in the `dbs` namespace.

| Service                        | URL                                        |
| ------------------------------ | ------------------------------------------ |
| Landing page                   | `www.twake.app`                            |
| Registration / SSO entry       | `sign-up.twake.app`                        |
| LemonLDAP portal               | `sso.twake.app`                            |
| LemonLDAP Manager              | `manager.twake.app`                        |
| OIDC B2B proxy                 | `oidc-proxy.twake.app`                     |
| Admin Panel Backend            | `admin-panel-backend.twake.app`            |
| LDAP REST                      | `ldap-rest.twake.app` (HMAC only)          |
| Common Settings                | `settings.twake.app`                       |
| SaaS Control Plane             | `twake-chat-cp.twake.app`                  |
| ALTCHA Sentinel                | `sentinel.twake.app`                       |
| Cozy Stack (instance root)     | `{uid}.twake.app`                          |
| Cozy Apps (Drive, Notes, Home, Settings) | `{uid}-{app}.twake.app`          |
| OnlyOffice                     | `{uid}-office.twake.app`                   |
| TMail                          | `mail.twake.app`                           |
| Mail push                      | `push.twake.app`                           |
| TChat web                      | `chat.twake.app`                           |
| Matrix (Synapse)               | `matrix.twake.app`                         |
| Synapse Sliding Sync v3        | `syncv3.twake.app`                         |
| TOM server                     | `tom.twake.app`                            |
| Federated identity             | `fed.twake.app`                            |
| Meet                           | `meet.twake.app`                           |
| Meet object storage (MinIO)    | `minio.meet.twake.app`                     |
| pgAdmin                        | `pgadmin.twake.app`                        |
| RabbitMQ management UI         | `rabbitmq.twake.app`                       |
| Grafana                        | `grafana.lin-saas.com`                     |

## STG - Staging

Domain: `*.stg.lin-saas.com`

STG mirrors PRD's chart set with a few runtime differences worth knowing: MongoDB is enabled (for upcoming TCalendar work), IMAP/SMTP client access stays disabled (webmail only), and CrowdSec-based WAF protection is bundled inside the `crowdsieve` chart rather than deployed standalone.

| Service                                  | URL                                | Notes                                       |
| ---------------------------------------- | ---------------------------------- | ------------------------------------------- |
| Cozy Stack (instance root)               | `{uid}.stg.lin-saas.com`           |                                             |
| Cozy Apps (Drive, Notes, Home, Settings) | `{uid}-{app}.stg.lin-saas.com`     |                                             |
| OnlyOffice                               | `{uid}-office.stg.lin-saas.com`    |                                             |
| Cloudery                                 | `manager-int.cozycloud.cc`         | int cloudery                                |
| Registration                             | `sign-up.stg.lin-saas.com`         | Static OTP bypass in internal secrets store |
| LemonLDAP portal                         | `auth.stg.lin-saas.com`            |                                             |
| LemonLDAP Manager                        | `manager.stg.lin-saas.com`         |                                             |
| OIDC Proxy (B2B)                         | `oidc-proxy.stg.lin-saas.com`      | `twake-chat-b2b-oidc-proxy`                 |
| TMail                                    | `mail.stg.lin-saas.com`            | Webmail only, no IMAP/SMTP for end users    |
| TChat web                                | `chat.stg.lin-saas.com`            |                                             |
| Matrix (Synapse)                         | `matrix.stg.lin-saas.com`          |                                             |
| Synapse Sliding Sync                     | `syncv3.stg.lin-saas.com`          |                                             |
| TOM                                      | `tom.stg.lin-saas.com`             |                                             |
| Federated identity                       | `fed.stg.lin-saas.com`             |                                             |
| CrowdSieve                               | `crowdsieve.stg.lin-saas.com`      | WAF + Sieve filtering                       |
| RabbitMQ                                 | `rabbitmq.stg.lin-saas.com`        |                                             |
| Grafana                                  | `grafana.stg.lin-saas.com`         | Login with GitHub                           |

## DEV - Development

Domain: `*.cozy.lin-saas.com`

| Service                                  | URL                                | Notes                                       |
| ---------------------------------------- | ---------------------------------- | ------------------------------------------- |
| Cozy Stack (instance root)               | `{uid}.cozy.lin-saas.com`          |                                             |
| Cozy Apps (Drive, Notes, Home, Settings) | `{uid}-{app}.on.cozy.lin-saas.com` | `/dev` channel                              |
| Cloudery                                 | `manager-int.cozycloud.cc`         | int cloudery                                |
| Registration                             | `sign-up.cozy.lin-saas.com`        | Static OTP bypass in internal secrets store |
| LemonLDAP Manager                        | `manager.cozy.lin-saas.com`        |                                             |
| TMail                                    | `mail.cozy.lin-saas.com`           |                                             |
| TChat                                    | `chat.cozy.lin-saas.com`           |                                             |
| RabbitMQ                                 | `rabbitmq.cozy.lin-saas.com`       |                                             |

## QA - Work in Progress

Domain: `*.qa.lin-saas.com`

| Service                                  | URL                            |
| ---------------------------------------- | ------------------------------ |
| Registration                             | `sign-up.qa.lin-saas.com`      |
| LemonLDAP Manager                        | `manager.qa.lin-saas.com`      |
| TMail                                    | `mail.stg.qa.lin-saas.com`     |
| TChat                                    | `chat.stg.qa.lin-saas.com`     |
| Cozy Stack (instance root)               | `{uid}.qa.lin-saas.com`        |
| Cozy Apps (Drive, Notes, Home, Settings) | `{uid}-{app}.qa.lin-saas.com`  |
| RabbitMQ                                 | `rabbitmq.qa.lin-saas.com`     |

## LINAGORA production

Domain: `*.linagora.com`

Cozy infrastructure (cozy-stack, CouchDB, Swift, Cloudery, Registry) lives on a separate network reached over HTTPS and an IP-whitelisted RabbitMQ bridge.

| Service                                  | URL                                                |
| ---------------------------------------- | -------------------------------------------------- |
| Cozy Stack (instance root)               | `{uid}.twake.linagora.com`                         |
| Cozy Apps (Drive, Notes, Home, Settings) | `{uid}-{app}.twake.linagora.com` (`/beta` channel) |
| Cloudery                                 | `manager.cozycloud.cc`                             |
| LemonLDAP                                | `sso.linagora.com`                                 |
| TMail                                    | `mail.linagora.com`                                |
| TChat                                    | `chat.linagora.com`                                |
| Root                                     | `twake.linagora.com` (redirects to Cloudery)       |

## TMail-specific Environments

| Env        | URL                                                 | Notes                                           |
| ---------- | --------------------------------------------------- | ----------------------------------------------- |
| Canary     | `canary-tmail.linagora.com`                         | Same VM as `tmail.linagora.com`, prod DB        |
| On-commit  | `oncommit-tmail.linagora.com`                       | Same VM as `tmail.linagora.com`, prod DB        |
| Sandbox    | `jmap-sandbox.upn.integration-open-paas.org`        | Performance tests                               |

## Monitoring

| Tool             | Scope                            | URL                              |
| ---------------- | -------------------------------- | -------------------------------- |
| Grafana (Twake)  | Logs, dashboards, alerting       | `grafana.lin-saas.com`           |
| Zabbix (Twake)   | Infrastructure alerting          | `zabbix.linagora.com`            |
| Grafana (Cozy)   | CouchDB and Cozy infra           | `grafana.cozycloud.cc`           |
| Graylog (Cozy)   | Cozy logs                        | `graylog.cozycloud.cc`           |
| Zabbix (Cozy)    | Cozy infrastructure alerting     | `zabbix.cozycloud.cc`            |
