---
title: Admin Panel Backend
sidebar_position: 1
pagination_next: null
pagination_prev: null
---

LemonLDAP::NG-authenticated gateway that proxies organization administration requests from the browser to LDAP REST. Owns invitation state, DNS validation, and the lifecycle events that fan out to RabbitMQ.

The full reference (architecture, authentication, lifecycle, RabbitMQ contracts, configuration, deployment, development, API) lives next to the code:

**→ [`admin-panel-backend/docs/`](https://github.com/linagora/twake-workplace-private/tree/main/admin-panel-backend/docs)** on GitHub.

For the cross-service B2B narrative (how this fits with LDAP REST, Registration, Chat Control Plane, etc.), see [B2B](../b2b/).
