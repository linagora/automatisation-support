---
title: Twake Calendar
sidebar_position: 1
---

:::info
Twake Calendar is not yet running in the SaaS production environment and is being prepared for wider rollout.
:::

Twake Calendar is a calendar and contacts platform built as a drop-in replacement for OpenPaaS inside Twake Workplace. Calendar events and contacts live in an esn-sabre CalDAV/CardDAV server; a Java/Scala side service sits in front of it to expose the REST APIs, handle async scheduling, and integrate with the rest of the Twake Workplace platform; a React SPA is the user-facing client.

## Components

| Component                            | Role                                                                            | Stack                                           |
| ------------------------------------ | ------------------------------------------------------------------------------- | ----------------------------------------------- |
| `twake-calendar-side-service`        | REST API, iTip scheduling, alarm scheduler, DAV proxy, contacts + event search  | Java 11+, Scala 2.13, Apache James framework    |
| `twake-calendar-frontend`            | Calendar SPA: month/week/day views, event creation, contacts, settings          | React, TypeScript, Redux Toolkit, Rsbuild       |
| esn-sabre                            | CalDAV / CardDAV server, calendar and address-book persistence                  | PHP (SabreDAV)                                  |

## Data stores

The side service uses the same platform data stores as the rest of Twake Workplace: MongoDB for domain data, Redis DB 0 for the OIDC token cache, RabbitMQ for async scheduling, and OpenSearch for people and event search. Per-environment hostnames live on the [Environments](../overview/environments) page.

## Integration with Twake Workplace

- **Authentication**: users log in through the standard SSO entry (Registration + LemonLDAP::NG); the side service validates bearer tokens against LemonLDAP and caches them in Redis.
- **Directory sync**: the side service reads LDAP to pre-provision domain address books inside esn-sabre via a technical token.
- **Email**: iTip invites and alarm notifications are rendered as templated emails and delivered over SMTP to TMail.
- **Videoconferencing**: event "join" links default to `meet.linagora.com` and can be repointed at the in-platform Meet service.

See the [Architecture](./architecture) page for component and data-flow diagrams.
