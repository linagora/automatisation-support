---
title: API, webhooks & CLI
sidebar_position: 7
---

# API, webhooks & CLI

The Cloudery exposes an HTTP API for partners, sends signed webhooks back to them, and ships a set of operator CLIs. This page is a readable tour; the endpoint-by-endpoint contract lives in the interactive reference.

:::info Authoritative API reference
The full OpenAPI reference is published at **[cloudery.cozycloud.cc/api](https://cloudery.cozycloud.cc/api)** (generated from `doc/api.yaml`). Treat it as the source of truth for exact request/response shapes. This page explains how the pieces fit and covers auth, webhooks, and tooling, which the reference does not.
:::

## Authentication

Almost every API call is authenticated with a **partner bearer token**:

```
Authorization: Bearer <token>
```

A `Token` is a Mongo document whose `_id` *is* the secret. Beyond identifying the partner, a token encodes its own authorization scope:

- The `partners` list restricts which partners' data the token may touch. Querying a partner not on the list is rejected. The `cozy` admin partner can act across partners.
- `only` / `exclude` projections restrict which fields a token may read.
- `authorized?` enforces that a token may only act on instances its partner owns (unless it is the admin partner).

Tokens are minted with `bin/create-token.rb`. The browser-facing flows (onboarding, premium checkout) use session auth and Doorkeeper/OAuth instead, not bearer tokens.

:::note Public endpoints
A small `public` surface needs no bearer token, guarded instead by other means. This includes the token-broker endpoints a backend service uses to obtain a Cozy Stack token for a user's instance. Those are documented in detail in [Service Tokens](../cozy-stack/service-tokens.md).
:::

## The API surface

Endpoints are grouped by version and area. Every provisioning call (create, delete, recreate) returns a **workflow id** that the caller polls.

### Instances (v1)

The core CRUD for Cozy instances:

| Operation | Endpoint |
| --- | --- |
| Create an instance (offer, email, slug, domain, OAuth, connectors, ToS) | `POST /api/v1/instances` |
| Fetch an instance | `GET /api/v1/instances/{uuid}` |
| Update settings (email, locale, public name…) | `PATCH /api/v1/instances/{uuid}` |
| Delete (optionally scheduled) | `DELETE /api/v1/instances/{uuid}` |
| Recreate | `POST /api/v1/instances/{uuid}/recreate` |
| Resend the activation email | `POST /api/v1/instances/{uuid}/resend` |
| Block / unblock | `POST /api/v1/instances/{uuid}/block` |
| Grant free quota (voucher) | `POST /api/v1/instances/{uuid}/voucher` |
| Toggle premium capability | `POST /api/v1/instances/{uuid}/premium` |
| Set feature flags | `PATCH /api/v1/instances/{uuid}/features` |

Creation is gated on the partner's `creation_enabled?`. There is also a **pre-creation** family (`GET/POST/DELETE /api/v1/instances/precreate`) that manages the pool of blank stock instances.

### Workflows

| Operation | Endpoint |
| --- | --- |
| Workflow status and per-job detail | `GET /api/v1/workflows/{uuid}` |
| Restart a failed workflow | `POST /api/v1/workflows/{uuid}/continue` |

### Features and plans

| Operation | Endpoint |
| --- | --- |
| Merged feature flags for a set of plans | `GET /api/v1/features` |
| Search instances by feature flags | `GET /api/v1/features/instances` |
| Plan details | `GET /api/v1/plans/{uuid}` |

### Admin

| Operation | Endpoint |
| --- | --- |
| Global creation on/off switch (admin partner only) | `POST /api/v1/admin/creation/toggle` |

### v2

The v2 API adds richer search and B2B organization support:

| Operation | Endpoint |
| --- | --- |
| Search / list instances (filter + pagination) | `GET /api/v2/instances` |
| Single instance | `GET /api/v2/instances/{uuid}` |
| Workflows for an instance | `GET /api/v2/instances/{uuid}/workflows` |
| Organization endpoints (B2B) | `POST/PATCH /api/v2/organizations` |

:::warning Reference may lead the code
The published reference reflects the production API and may include endpoints newer than any given checkout (the v2 organization and some `public` endpoints, for instance). When code and reference disagree, verify against the deployment you are targeting.
:::

### Conventions

- **Pagination**: `skip` (default 0) and `limit` (default 1000, capped at `MAX_PAGING_LIMIT`). List responses return `{ limit, skip, count, items }`.
- **Errors**: failures return JSON with a message; Mongoid errors are surfaced as structured 500s.
- **Format**: JSON in and out.

## Outgoing webhooks

The Cloudery notifies partners of instance lifecycle events through **signed HTTP webhooks**. A partner configures a `url`, an Ed25519 signing key, and an `events` allowlist in its `Partner::Webhook` config.

### Events

| Event | Fires when | Data |
| --- | --- | --- |
| `instance.created` | An instance is created | `uuid`, `fqdn` |
| `instance.activated` | A user activates their instance | `uuid`, `fqdn` |
| `instance.deleted` | An instance is deleted | `uuid`, `fqdn`, `destroyed` |

The payload is wrapped as `{ id: "evt_<uuid>", type, data }`.

### Signatures

Each delivery carries a `Cloudery-Signature` header:

```
Cloudery-Signature: t=1622106563,v1=<hex ed25519 signature>
```

The signed message is `"<timestamp>.<json body>"`, signed with the partner's Ed25519 key. Verify it with the corresponding public key, and reject messages whose timestamp is older than 300 seconds to defend against replays. `doc/webhook.md` in the repo carries copy-paste verification snippets in Python and Ruby.

### Delivery and retries

Delivery is a Sidekiq job on the `low` queue. A non-2xx response raises and Sidekiq retries with exponential backoff, stopping after too many failures. Every attempt is recorded as an embedded log on the `Webhook` record.

:::note About RabbitMQ
Within this repository, partner notification is done with the signed HTTP webhooks above; there is no RabbitMQ publish/consume code (`config/rabbitmq.yml` is unused scaffolding). In the **Twake Workplace deployment**, the Cloudery additionally participates in the platform RabbitMQ event bus (`user.created`, `workplace.created`, `subscription.changed` and friends). That bridge is a deployment-level integration; see [RabbitMQ](../overview/rabbitmq.md) and [B2B org & instance creation](../b2b/org-creation.md) for the Twake side.
:::

## Operator CLIs

Two families of command-line tools ship in `bin/`.

### `bin/cli.rb`, the operator CLI

Runs inside the app (via `rails runner`) and operates directly on models. The everyday commands:

| Command | Purpose |
| --- | --- |
| `show <fqdn>` | Instance details plus its workflows (ASCII overview). |
| `delete <fqdn>` | Delete instances (`--destroy`, `--force`, `--user-request`). |
| `recreate <fqdn>` | Recreate (optionally destroy first, with a delay). |
| `fix-email <old> <new>` | Change an instance's email (`--resend` to re-send activation). |
| `resend-email <fqdn\|email>` | Resend activation emails. |
| `gift <fqdn>` | Grant free quota (default 995 GB). |
| `premium <fqdn>` | Bulk enable/disable premium. |
| `new-tos-version <version>` | Publish a new ToS version. |
| `invoices` | Export the previous month's Stripe invoice PDFs. |
| `process_deletion` | Delete instances whose scheduled deletion date has passed. |
| `maintain_factory_stock <schedule>` | Top up the pre-creation pool. |
| `check_pending` | Alert on instances stuck creating or deleting. |

### `bin/api.rb` and `bin/api.py`, API client CLIs

Thin OAuth-authenticated HTTP clients against the API (using `API_ENDPOINT` and `OAUTH_TOKEN`), available in Ruby and Python. They cover the operator basics: toggle creation, `show`, `delete`, and `recreate` an instance.

Other useful scripts include `bin/create-token.rb` (mint an API token), `bin/init-stripe.rb` / `bin/stripe-cli.rb` (Stripe management), and one-off maintenance scripts under `bin/fix/`.
