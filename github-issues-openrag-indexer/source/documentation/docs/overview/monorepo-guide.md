---
title: Monorepo Guide
---

Twake Workplace is organized as a monorepo with independent services. Each service has its own `package.json`, dependencies, and build process.

## Repository Layout

```
twake-workplace/
  registration/            # SvelteKit - user signup and account management
  admin-panel-backend/     # Express.js - admin API gateway
  twake-ldap-rest/         # Node.js - REST API over OpenLDAP
  dashboard/               # SvelteKit - platform metrics
  b2b-ldap-contacts-sync/  # Node.js - syncs LDAP org users as contacts into Cozy instances
  scripts/                 # Migration utilities
  documentation/           # This documentation site (Docusaurus)
  e2e/                     # End-to-end tests
  docker-compose.yml       # Full platform orchestration
  .env.example             # Environment variable template
  .github/workflows/       # CI/CD pipelines
```

**Note:** The admin panel frontend ([cozy-admin](https://github.com/linagora/cozy-admin)) lives in a separate repository.

## Working with Services

Each service is independent. There is no shared `node_modules` or workspace-level package manager.

### Running a single service for development

```bash
# 1. Start infrastructure dependencies
docker compose up -d openldap auth auth-db ldap-rest rabbitmq

# 2. Navigate to the service
cd registration

# 3. Install dependencies
npm install

# 4. Start the dev server
npm run dev
```

### Service-specific setup

Each service has its own development page with detailed instructions:

| Service                                                                                                                                | Stack                  | Test Command    | Port (dev) |
| -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | --------------- | ---------- |
| [Registration](https://github.com/linagora/twake-workplace-private/blob/main/registration/docs/development.md)                         | SvelteKit + PostgreSQL | `npm test`      | 3000       |
| [Admin Panel Backend](https://github.com/linagora/twake-workplace-private/blob/main/admin-panel-backend/docs/development.md)           | Express + PostgreSQL   | `npm test`      | 8081       |
| [LDAP REST](https://github.com/linagora/twake-workplace-private/blob/main/twake-ldap-rest/docs/development/getting-started.md)         | ldap-rest framework    | `npm test`      | 3399       |
| [Dashboard](https://github.com/linagora/twake-workplace-private/blob/main/dashboard/docs/development.md)                               | SvelteKit (no DB)      | `npm run check` | 5173       |

### Common commands

Most services share these scripts, but not every service defines all of them. Check the service's `package.json` for the exact set.

```bash
npm run dev       # Start development server
npm run build     # Production build
npm test          # Run tests
npm run lint      # Lint check
npm run format    # Format code
npm run check     # Type check
```

Notable exceptions: `admin-panel-backend` only defines `build`, `build:dev`, and `test` (no `dev`/`lint`/`format`/`check`), and `twake-ldap-rest` has no `dev` (use `watch` / `start`).

## Docker vs Native Development

**Docker Compose** (`docker compose up -d`) runs the entire platform. Use this to:
- Verify end-to-end flows
- Test service interactions
- Run the platform as an operator would

**Native development** (run one service with `npm run dev`) is faster for iterating on a single service. Infrastructure dependencies (OpenLDAP, PostgreSQL, RabbitMQ) still run in Docker.

## Environment Configuration

1. Copy the template: `cp .env.example .env`
2. The defaults work for local development with Docker Compose
3. Each service reads its own subset of variables from the shared `.env` file
4. For native development, services may also have their own `.env.example` with service-specific defaults

See [Local Dev with Docker](/overview/docker-compose) for the complete environment variable reference.

## Documentation Site

The documentation site has its own `docker-compose.yml` in the `documentation/` directory, separate from the platform services.

```bash
cd documentation

# Run without authentication
docker compose up -d
# -> http://localhost:4000

# Run with OIDC authentication
cp .env.example .env
# Edit .env with your OIDC provider details
docker compose --profile auth up -d
```

When the `auth` profile is active, [OAuth2 Proxy](https://oauth2-proxy.github.io/oauth2-proxy/) sits in front of the static site and requires OIDC login. Without the profile, docs are served openly.

| Variable | Description |
|----------|-------------|
| `OIDC_ISSUER` | OIDC provider URL (e.g., `http://auth.example.com`) |
| `OIDC_CLIENT_ID` | Client ID registered in the OIDC provider |
| `OIDC_CLIENT_SECRET` | Client secret |
| `OIDC_REDIRECT_URI` | Callback URL (default: `http://localhost:4000/oauth2/callback`) |
| `SESSION_SECRET` | Cookie encryption key (32+ characters) |

For development without Docker:

```bash
cd documentation
npm install
npm start        # Dev server at http://localhost:3000
npm run build    # Production build
npm run serve    # Serve production build
```
