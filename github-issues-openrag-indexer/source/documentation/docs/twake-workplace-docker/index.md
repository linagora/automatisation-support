---
title: Twake Workplace Docker
sidebar_position: 1
---

Twake Workplace Docker is a **self-hosted, standalone deployment** of the Twake Workplace platform. Unlike the SaaS offering, it does not depend on external services like registration or Cloudery. Instead, it uses [LemonLDAP::NG](https://lemonldap-ng.org/) as the SSO provider and runs entirely on a single machine via Docker Compose.

The project is open-source and available at [github.com/linagora/twake-workplace-docker](https://github.com/linagora/twake-workplace-docker).

## What it includes

Twake Workplace Docker bundles a complete collaborative workspace out of the box:

| Capability              | Service                     | URL                      |
| ----------------------- | --------------------------- | ------------------------ |
| **Home / Drive**        | Cozy Stack                  | `user1.twake.local`      |
| **Email**               | TMail (James-based)         | `mail.twake.local`       |
| **Chat**                | Twake Chat (Matrix/Synapse) | `chat.twake.local`       |
| **Video conferencing**  | Meet (LiveKit + Django)     | `meet.twake.local`       |
| **File sharing**        | LinShare                    | `linshare.twake.local`   |
| **Calendar & Contacts** | Twake Calendar + Sabre DAV  | `calendar.twake.local`   |
| **Document editing**    | OnlyOffice                  | `onlyoffice.twake.local` |
| **SSO portal**          | LemonLDAP::NG               | `auth.twake.local`       |

All services are unified through **Cozy Stack**, which acts as the user-facing hub, embedding the other applications via iframes and providing a single personal cloud experience.

## How it differs from the SaaS platform

| Aspect              | SaaS (twake-workplace monorepo)              | Twake Workplace Docker        |
| ------------------- | -------------------------------------------- | ----------------------------- |
| **User management** | Registration service + Cloudery provisioning | Pre-seeded LDAP users         |
| **SSO**             | Registration (OIDC proxy to LemonLDAP)       | LemonLDAP directly            |
| **Infrastructure**  | Distributed, Kubernetes-ready                | Single-machine Docker Compose |
| **Purpose**         | Production SaaS                              | POC, demos, local development |

## Quick links

- [Architecture](./architecture) -- layers, networking, and service topology
- [Services](./services) -- what each service does and how it connects
- [Getting Started](./getting-started) -- prerequisites, setup, and running the stack
- [Authentication](./authentication) -- LemonLDAP SSO and OIDC flow
- [Configuration](./configuration) -- environment variables, DNS, and certificates
