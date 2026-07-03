---
title: API
sidebar_position: 3
---

## Overview

Cozy Stack exposes a REST API following the [JSON-API](https://jsonapi.org/) specification. All authenticated endpoints require either a session cookie (for web apps) or a Bearer token (for OAuth2 clients).

The API runs on the main HTTP server (default port 8080). A separate admin API runs on port 6060 for instance management.

## Authentication

Three authentication methods are supported:

| Method      | Use case                                                | Mechanism                                       |
| ----------- | ------------------------------------------------------- | ----------------------------------------------- |
| **Session** | Web apps served by the stack                            | Cookie-based, created on login at `/auth/login` |
| **OAuth2**  | Mobile apps, desktop clients, third-party integrations  | Authorization code flow, Bearer token           |
| **OIDC**    | Delegated authentication to external identity providers | Redirects to the configured OIDC provider       |

Web applications receive a JWT token injected into their HTML at serve time. They use this token for API calls. OAuth2 clients go through a standard authorization code flow with dynamic client registration.

## Permissions

Every API request is checked against the caller's permissions. Permissions are defined as rules with:

- **Type**: the doctype being accessed (e.g., `io.cozy.files`)
- **Verbs**: allowed HTTP methods (`GET`, `POST`, `PUT`, `DELETE`, or `ALL`)
- **Values**: optional restriction to specific document IDs
- **Selector**: optional field-based scoping

Web apps declare their required permissions in `manifest.webapp`. OAuth2 clients request permissions via the `scope` parameter during authorization.

## Key endpoint groups

### Data System (`/data`)

CouchDB-style document operations with permission enforcement.

| Endpoint                   | Description          |
| -------------------------- | -------------------- |
| `GET /data/:type/:id`      | Fetch a document     |
| `POST /data/:type/`        | Create a document    |
| `PUT /data/:type/:id`      | Update a document    |
| `DELETE /data/:type/:id`   | Delete a document    |
| `POST /data/:type/_find`   | Mango query          |
| `POST /data/:type/_index`  | Create an index      |
| `GET /data/:type/_changes` | CouchDB changes feed |

### Files (`/files`)

Virtual File System operations.

| Endpoint                       | Description                         |
| ------------------------------ | ----------------------------------- |
| `POST /files/:dir-id`          | Upload a file or create a directory |
| `GET /files/:file-id`          | Get file metadata                   |
| `GET /files/download/:file-id` | Download file content               |
| `PUT /files/:file-id`          | Update file metadata                |
| `DELETE /files/:file-id`       | Move to trash                       |
| `POST /files/trash/:file-id`   | Restore from trash                  |

### Applications (`/apps`)

| Endpoint             | Description                 |
| -------------------- | --------------------------- |
| `POST /apps/:slug`   | Install an application      |
| `PUT /apps/:slug`    | Update an application       |
| `DELETE /apps/:slug` | Uninstall an application    |
| `GET /apps/`         | List installed applications |

### Jobs (`/jobs`)

| Endpoint                   | Description      |
| -------------------------- | ---------------- |
| `POST /jobs/queue/:worker` | Enqueue a job    |
| `GET /jobs/:job-id`        | Get job status   |
| `POST /jobs/triggers`      | Create a trigger |
| `GET /jobs/triggers`       | List triggers    |

### Sharing (`/sharings`)

| Endpoint                                 | Description           |
| ---------------------------------------- | --------------------- |
| `POST /sharings/`                        | Create a sharing      |
| `POST /sharings/:id/recipients`          | Add recipients        |
| `DELETE /sharings/:id/recipients/:index` | Revoke a recipient    |
| `DELETE /sharings/:id`                   | Revoke entire sharing |

### Other services

| Path                | Service                                          |
| ------------------- | ------------------------------------------------ |
| `/auth`             | Authentication and OAuth flows                   |
| `/accounts`         | External account OAuth integration               |
| `/ai`               | AI chat completion and RAG                       |
| `/bitwarden`        | Password manager integration                     |
| `/contacts`         | Contact management                               |
| `/intents`          | Inter-application communication                  |
| `/konnectors`       | Data connector management (install, run, update) |
| `/move`             | Instance migration, export, and import           |
| `/notes`            | Collaborative note editing                       |
| `/notifications`    | User notifications and push                      |
| `/office`           | OnlyOffice collaborative editing                 |
| `/oidc`             | OpenID Connect delegated authentication          |
| `/permissions`      | Permission management and token creation         |
| `/public`           | Public pages and unauthenticated endpoints       |
| `/realtime`         | WebSocket endpoint for live updates              |
| `/registry`         | Application registry and marketplace             |
| `/remote`           | Proxy for remote data sources (NextCloud)        |
| `/settings`         | Instance and user settings                       |
| `/shortcuts`        | URL shortcut file management                     |
| `/.well-known`      | Standard well-known URIs                         |
| `/connection_check` | Connectivity verification                        |
| `/status`           | Health check and CouchDB connectivity            |

## Admin API

The admin API runs on a separate port (default 6060) and is protected by a passphrase file. It provides instance management operations:

| Endpoint                    | Description              |
| --------------------------- | ------------------------ |
| `POST /instances/`          | Create a new instance    |
| `GET /instances/:domain`    | Get instance details     |
| `PATCH /instances/:domain`  | Update instance settings |
| `DELETE /instances/:domain` | Destroy an instance      |
| `GET /instances/`           | List all instances       |

## Error format

Errors follow a consistent structure:

```json
{
  "status": 404,
  "title": "Not Found",
  "detail": "The document io.cozy.files/abc123 was not found"
}
```

## Pagination

List endpoints support cursor-based pagination:

```
GET /data/io.cozy.contacts/?page[limit]=25&page[cursor]=abc123
```

For the full API reference, see the [upstream Cozy Stack documentation](https://docs.cozy.io/en/cozy-stack/).
