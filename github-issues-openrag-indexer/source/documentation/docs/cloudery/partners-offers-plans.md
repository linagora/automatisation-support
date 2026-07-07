---
title: Partners, offers & plans
sidebar_position: 4
---

# Partners, offers & plans

This is the configuration heart of the Cloudery. A **partner** decides *who* can create instances; an **offer** decides *what* gets provisioned; a **plan** decides *what it costs and unlocks*. This page explains each, how they are defined, and how they are loaded.

## Partners

A partner is an entity allowed to create instances. The set of partners in the codebase spans Cozy's own consumer product, Linagora's B2B product, and several French public-sector deployments:

| Slug | Who | Notable trait |
| --- | --- | --- |
| `cozy` | Cozy's own B2C product | The admin partner. Stripe premium enabled. |
| `linagora` | Twake Workplace B2B | B2B offer, own-domain instances, tiered pricing. |
| `grdlyon` | Grand Lyon (metropolis) | OIDC / FranceConnect login, custom theme, three product offers. |
| `ac-rennes` | Académie de Rennes (education) | OIDC via Toutatice; offer chosen from OIDC claims. |
| `alpesmaritimes`, `cemea`, `centrevaldeloire`, `edoc`, `larochelle`, `noisylegrand`, `tracemob` | Other public-sector / partner deployments | Mostly a single free offer. |

A partner record carries the fields that shape onboarding and provisioning: `default_domain`, `default_offer`, `offers`, `domains`, `theme`, `favicons`, `onboarding` (the ordered step names), `constraints`, `login_redirect`, and a free-form `config` hash for things like OIDC settings.

:::tip Reading partner config at runtime
Partner-specific settings (OIDC scopes, magic-link config, postcode restrictions…) are dug out of the `config` hash with `partner[:oidc, :scope]` or `partner.fetch(...)`. This is how the partner controllers stay generic.
:::

## Offers

An offer is the provisioning template applied when an instance is created. Its fields describe the instance to build: which `apps` and `konnectors` to install, the storage `quota`, the `locale`, any `webhooks` and `links`, and a `settings` hash that names the **Stack context** to use.

The context (defined on the Stack side in `cozy.yml`, not in the Cloudery) determines the available applications, the mail configuration, and the onboarding behavior. One offer uses exactly one context.

Examples from the seed data:

- `cozy_beta`, the main consumer offer (home, settings, store; context `cozy_beta`).
- `b2b_twake_default`, the Twake Workplace B2B offer (`b2b: true`, apps home/mail/chat, own domain).
- `grdlyon_ecolyo`, `grdlyon_mespapiers`, Grand Lyon offers that each install a different flagship app.
- `acrennes_cozy_exp_ens` / `_agt` / `_ele`, Académie de Rennes offers for teachers, staff, and pupils, each installing the Toutatice connector.

## Plans and pricing

Plans are priced tiers owned by a partner. The free tier and the premium tiers are all `Plan` records; what separates them is the pricing data.

### The `currencies` hash

A plan's price lives in its `currencies` hash, keyed by currency code (only `:eur` is used today). Each entry looks like:

```yaml
eur:
  id: price_1NVAFxFUvgWs6FSe2HVyBUwF   # the Stripe price id
  price: 1000                          # cents, before tax
  tax: 20                              # percent
  interval: month
```

The displayed price is computed tax-inclusive (`price * (1 + tax/100)`). The Stripe **price id** in `id` is what the subscription code sends to Stripe; a partner can also resolve a plan *from* a Stripe id, which is handy when reconciling webhooks.

### The Cozy plan catalog

The consumer catalog (`db/plans/cozy.yml`) runs:

- **Discover**, free, 5 GB (the default tier).
- **Standard**, monthly / yearly, 50 GB.
- **Premium**, monthly / yearly, 1 TB, plus features like Office documents, unlimited mail, and password-sharing for organizations.
- Legacy `comfort` / `super_comfort` tiers, kept for existing subscribers but hidden from new subscriptions.

Public-sector partners typically ship a single free `default` plan with no `currencies` block at all.

