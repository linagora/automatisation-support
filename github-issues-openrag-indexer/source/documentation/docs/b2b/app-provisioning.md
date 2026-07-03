---
title: App provisioning
sidebar_position: 8
---

In B2B, the **set of apps installed on a user's Cozy instance is dynamic**. The admin app is only installed when the user is admin or owner. Chat and mail apps appear once the org's domain DNS is validated. The mechanism is one-way RabbitMQ messages: Registration and Admin Panel Backend publish app lifecycle events; the Cozy Stack (the "App Lifecycle Manager") consumes them and applies install/uninstall on the matching instance. See [ADR 031](../adrs/adr-031.md) for the original decision.

## Why messages, not API calls

The earlier alternative was for each app to call the Cozy Stack's HTTP API directly. The trade-off ADR 031 settled was:

- **Direct API**: synchronous, immediate feedback. Forces every publisher to set up an OAuth client per app and exchange tokens to call the stack — heavy coupling.
- **RabbitMQ**: fire-and-forget, eventual consistency. Publishers don't need to know how the stack provisions; the stack doesn't need to know who's asking.

We chose RabbitMQ. The cost is no immediate confirmation that the app was actually installed; the benefit is publishers stay decoupled from the stack's internals.

## The message

`type` distinguishes install vs uninstall. The same routing key carries both.

```json
{
  "emitter": "admin-panel",
  "type": "app.install",
  "workplaceFqdn": "jdoe.workspace.example.com",
  "internalEmail": "jdoe@example.com",
  "reason": "admin user created",
  "organizationId": "org-uuid-123",
  "userId": "jdoe",
  "slug": "admin",
  "source": "registry://admin/stable"
}
```

| Field            | Meaning                                                                   |
| ---------------- | ------------------------------------------------------------------------- |
| `emitter`        | Publisher (`admin-panel`, `registration`) — for logs                      |
| `type`           | `"app.install"` or `"app.uninstall"`                                      |
| `workplaceFqdn`  | The Cozy instance to mutate                                               |
| `internalEmail`  | The user's email                                                          |
| `reason`         | Free-text justification (e.g. `"admin user created"`)                     |
| `organizationId` | The org the user belongs to                                               |
| `userId`         | Username                                                                  |
| `slug`           | App slug: `"admin"`, `"chat"`, `"mail"`, …                                |
| `source`         | Registry URL of the app artefact (install only)                           |

Exchange: `b2b` (env: `RABBITMQ_APPS_EXCHANGE`). Routing key: `app.installation.requested` (env: `RABBITMQ_APPS_INSTALLATION_KEY`). Single consumer: the Cozy Stack ("The Stack" in the codebase). Authoritative reference: [`admin-panel-backend/docs/rabbitmq.md`](https://github.com/linagora/twake-workplace-private/blob/main/admin-panel-backend/docs/rabbitmq.md).

Note: ADR 031 sketched a different draft schema (`source`/`action`/`instanceFqdn`). The production publishers use the schema above.

## Who publishes what, and when

| Trigger                                       | Publisher              | `slug`           | `type`             |
| --------------------------------------------- | ---------------------- | ---------------- | ------------------ |
| New user created with `role: admin`           | Admin Panel Backend    | `admin`          | `app.install`      |
| User role changed `* → admin`                 | Admin Panel Backend    | `admin`          | `app.install`      |
| User role changed `admin → *`                 | Admin Panel Backend    | `admin`          | `app.uninstall`    |
| Ownership transferred to a user               | Admin Panel Backend    | `admin`          | `app.install`      |
| New member joined organization                | Admin Panel Backend    | (each enabled app) | `app.install`    |
| Org owner created (during business onboarding)| Registration           | `admin`          | `app.install`      |
| Invitation completed by an admin/owner member | Registration           | `admin`          | `app.install`      |
| DNS validated for `chat` (batch per user)     | Admin Panel Backend    | `chat`           | `app.install`      |
| DNS validated for `mail` (batch per user)     | Admin Panel Backend    | `mail`           | `app.install`      |
| Chat deployment completed (batch per user)    | Admin Panel Backend    | `chat`           | `app.install`      |
| Org or user deleted                           | (no app message — stack tears down on `user.deleted` / `organization.deleted`) | — | — |

For role-change-driven admin app management, the Admin Panel Backend's lifecycle detector decides which message to publish based on the previous and new roles (see [User lifecycle](./user-lifecycle.md)). For DNS-driven chat/mail provisioning, Admin Panel Backend publishes after DNS validation flips a group to valid — one message per user in the org.

For invitation completion by a regular member (no admin role), Registration's `handleAdminAppInstallationForOrganizationUser` short-circuits and publishes nothing — only owners/admins get the admin app.

Org and user deletion don't publish app uninstall events directly — the Cozy Stack consumes the higher-level `user.deleted` / `organization.deleted` events and tears down the instance entirely, so per-app uninstall isn't needed.

## What the stack does on receipt

1. Validates the message (schema, slug whitelist, instance ownership).
2. Resolves the instance from `workplaceFqdn`.
3. Calls its internal app manager to install/uninstall the slug.
4. Acks. On failure, the message is nacked and re-delivered per the queue's retry policy (or eventually DLQ'd — see [RabbitMQ](../overview/rabbitmq.md)).

There is no callback to the publisher. If the install actually failed, the operator finds out from stack logs / DLQ alerts, not from the original API response that triggered the publish.

## Idempotency

The stack treats install and uninstall as idempotent. Re-installing an already-installed app is a no-op; uninstalling an already-absent app is a no-op. This matters because:

- Lifecycle events can be replayed during recovery.
- Role changes that don't actually cross the admin/non-admin boundary still pass through the detector and may emit a redundant install.
- DNS re-validation after a flap can re-fire an already-applied install.

Publishers don't deduplicate. The stack does, by checking current instance state before applying the change.

## Reference

- Full mechanism doc: [`admin-panel-backend/docs/app-installation.md`](https://github.com/linagora/twake-workplace-private/blob/main/admin-panel-backend/docs/app-installation.md) — registry, prerequisites, batch concurrency, retry/DLQ.
- Message schema: [`admin-panel-backend/docs/rabbitmq.md`](https://github.com/linagora/twake-workplace-private/blob/main/admin-panel-backend/docs/rabbitmq.md)
- ADR: [ADR 031](../adrs/adr-031.md) (schema in ADR is a draft — see the mechanism doc for the production shape)
- Lifecycle table: [User lifecycle](./user-lifecycle.md)
- DNS triggers: [Domain validation](./domain-validation.md)
