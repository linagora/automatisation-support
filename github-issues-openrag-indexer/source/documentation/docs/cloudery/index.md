---
title: Cloudery
sidebar_position: 1
---

# Cloudery

The **Cloudery** (codename *cozy-manager*, repository `backend-cozy`) is Cozy's provisioning and billing service. It is the control plane that creates, activates, bills, and deletes **Cozy instances**, the per-user personal clouds served by [Cozy Stack](../cozy-stack/).

Every time Twake Workplace needs a Cozy instance created, a plan changed, or an instance deleted, it talks to the Cloudery. The Cloudery translates that request into the right sequence of calls against the Cozy Stack admin API, tracks the result, and notifies interested parties.

:::info Where it lives
The Cloudery is a Cozy component, not part of the Twake Workplace monorepo. Its source lives on Cozy's GitLab (`gitlab.cozycloud.cc/cloudery/backend-cozy`) and runs on Cozy infrastructure, reached from Twake over HTTPS and an IP-whitelisted RabbitMQ bridge. See [Environments](../overview/environments.md) for per-environment hostnames (`manager.cozycloud.cc` in production).
:::

## What it does

- **Provisions Cozy instances** on the right Stack cluster, with the right apps, connectors, storage quota, and settings, driven by a per-partner **offer**.
- **Runs onboarding** for end users and partners: the multi-step signup wizard, email activation, and partner-specific OIDC / SSO flows.
- **Bills premium subscriptions** through Stripe: free-to-premium upgrades, plan changes, card updates, cancellation, and dunning.
- **Exposes an HTTP API** so partners (including Twake Registration) can create, inspect, and delete instances, and poll the long-running workflows behind those actions.
- **Notifies partners** of lifecycle events (`instance.created`, `instance.activated`, `instance.deleted`) through signed outgoing webhooks.

## The mental model

Four concepts carry most of the system. Everything else hangs off them.

| Concept | One-liner |
| --- | --- |
| **Partner** | An entity allowed to create instances (`cozy`, `linagora`, `grdlyon`, `ac-rennes`…). Owns its offers, plans, theming, and billing config. |
| **Offer** | A template for *what to provision*: apps, connectors, quota, Stack context. One offer maps to exactly one Stack context. |
| **Plan** | A priced subscription tier belonging to a partner (free `default`, `standard`, `premium`…). Carries Stripe price ids. |
| **Instance** | A single provisioned Cozy (one user's cloud). Belongs to one partner, one offer, one account, and zero-or-more plans. |

A **partner** offers one or more **offers**; a user onboards onto an offer, which provisions an **instance**; if the user pays, the instance subscribes to one of the partner's premium **plans**. See [Data model](./data-model.md) for the full picture and [Partners, offers & plans](./partners-offers-plans.md) for how they are configured.

## Technology at a glance

| Layer | Choice |
| --- | --- |
| Web framework | Ruby on Rails 5.2 (Ruby 2.7) |
| Database | MongoDB via Mongoid (no ActiveRecord) |
| Background jobs | Sidekiq + `sidekiq-workflow` (DAG orchestration) |
| Cache / locks / sessions | Redis (Sidekiq queues, Redlock, session + temp store) |
| Frontend | Webpacker 5, React 17, Bootstrap 5, SCSS |
| Billing | Stripe (Ruby `stripe` gem) |
| Errors / metrics | Sentry, Prometheus exporter, Flipper feature flags |

## Where to go next

- **[Architecture](./architecture.md)**, the runtime, how work is orchestrated, and how the Cloudery talks to the Cozy Stack.
- **[Data model](./data-model.md)**, the MongoDB collections and how they relate.
- **[Partners, offers & plans](./partners-offers-plans.md)**, configuration, pricing, features, and vouchers.
- **[Onboarding & instance lifecycle](./onboarding.md)**, signup flows and instance states.
- **[Billing & Stripe](./billing.md)**, premium subscriptions end to end.
- **[API, webhooks & CLI](./api.md)**, the HTTP surface and operator tooling.
- **[Local development](./local-development.md)**, run it on your machine.
