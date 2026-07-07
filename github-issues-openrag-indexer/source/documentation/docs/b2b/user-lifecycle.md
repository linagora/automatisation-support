---
title: User lifecycle
sidebar_position: 6
---

Every mutation to a B2B user (create, disable, role change, delete, ownership transfer) flows through Admin Panel Backend. The backend proxies the operation to LDAP REST, then runs a **lifecycle detector** against the proxied response and fans out side effects: RabbitMQ messages, LLNG session termination, and app install/uninstall commands.

The authoritative table lives with the code in [`admin-panel-backend/docs/lifecycle.md`](https://github.com/linagora/twake-workplace-private/blob/main/admin-panel-backend/docs/lifecycle.md). This page is the narrative: which events fire when, why, who consumes them.

## The detector

The lifecycle detector runs on every 2xx response from LDAP REST. It pattern-matches method + URL against a small table:

| Operation                | Trigger                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `user-created`           | `POST /api/v1/organizations/:orgId/users` with `organizationRole=admin`                                       |
| `user-deleted`           | `DELETE /api/v1/organizations/:orgId/users/:userId`                                                           |
| `user-disabled`          | `PATCH /api/v1/organizations/:orgId/users/:userId/status` → `enabled: false`                                  |
| `role-changed`           | `PATCH /api/v1/organizations/:orgId/users/:userId/role`, or `PATCH /api/v1/organizations/:orgId/users/:userId` with `organizationRole` |
| `ownership-transferred`  | `PUT /api/v1/organizations/:orgId/owner`                                                                      |
| `organization-deleted`   | `DELETE /api/v1/organizations/:orgId`                                                                         |

Note two deliberate asymmetries:

1. **`user-created` only fires for admins**, not for regular members. For members, the Cozy/chat/mail provisioning event is published by Registration when the invitation is completed (see [Invitations](./invitations.md)).
2. **`user-disabled` does not publish** — the user's sessions are killed but no RabbitMQ message is sent. Disable is a reversible state, so downstream services keep the user's data and only the ability to sign in is revoked. Deletion is what publishes.

## Side effects per operation

### User created (admin role only)

- Publishes `app.install` command on the `b2b` exchange (routing key `app.installation.requested`) so the new admin gets the admin app provisioned on their Cozy instance.
- Non-admin creates have zero side effects at this moment — see the invitation flow for the real event.

### User disabled

- Terminates the user's LLNG sessions (best-effort). No RabbitMQ.

### Role changed

Two detection paths exist, and they handle `previousRole` differently:

- **Dedicated endpoint** (`PATCH …/users/:userId/role`) returns `{ role, previousRole }` in the response body. The detector reads `previousRole` from there — no extra LDAP call.
- **General update endpoint** (`PATCH …/users/:userId` with `organizationRole`) doesn't return `previousRole`, so the detector pre-fetches it from LDAP REST *before* forwarding the request. If the role hasn't actually changed, no operation is emitted.

| Transition               | Side effect                                     |
| ------------------------ | ----------------------------------------------- |
| `* → admin`              | Publishes `app.install` for the admin app       |
| `admin → *` (non-admin)  | Publishes `app.uninstall` for the admin app     |
| `member ↔ moderator`     | No side effect (no app change)                  |

The role field is what drives admin app provisioning, not a separate "admin app" toggle.

### Ownership transferred

- Publishes `app.install` for the admin app (new owner).
- Publishes `user.role.changed` with `role: "owner"`.
- The previous owner is **not** automatically demoted to admin by the detector — ownership transfer is a distinct LDAP REST operation that handles the two-way change; the detector only reacts to the response.

### User deleted

1. Terminates the user's LLNG sessions (best-effort).
2. Publishes `user.deleted` on the `b2b` exchange with routing key `domain.user.deleted`.

Consumers:
- **The Stack** (Cozy SaaS control plane) — removes the Cozy instance.
- **Chat B2B Control Plane** — disables Matrix access.
- **Cloudery** — updates plan / billing.

### Organization deleted

This is the biggest fan-out. See [`admin-panel-backend/docs/organization-delete-lifecycle.md`](https://github.com/linagora/twake-workplace-private/blob/main/admin-panel-backend/docs/organization-delete-lifecycle.md) for the full message shapes.

1. Proxy forwards the `DELETE /organizations/:orgId` to LDAP REST.
2. **After LDAP delete succeeds**, the handler:
    - Fetches the list of active users (from LDAP REST — note: LDAP REST had to allow a list-after-delete, or we'd have to fetch before).
    - Fetches the org's domain.
    - Batch-terminates every user's LLNG session.
    - Publishes `user.deleted` for each user (reason: `"organization deleted"`), in batches.
    - Publishes a single `domain.organization.deleted` event after all per-user events.
3. Returns the original LDAP REST response to the admin.

Consumers: The Stack, Chat Control Plane, Cloudery (same as single-user delete, plus the org-level message that cleans up org-wide resources).

## Synchronous, not background

Lifecycle handlers run **before the response is sent to the client**. If publishing is slow, the admin panel's HTTP response is slow. The upside: the admin sees errors (via the `X-Lifecycle-Warning` header) at the moment of action, not in a separate notification channel.

The exception: org deletion is best-effort on the fan-out because it can touch hundreds of users. Batching prevents overwhelming RabbitMQ; failed per-user publishes go to the DLQ.

## Failure mode: DLQ, not rollback

If a lifecycle handler throws after LDAP REST has already returned 2xx, **we do not roll back LDAP**. Instead:

1. The failure is published to the lifecycle failures DLQ (`admin-panel` exchange, `lifecycle.failed` routing key).
2. An `X-Lifecycle-Warning` header is added to the response.
3. The original LDAP REST response is returned to the client.

Rollback is not an option because LDAP is the source of truth. The DLQ exists precisely for manual reconciliation of the downstream effects that didn't fire.

If the DLQ publish itself fails, the error is logged and the operation is lost — this is the only "critical" error path. Operationally, monitor the DLQ publish failure log.

## Event summary

| Event                           | Exchange      | Routing key                      | Publisher           | Fires when                                  |
| ------------------------------- | ------------- | -------------------------------- | ------------------- | ------------------------------------------- |
| `user.created`                  | `auth`        | `user.created`                   | Registration        | B2C signup OR B2B invitation completed      |
| `user.deleted`                  | `b2b`         | `domain.user.deleted`            | Admin Panel Backend | User deleted OR org deleted (per user)      |
| `user.role.changed`             | `b2b`         | `user.role.changed`              | Admin Panel Backend | Ownership transferred                       |
| `organization.created`          | `b2b`         | `organization.created`           | Registration        | Business onboarding                         |
| `organization.deleted`          | `b2b`         | `domain.organization.deleted`    | Admin Panel Backend | After all per-user `user.deleted` events    |
| `app.install` / `app.uninstall` | `b2b`         | `app.installation.requested`     | Admin Panel + Reg.  | Admin role granted/revoked, DNS validated, … |
| `dns.validated`                 | `admin-panel` | `dns.validated`                  | Admin Panel Backend | Any DNS group flips to valid                |
| `lifecycle.failed`              | `admin-panel` | `lifecycle.failed`               | Admin Panel Backend | Handler threw; DLQ for manual review        |

Exact exchange/routing-key names are configurable via env vars — the table shows defaults. Authoritative reference: [`admin-panel-backend/docs/rabbitmq.md`](https://github.com/linagora/twake-workplace-private/blob/main/admin-panel-backend/docs/rabbitmq.md).