:::warning Free tier naming caveat
The `Plan#standard?` / `premium?` predicates key off the slug `standard`, but the seed data marks the **free** tier with the slug `default` and `price: 0`. In practice, "is this free?" is expressed in the data via `default: true` / `price: 0`, and `available_for_subscription: false` hides retired plans from new checkouts. Don't assume the slug alone tells you whether a plan is free.
:::

### B2C vs B2B

Whether a deployment is B2B is an **offer**-level flag (`b2b: true`), not a plan flag. B2B (Linagora) uses own-domain instances and, for tax, applies reverse-charge (no VAT line). The consumer partner `cozy` is the B2C path.

## Features

"Feature" in the Cloudery means something specific: a **typed, mergeable capability definition**, catalogued in `db/features.yml`. It is a schema and a reducer, not a value.

Each feature declares a `type` (`string`, `numeric`, `bool`, `size`, `list`, `hash`) and a merge `op` (`or`, `and`, `min`, `max`, `sum`, `first`, `last`, `merge`, `concat`). When a feature's value can come from several sources (a plan, a voucher, an offer), the op says how to combine them deterministically:

| Feature | Type / op | Meaning |
| --- | --- | --- |
| `quota` | size / sum | Storage adds up across sources. |
| `oo.enabled` | bool / or | OnlyOffice on if any source enables it. |
| `drive.office` | hash / last | Office config; last source wins. |
| `mespapiers.papers.max` | numeric / last | Document cap (`-1` = unlimited on paid plans). |
| `mail` | hash / last | Twake Mail limits. |

An instance stores a resolved `features` hash. When it changes, the delta is pushed to the Stack (`change_features`), so features are the mechanism by which a plan change actually turns capabilities on and off in the user's Cozy.

:::note Two kinds of "feature flag"
Don't confuse a **Feature** (a mergeable capability from `db/features.yml`, applied to instances) with a **Flipper flag** (`:stripe`, `:stripe_creation`, `:cozy_login`), which is a boolean toggle for the *application itself*, seeded from environment variables and managed at `/admin/flipper`.
:::

## Vouchers

A voucher is a redeemable code entered during onboarding (the "code promo"). It is a Mongo document keyed by the human-readable code, carrying a `settings` hash. In practice its only effect is a storage bonus: at creation the voucher's `quota` is layered into the instance's quota details.

```ruby
# create a voucher from the Rails console
Voucher['WELCOME2026'] = { quota: '10GB' }
```

:::caution No Stripe coupons
Vouchers are entirely outside Stripe. They grant extra storage, not a discount on a paid subscription. There is no coupon / discount support in the premium checkout.
:::

## How configuration is loaded

Partner, offer, plan, stack, and feature definitions are **not** authored in this repository's canonical form. They live in a separate config repo (`gitlab.cozycloud.cc/cloudery/config`), whose `backend-cozy/*` contents are copied into `db/` before seeding. The `db/*.template.yml` files document the schema; the sample `db/{partners,offers,plans,stacks}/*.yml` files are development fixtures.

Seeding (`db/seeds.rb`, run by `rails db:setup`) does, in order:

1. Set global `Config` keys (blacklist, excluded partners, creation enabled, HA counter).
2. Load the **Feature** catalog from `db/features.yml`.
3. Create one **Stack**, **Offer**, and **Partner** record per YAML file in the matching folder (the filename becomes the `_id`).
4. Linearize partner domains (Mongoid can't store `.` in hash keys).
5. Load **Plans** from `db/plans/<partner>.yml`, validating each plan's features against the Feature catalog.

:::warning Seeding is a full reset
`Seeder.create_from_folder` does a `delete_all` before recreating records. Re-seeding partners wipes and rebuilds the whole partner set. And note a production Mongoid quirk: embedded sub-documents (like `stripe`) can silently fail to persist on a normal update, sometimes requiring a raw collection write. Be deliberate when changing partner config in a live environment.
:::

## Instance creation gating

Two `Config` keys gate whether new instances can be created at all: a global `creation.enabled` and a per-partner `<partner>.creation.enabled`. Both are checked by `Partner#creation_enabled?`, and the global switch can be flipped by an admin through `POST /api/v1/admin/creation/toggle`.
