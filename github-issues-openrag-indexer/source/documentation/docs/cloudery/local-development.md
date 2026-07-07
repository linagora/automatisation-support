---
title: Local development
sidebar_position: 8
---

# Local development

The Cloudery runs on Ruby 2.7 with MongoDB and Redis. You can supply those datastores with Docker and run the app on your host, or run everything in containers. Both end with the app on `http://localhost:3000`.

## Prerequisites

The app needs **MongoDB** and **Redis**. To provision instances end to end you also need a reachable **Cozy Stack** (its admin API); to exercise billing you need **Stripe** test keys. For most feature work, Mongo + Redis is enough.

## Datastores with Docker Compose

The committed `docker-compose.yml` provides the datastores (and a `ruby` image for running commands without a host toolchain):

```bash
docker compose up -d mongo redis
```

- `mongo` and `redis`, the databases.
- `ruby`, a Cozy Ruby image with the repo mounted, handy for running Rails commands, Sidekiq, or the test suite in a container.

:::tip Fully-containerized loop
Docker Compose automatically merges a `docker-compose.override.yml` if one is present, which is a common way to add a dedicated `app` web service and run the whole loop with `docker compose up app`. That override is a local convenience and is **not** part of the repository, so create your own if you want it.
:::

## Running the app

Following the README's host-based flow (with Ruby 2.7 via rbenv and Bundler installed):

```bash
bundle install --deployment
bundle exec rails db:setup     # seed partners, offers, plans, features
yarn                           # install JS deps
bundle exec guard -i           # run the Rails server with livereload (http://localhost:3000)
```

Run Sidekiq separately when you need background jobs to execute (instance creation, emails). It needs `COZY_ADMIN_PASSWORD` set to talk to the Stack:

```bash
bundle exec rerun --dir app,config -- sidekiq
```

:::note Config repo
Partner, offer, plan, and stack definitions come from a separate config repo (`gitlab.cozycloud.cc/cloudery/config`), copied into `db/` before `db:setup`. The `db/*.yml` fixtures in this repo are enough for development. See [Partners, offers & plans](./partners-offers-plans.md#how-configuration-is-loaded).
:::

## Configuration and secrets

Environment is loaded by `dotenv-rails` from three tracked files, with secrets in a git-ignored local override:

| File | Role |
| --- | --- |
| `.env.template` | Documented reference of every variable (also the prod template). |
| `.env.development` | Development defaults (port 3000, Redis DBs, Stripe API version…). |
| `.env.test` | Test settings (compose service hostnames). |
| `.env.development.local` | **Git-ignored.** Your secrets: `SECRET_KEY_BASE`, Stripe test keys, local overrides. |

Generate the secret key once and drop it in the local file:

```bash
bundle exec rake secret   # copy into .env.development.local as SECRET_KEY_BASE=...
echo 'PROMETHEUS_DISABLE=true' >> .env.development.local   # quiet the metrics exporter
```

The variables worth knowing, grouped:

| Group | Variables |
| --- | --- |
| Data stores | `MONGO_URL`, `MONGO_POOL_*`, `REDIS_URL` (Sidekiq/locks), `TMP_REDIS_URL` (sessions/temp) |
| App | `APPLICATION_PROTOCOL/HOST/PORT` (builds email URLs), `RAILS_PORT`, `RAILS_WORKERS`, `SECRET_KEY_BASE` |
| Cozy Stack | `COZY_ADMIN_PASSWORD` and the Stack URLs (from the `Stack` records) |
| Stripe | `STRIPE_ENABLED`, `STRIPE_CREATION`, `STRIPE_API_VERSION`, `STRIPE_PUBLIC_KEY`, `STRIPE_PRIVATE_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Mail | `POSTMARK_TOKEN_TRANSAC`, `MAILJET_*`, `MAILCHIMP_*`, `SMTP_URL`, `SMTP_FROM` |
| Ops | `SENTRY_DSN`, `PROMETHEUS_DISABLE`, `PROMETHEUS_EXPORTER_*` |
| Directory | `ADMIN_LDAP_*` (admin LDAP lookups) |

:::note Stripe keys are read at boot
The app loads Stripe keys into Rails at startup. After changing them, restart the app process. `.env.development.local` is loaded into Rails, not into the container shell, so to call Stripe from a shell inside a container you must `source` that file first.
:::

## Frontend build

The frontend is **Webpacker 5** (React 17 + Bootstrap 5 + SCSS), with entry packs for onboarding, waiting, and error pages.

```bash
yarn                    # install
bin/webpack             # one-off compile
yarn start              # bin/webpack-dev-server with HMR
yarn lint               # eslint
```

SCSS lives under `app/javascript/styles/` (`application.scss` importing `_premium.scss`, `_onboarding.scss`).

:::warning Packs are not content-hashed
Compiled packs keep stable filenames, so browsers happily serve **stale** CSS/JS after a rebuild. When verifying a style change, hard-reload or cache-bust the stylesheet link, otherwise you will be looking at the old bundle.
:::

## Testing

Tests are **RSpec** (with WebMock and `Sidekiq::Testing.fake!`), plus TestCafé for the JS side.

```bash
RAILS_ENV=test bin/rspec                 # full suite
RAILS_ENV=test bin/rspec spec/models/instance_spec.rb
yarn test                                # TestCafé (Firefox)
```

:::danger Always run specs with `RAILS_ENV=test`
The Mongo database name is `cloudery_cozy_<env>`. If you run the suite in **development** mode, it points at your development database and the specs **truncate it**, wiping local instances and demo data. Setting `RAILS_ENV=test` (what `.env.test` is for) keeps the suite on its own database. This has bitten people repeatedly, especially when a containerized `app` service defaults to `RAILS_ENV=development`.
:::

Specs are organized under `spec/` by type: `controllers/` (with `api/v1`, `cozy`), `models/`, `jobs/`, `mailers/`, `requests/`, and `workflows/`. An HTML report is written to `tmp/rspec.html`.

## CI/CD and packaging

CI runs on **Jenkins** (two pipelines: a default image and a `buster` variant). Each pipeline:

1. Runs the RSpec suite in a container.
2. Builds a Debian package (`cloudery-backend-cozy`) and regenerates the API docs (Redoc) from `doc/api.yaml`.
3. Archives artifacts, publishes the `.deb` to the internal APT repo, and pushes the API docs.
4. On success, tags the commit and pings Mattermost.

Production runs the package under **systemd** as three services: Puma (web), Sidekiq (workers), and the Prometheus exporter, deployed to `/opt/cloudery/backend/cozy/`.

:::note Where the code lives
The Cloudery is hosted on Cozy's GitLab (`gitlab.cozycloud.cc/cloudery/backend-cozy`), not the Twake Workplace monorepo, so its pipeline is Jenkins-based rather than the GitHub Actions used elsewhere in Twake. See [Environments](../overview/environments.md) for deployed hostnames.
:::
