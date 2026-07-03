---
title: Getting Started
---

Run the full Twake Workplace platform locally using Docker Compose.

## Prerequisites

- Docker and Docker Compose
- At least 4 GB of available RAM

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/linagora/twake-workplace-private.git
cd twake-workplace-private
```

### 2. Configure environment

```bash
cp .env.example .env
```

The default `.env` works for local development with no changes needed.

### 3. Configure local DNS

Add to your `/etc/hosts` file:

```
127.0.0.1 example.com auth.example.com signup.example.com admin-panel-backend.example.com ldap-rest.example.com dashboard.example.com docs.example.com
```

### 4. Start the platform

```bash
docker compose up -d
```

Wait for all services to become healthy:

```bash
docker compose ps
```

### 5. Seed test data (optional)

```bash
docker compose --profile seed up seed
```

This creates sample organizations and users for testing.

## Access Points

| Service | URL | Credentials |
|---------|-----|-------------|
| Registration | http://signup.example.com | - |
| SSO Portal | http://auth.example.com | - |
| Admin Panel Backend | http://admin-panel-backend.example.com | - |
| Dashboard | http://dashboard.example.com | - |
| phpLDAPadmin | http://localhost:6443 | `cn=admin,dc=twake,dc=test` / `admin` |
| RabbitMQ | http://localhost:15672 | `admin` / `admin` |
| PostgreSQL (registration) | localhost:5432 | See `.env` |
| PostgreSQL (admin panel) | localhost:5434 | See `.env` |
| PostgreSQL (auth) | localhost:5433 | See `.env` |
| OpenLDAP | ldap://localhost:3389 | `cn=admin,dc=twake,dc=test` / `admin` |

## Stopping

```bash
docker compose down       # Stop services, keep data
docker compose down -v    # Stop services, delete data
```

## Next Steps

- [Architecture](./architecture) - how services communicate
- [Docker Compose Reference](./docker-compose) - detailed service configuration
- [Authentication](./authentication) - auth patterns across services
