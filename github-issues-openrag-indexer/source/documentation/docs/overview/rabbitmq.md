---
title: RabbitMQ
---

Twake Workplace uses RabbitMQ as the asynchronous event bus between services. Producers publish state-change events to topic exchanges; consumers react without blocking the request that caused the change.

## Exchange Topology

```mermaid
graph LR
    classDef producer fill:#2ecc71,stroke:#27ae60,color:#fff
    classDef exchange fill:#e74c3c,stroke:#c0392b,color:#fff
    classDef consumer fill:#3498db,stroke:#2980b9,color:#fff

    REG["Registration"]:::producer
    CLOUD["Cloudery"]:::producer
    CS["Common Settings"]:::producer
    ADMIN["Admin Panel<br/>Backend"]:::producer
    CCP["Chat B2B<br/>Control Plane"]:::producer
    TMAIL_INT["TMail internal"]:::producer

    subgraph VHOST_DEFAULT["vhost: /"]
        AUTH{{"auth"}}:::exchange
        B2B{{"b2b"}}:::exchange
        CONFIG{{"configuration"}}:::exchange
        SETTINGS{{"settings"}}:::exchange
        BILLING{{"billing"}}:::exchange
    end

    subgraph VHOST_TMAIL["vhost: /tmail"]
        TMAIL_INTERNAL{{"TMail dispatch"}}:::exchange
        CONTACT_SYNC{{"AddressContactQueue"}}:::exchange
    end

    COZY["cozy-stack (The Stack)"]:::consumer
    TMAIL["TMail /"]:::consumer
    TMAIL2["TMail /tmail"]:::consumer
    TCHAT["TChat / TOM"]:::consumer
    CCP2["Chat B2B<br/>Control Plane"]:::consumer
    ADMIN2["Admin Panel<br/>Backend"]:::consumer
    REG2["Registration"]:::consumer
    CLOUD2["Cloudery"]:::consumer

    REG -->|user.*| AUTH
    CLOUD -->|workplace.created| AUTH
    AUTH -->|workplace.created| REG2
    AUTH -->|user.deletion.requested| REG2
    AUTH -->|user.*| COZY
    AUTH -->|user.created| ADMIN2
    AUTH -->|user.created| CLOUD2

    REG -->|organization.created| B2B
    REG -->|app.installation.requested| B2B
    ADMIN -->|domain.user.deleted| B2B
    ADMIN -->|user.role.changed| B2B
    ADMIN -->|domain.organization.deleted| B2B
    ADMIN -->|app.installation.requested| B2B
    CCP -->|chat.deployment.completed| B2B
    B2B -->|organization.created| ADMIN2
    B2B -->|chat.deployment.completed| ADMIN2
    B2B -->|app.installation.requested| COZY
    B2B -->|domain.user.deleted / org.deleted| TCHAT
    B2B -->|domain.user.deleted| CLOUD2
    B2B -->|domain.organization.deleted| CLOUD2

    ADMIN -->|domain.dns.configuration.status| CONFIG
    CONFIG -->|domain.dns.configuration.status| TMAIL
    CONFIG -->|domain.dns.configuration.status| CCP2

    CLOUD -->|subscription.changed| BILLING
    CLOUD -->|domain.subscription.changed| BILLING
    BILLING -->|subscription.changed| TMAIL
    BILLING -->|domain.subscription.changed| TMAIL
    BILLING -->|domain.subscription.changed| COZY

    CS -->|user.settings.updated| SETTINGS
    SETTINGS -->|user.settings.updated| TMAIL
    SETTINGS -->|user.settings.updated| TCHAT

    TMAIL_INT --> TMAIL_INTERNAL
    TMAIL_INT --> CONTACT_SYNC
    TMAIL_INTERNAL --> TMAIL2
    CONTACT_SYNC -->|sync contacts| TMAIL2
```

## Vhosts

| Vhost    | Exchanges                                                                     |
| -------- | ----------------------------------------------------------------------------- |
| `/`      | `auth`, `b2b`, `configuration`, `settings`, `billing` (plus `b2b.dlx` for DLQ routing) |
| `/tmail` | TMail-internal dispatch and address-book contact sync with third-party providers |

