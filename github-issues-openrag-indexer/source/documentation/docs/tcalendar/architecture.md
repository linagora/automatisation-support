---
title: Architecture
sidebar_position: 2
---

## Side service

`twake-calendar-side-service` is a Java 11+ / Scala 2.13 backend built on the Apache James framework. It packages the following Maven modules:

| Module                | Role                                                                       |
| --------------------- | -------------------------------------------------------------------------- |
| `calendar-api`        | Core domain models and contracts                                           |
| `calendar-rest-api`   | OpenPaaS-compatible REST endpoints (events, calendars, sharing, settings) |
| `calendar-dav`        | DAV proxy fronting esn-sabre, OIDC bearer auth + JWT-signed server requests |
| `calendar-amqp`       | RabbitMQ consumers for iTip scheduling and email jobs                     |
| `calendar-scheduling` | Async alarm / event scheduler (single or cluster mode, lease-based)       |
| `calendar-smtp`       | Email templating and delivery                                              |
| `calendar-redis`      | OIDC token cache (optional; in-memory fallback)                            |
| `calendar-webadmin`   | Operational REST API: metrics, health checks, reindex, alarm rescheduling  |
| `storage-mongodb`, `storage-ldap`, `storage-opensearch` | Pluggable storage backends                        |
| `app`                 | Entrypoint and Docker assembly                                             |

Alarm scheduling runs in cluster mode by default; members coordinate via leases so only one node fires any given alarm.

## Frontend

`twake-calendar-frontend` is a TypeScript React SPA:

- **Build**: Rsbuild (Rspack)
- **State**: Redux Toolkit slices for `user`, `calendars`, `settings`, `searchResult`, `loading`; routing via `redux-first-history`
- **UI**: FullCalendar 6.x + Material-UI 7.x + Emotion
- **HTTP**: `ky` client wrapped in `apiUtils.ts`; automatic retry with exponential backoff up to 2 minutes, 401 triggers an SSO re-auth
- **Realtime**: a WebSocket to the side service keeps the UI in sync with server-side changes, with ping heartbeats and exponential reconnect
- **Auth**: OIDC with PKCE via `openid-client`; discovery runs against `window.SSO_BASE_URL` and tokens live in `sessionStorage`

Runtime configuration is injected at container start through a `.env.js` file that sets `window.CALENDAR_BASE_URL`, `window.SSO_BASE_URL`, `window.SSO_CLIENT_ID`, and related OIDC values.

## Component and data-flow diagrams

### Components (C2)

![Twake Calendar components - C2](/img/architecture/tad-c2-tcal-components.svg)

### Data flow (C2)

![Twake Calendar data flow - C2](/img/architecture/tad-c2-tcal-flux.svg)

## APIs

| Surface           | Purpose                                                                        |
| ----------------- | ------------------------------------------------------------------------------ |
| REST API          | OpenPaaS-compatible endpoints for events, calendars, sharing, settings, alarms |
| DAV proxy         | `/dav/*` forwards authenticated CalDAV / CardDAV traffic to esn-sabre          |
| WebAdmin          | Metrics, health checks, reindex triggers, alarm rescheduling                   |
| WebSocket         | Calendar / event change notifications for the SPA                              |

## Async scheduling

RabbitMQ is the backbone for anything that must not block an HTTP request:

- esn-sabre publishes calendar events; the side service consumes them, applies iTip semantics, and re-publishes email jobs for TMail.
- Alarms ride the same pattern: the scheduler writes alarm records and the delivery worker picks them up at fire time.

See [ADR-0001 Async scheduling](https://github.com/linagora/twake-calendar-side-service/blob/main/adr/0001-async-scheduling.md) in the side-service repo for the fanout topology.

## Configuration reference

### Side service

Load-bearing entries in `configuration.properties`:

| Key                                     | Purpose                                                    |
| --------------------------------------- | ---------------------------------------------------------- |
| `mongo.url`, `mongo.database`           | MongoDB connection (in-memory fallback if absent)          |
| `rabbitmq.*`                            | URI, credentials, reconnection policy                      |
| `dav.url`, `dav.admin.user`, `dav.admin.password` | esn-sabre endpoint and technical account         |
| `jwt.key.private`, `jwt.key.public`     | Must match the keys on esn-sabre                           |
| `oidc.userInfo.url`, `oidc.introspect.url`, `oidc.audience` | Token validation against LemonLDAP     |
| `smtp.host`, `smtp.port`, `mail.sender` | Outbound email for invites and alarms                      |
| `spa.calendar.url`, `spa.excal.url`     | Deep-link bases embedded in email bodies                   |
| `domains`                               | Comma-separated list pre-provisioned at startup            |
| `alarm.event.scheduler.mode`            | `single`, `cluster`, or `disabled`                         |

### Frontend

Window globals set by the deployment via `.env.js`:

| Variable                                          | Required | Purpose                                   |
| ------------------------------------------------- | -------- | ----------------------------------------- |
| `CALENDAR_BASE_URL`                               | yes      | Side-service REST API base                |
| `SSO_BASE_URL`, `SSO_CLIENT_ID`, `SSO_SCOPE`      | yes      | OIDC provider and client                  |
| `SSO_REDIRECT_URI`, `SSO_POST_LOGOUT_REDIRECT`    | yes      | OIDC redirect URLs                        |
| `SSO_CODE_CHALLENGE_METHOD`                       | yes      | PKCE challenge method                     |
| `VIDEO_CONFERENCE_BASE_URL`                       | no       | Defaults to `https://meet.linagora.com`   |

## Related

- [Overview / Architecture](../overview/architecture) - how Twake Calendar fits into the rest of the platform
- [Authentication](../overview/authentication) - how OIDC works across Twake Workplace services
- [RabbitMQ](../overview/rabbitmq) - the shared event bus the side service binds to
