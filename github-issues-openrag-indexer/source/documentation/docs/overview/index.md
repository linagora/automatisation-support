---
title: Concepts
---

These pages describe how Twake Workplace is put together so the rest of the documentation makes sense. If you are here to run code, start with [Getting Started](./getting-started) and the [Developer Guide](/developer-guide).

## What to read

- [Architecture](./architecture) - subsystem topology and data flows
- [Authentication](./authentication) - HMAC, OIDC, LLNG session handling between services
- [SSO and OIDC Proxy](./sso) - why Registration fronts LemonLDAP for end-user login
- [LDAP Structure](./ldap-structure) - directory layout and custom schema
- [RabbitMQ](./rabbitmq) - exchanges, vhosts, and who publishes what
- [Security](./security) - attack surface, trust boundaries, grey-box assessment areas
- [Environments](./environments) - PRD, STG, DEV, QA hostnames
- [Open-source npm packages](./npm-packages) - `@linagora/ldap-rest-client` and `@linagora/rabbitmq-client`

## Audience map

- **Developers** joining the codebase: Getting Started → Architecture → Developer Guide → the specific Service page you will work on.
- **Integrators** using the published APIs: Authentication → the app page (Mail, Chat, Calendar, Cozy).
- **Operators** deploying or running the platform: Environments → Security → Deployment section.
- **Security reviewers**: Security → Architecture → Authentication.