## Publishers and Consumers

Routing keys are shown as the defaults; env vars can override them. Authoritative reference for Admin Panel Backend events: [`admin-panel-backend/docs/rabbitmq.md`](https://github.com/linagora/twake-workplace-private/blob/main/admin-panel-backend/docs/rabbitmq.md). For Registration: [`registration/docs/architecture.md`](https://github.com/linagora/twake-workplace-private/blob/main/registration/docs/architecture.md).

### `auth` exchange

| Routing key                   | Publisher    | Consumer(s)                                |
| ----------------------------- | ------------ | ------------------------------------------ |
| `user.created`                | Registration | Admin Panel Backend, Cloudery, cozy-stack* |
| `user.password.updated`       | Registration | cozy-stack*                                |
| `user.phone.updated`          | Registration | cozy-stack*                                |
| `user.2fa.updated`            | Registration | cozy-stack*                                |
| `user.recovery-email.updated` | Registration | cozy-stack*                                |
| `workplace.created`           | Cloudery     | Registration                               |
| `user.deletion.requested`     | (none)†      | Registration                               |

\* cozy-stack subscribes with the `user.*` wildcard, so it receives every `user.X` key.
† Registration listens for this as an optional alternative to its delete-account API; no service currently publishes it.

### `b2b` exchange

| Routing key                   | Publisher                         | Consumer(s)                                       |
| ----------------------------- | --------------------------------- | ------------------------------------------------- |
| `organization.created`        | Registration                      | Admin Panel Backend                               |
| `app.installation.requested`  | Registration, Admin Panel Backend | cozy-stack                                        |
| `domain.user.deleted`         | Admin Panel Backend               | Cloudery, TChat, cozy-stack, SaaS Control Plane   |
| `user.role.changed`           | Admin Panel Backend               | -                                                 |
| `domain.organization.deleted` | Admin Panel Backend               | Cloudery, TChat, cozy-stack, SaaS Control Plane   |
| `chat.deployment.completed`   | Chat B2B Control Plane            | Admin Panel Backend                               |

### `configuration` exchange

Published after a user validates DNS for chat, top-level domain, or mail.

| Routing key                       | Publisher           | Consumer(s)                   |
| --------------------------------- | ------------------- | ----------------------------- |
| `domain.dns.configuration.status` | Admin Panel Backend | TMail, Chat B2B Control Plane |

### `settings` exchange

| Routing key             | Publisher       | Consumer(s)  |
| ----------------------- | --------------- | ------------ |
| `user.settings.updated` | Common Settings | TMail, TChat |

### `billing` exchange

| Routing key                   | Publisher | Consumer(s)       |
| ----------------------------- | --------- | ----------------- |
| `subscription.changed`        | Cloudery  | TMail             |
| `domain.subscription.changed` | Cloudery  | TMail, cozy-stack |

### `/tmail` vhost

TMail-internal flows: `TMail dispatch` and `AddressContactQueue` exchanges route between TMail's internal services and TMail `/tmail` consumers (e.g. address-book contact sync with third-party providers). Routing keys are TMail-internal; see the TMail backend repo.

## Security and Deployment Notes

- RabbitMQ runs in the `dbs` namespace with TLS certs (`rabbitmq-cert`).
- Cozy Infrastructure connects over AMQPS with IP whitelisting; no mTLS is enforced inside the cluster.
- The RabbitMQ management UI is exposed publicly at `rabbitmq.twake.app` - treat credentials as sensitive.
- Per-environment hostnames are listed on the [Environments](./environments) page.

## Configuration Reference

RabbitMQ connection and routing are configured via environment variables. See:

- [Admin Panel Backend RabbitMQ](https://github.com/linagora/twake-workplace-private/blob/main/admin-panel-backend/docs/rabbitmq.md) for message formats, payloads, and routing keys
- [Registration Architecture](https://github.com/linagora/twake-workplace-private/blob/main/registration/docs/architecture.md) for registration-specific messaging
- [Local Dev with Docker](./docker-compose) for the full list of RabbitMQ environment variables
