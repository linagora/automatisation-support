---
title: Architecture
sidebar_position: 3
---

Twake Chat is built on the Matrix protocol with custom extensions for enterprise features.

## Components

### TOM Server (Identity)

The TOM (Twake on Matrix) Server is the identity server that handles:

- User discovery and contact lookup
- Federation with other Matrix servers
- Global search across users and rooms
- Authentication bridging with LemonLDAP::NG

Repository: https://github.com/linagora/ToM-server/

### Matrix Synapse (Homeserver)

Synapse is the Matrix homeserver that handles:

- Room and message storage
- End-to-end encryption (Olm/Megolm)
- Federation protocol
- Media storage and retrieval

### Twake on Matrix (Client)

The Flutter-based client application supporting web, iOS, and Android with:

- Unified UI across platforms
- E2EE with cross-signing
- File sharing and media preview
- Threaded conversations
- In-app audio/video calling

Repository: https://github.com/linagora/twake-on-matrix

## B2B multi-tenancy

For B2B deployments, each organization gets its own Synapse instance managed by the [Chat B2B Control Plane](../b2b-deployment/chat-control-plane). Authentication flows through the [Chat B2B SSO Proxy](../b2b-deployment/chat-sso-proxy) which bridges LemonLDAP::NG OIDC with per-tenant Synapse instances.

See [ADR 032: Top-Level SSO Redirect](../adrs/adr-032) for how chat is embedded in Cozy apps while handling cross-domain SSO cookies.

## Infrastructure

### Monitoring

- Prometheus metrics exposed by Synapse and TOM Server
- Grafana dashboards for real-time monitoring
- Loki for log aggregation (SaaS deployments)

### Scaling

Synapse supports horizontal scaling. See the [Matrix Synapse Horizontal Scaling](https://github.com/element-hq/synapse/blob/develop/docs/workers.md) documentation for worker-based deployment.

### Health checks

TOM Server and Synapse both expose health-check endpoints for Kubernetes liveness/readiness probes.

## External references

- Matrix spec: https://spec.matrix.org/
- Synapse admin API: https://element-hq.github.io/synapse/latest/usage/administration/admin_api/
- ToM Server docs: https://github.com/linagora/ToM-server/
