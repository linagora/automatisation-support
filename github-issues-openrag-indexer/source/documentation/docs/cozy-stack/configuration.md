---
title: Configuration
sidebar_position: 4
---

## Configuration file

Cozy Stack is configured via a YAML file (`cozy.yaml`). The file is loaded from the first match of:

1. `./.cozy/cozy.yaml`
2. `$HOME/.cozy/cozy.yaml`
3. `/etc/cozy/cozy.yaml`
4. Path specified with `--config` flag

A `.local` suffix override (e.g., `cozy.local.yaml`) is also supported for environment-specific settings. Environment variables can be interpolated using `{{ .Env.VAR_NAME }}` syntax.

## Key configuration sections

### Server

```yaml
host: 0.0.0.0
port: 8080
subdomains: flat # or "nested"
```

The `subdomains` setting controls how applications are routed:

- **flat**: `<instance>-<app>.<domain>` (production)
- **nested**: `<app>.<instance>.<domain>` (local development)

### CouchDB

```yaml
couchdb:
  url: http://localhost:5984/
```

For large deployments, multiple CouchDB clusters can be configured for sharding instances across clusters.

### File storage

```yaml
fs:
  url: file:///var/lib/cozy/storage
  # or: swift://openstack
  default_layout: 2
```

Supports local filesystem or OpenStack Swift. The `default_layout` controls how files are organized on disk (layout 2 or 3).

### Redis

```yaml
cache_storage:
  url: redis://localhost:6379/0

sessions:
  url: redis://localhost:6379/1

downloads:
  url: redis://localhost:6379/2

jobs:
  url: redis://localhost:6379/3
```

Redis is optional for single-node deployments. Without it, the stack uses in-memory storage for sessions, locks, and job queues. Redis is required for multi-node deployments to share state.

### Admin API

```yaml
admin:
  host: localhost
  port: 6060
  secret_filename: /etc/cozy/cozy-admin-passphrase
```

The admin API is protected by a passphrase stored in a file. It should only be accessible from the server itself, not exposed to the network.

### Vault

```yaml
vault:
  credentials_encryptor_key: /etc/cozy/vault.enc
  credentials_decryptor_key: /etc/cozy/vault.dec
```

Used for encrypting konnector credentials and other sensitive data stored in CouchDB.

### Office integration

```yaml
office:
  default:
    onlyoffice_url: https://onlyoffice.example.com
    onlyoffice_inbox_secret: secret
    onlyoffice_outbox_secret: secret
```

Configures the OnlyOffice integration for collaborative document editing.

## Deployment

### Prerequisites

- **CouchDB** 3.x (required)
- **Redis** (optional, required for multi-node)
- **Reverse proxy** (Nginx, Traefik, etc.) for TLS termination and subdomain routing

### Instance creation

After starting the stack, create user instances via the admin API or CLI:

```bash
cozy-stack instances add \
  --host 0.0.0.0 \
  --apps home,drive,settings,contacts \
  --passphrase mypassword \
  alice.twake.app
```

Each instance is created with its own CouchDB databases and file storage directory.

### CLI

The `cozy-stack` binary includes a comprehensive CLI built with Cobra:

```bash
cozy-stack serve        # Start the HTTP server
cozy-stack instances    # Manage instances
cozy-stack apps         # Manage applications
cozy-stack jobs         # Manage background jobs
cozy-stack config       # Show resolved configuration
cozy-stack check        # Run health checks
cozy-stack status       # Show server status
```

For the full configuration reference, see the [upstream config documentation](https://docs.cozy.io/en/cozy-stack/config/).
