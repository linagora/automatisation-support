---
title: Chat B2B Control Plane
sidebar_position: 6
---

The Chat B2B Control Plane handles the provisioning and lifecycle of chat tenants (Synapse + TOM instances) for B2B organizations. It orchestrates deployments via GitLab CI pipelines and manages the deployment state in PostgreSQL.

## Prerequisites

| Service    | Purpose                                                                                                  |
| ---------- | -------------------------------------------------------------------------------------------------------- |
| PostgreSQL | Persistent storage for deployments and deployment jobs (organization, domain, status, pipeline metadata) |
| RabbitMQ   | Event bus for deployment-related events (creation, update, deletion)                                     |
| GitLab     | Triggers CI pipelines for tenant provisioning with deployment context                                    |
| LDAP REST  | Creates technical users (e.g. `matrixadmin`) in the organization                                         |

## How it works

The control plane listens for organization lifecycle events on RabbitMQ. When a new chat deployment is requested:

1. It receives the deployment request with organization context (domain, org ID)
2. Triggers a GitLab CI pipeline with the appropriate parameters
3. Tracks the pipeline/job status in PostgreSQL
4. Creates technical users in LDAP REST for Synapse administration
5. Reports deployment status back via RabbitMQ

The control plane provides a high-level orchestration context -- the GitLab CI handles the actual infrastructure details (namespace selection, Helm chart deployment, etc.).

## Deployment

The control plane can be deployed in its own namespace or alongside the chat tenants.

### Helm chart

Chart: `twake-chat-b2b-control-plane`

### Environment variables

| Variable                | Description                                          |
| ----------------------- | ---------------------------------------------------- |
| `DATABASE_URL`          | PostgreSQL connection string                         |
| `RABBITMQ_URL`          | RabbitMQ connection string                           |
| `GITLAB_URL`            | GitLab API URL for triggering pipelines              |
| `GITLAB_TOKEN`          | GitLab API token with pipeline trigger permissions   |
| `LDAP_REST_URL`         | LDAP REST API base URL                               |
| `LDAP_REST_HMAC_ID`     | HMAC service identifier (sync with LDAP REST config) |
| `LDAP_REST_HMAC_SECRET` | HMAC shared secret (32+ characters)                  |

### Health check

```bash
curl http://localhost:8080/health
```

Returns deployment count and dependency status.
