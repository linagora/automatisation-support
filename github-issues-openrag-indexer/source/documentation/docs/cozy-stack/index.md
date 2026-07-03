---
title: Cozy Stack
sidebar_position: 1
---

Cozy Stack is the core backend server of the Cozy platform and the foundation of Twake Workplace's user-facing experience. It is a single Go process that manages multiple isolated user instances, serves web applications, and exposes a REST API for data, files, authentication, and background jobs.

The project is open-source and available at [github.com/cozy/cozy-stack](https://github.com/cozy/cozy-stack).

## Role in Twake Workplace

Cozy Stack is the entry point for end users. When a user navigates to their Twake Workplace instance (e.g., `user1.twake.app`), Cozy Stack serves the home application and provides access to all other apps (Drive, Mail, Chat, Calendar, Contacts, Notes) through a unified personal cloud interface.

Each user gets their own Cozy instance with isolated data, installed applications, and permissions. Cozy Stack hosts and serves a wide range of web applications: Home, Drive, Mail, Chat, Calendar, Contacts, Notes, Settings, LinShare, and more.

## What it does

| Responsibility      | Description                                                                       |
| ------------------- | --------------------------------------------------------------------------------- |
| **Serve web apps**  | Hosts and serves installed JavaScript applications to users via subdomain routing |
| **Data storage**    | CRUD operations on CouchDB documents, organized by doctype per instance           |
| **File management** | Virtual File System with versioning, trash, and metadata (local or Swift storage) |
| **Authentication**  | Session tokens for web apps, OAuth2 for third-party clients, OIDC delegation      |
| **Permissions**     | Fine-grained access control per doctype, verb, and document                       |
| **Background jobs** | Asynchronous task execution with scheduling (cron, event-triggered, webhooks)     |
| **Sharing**         | Peer-to-peer document sharing between instances using CouchDB replication         |
| **Konnectors**      | Sandboxed connectors that import data from external services                      |
| **Realtime**        | WebSocket-based live updates for connected clients                                |
| **Notifications**   | Push notifications and email alerts                                               |

## Tech stack

| Component     | Technology                          |
| ------------- | ----------------------------------- |
| Language      | Go                                  |
| Web framework | Echo (labstack/echo)                |
| Database      | CouchDB                             |
| File storage  | Local filesystem or OpenStack Swift |
| Cache / locks | Redis (optional)                    |
| Message queue | Redis or in-memory                  |
| CLI framework | Cobra (spf13/cobra)                 |

## Quick links

- [Architecture](./architecture) -- multi-tenancy, app serving, data isolation
- [API](./api) -- REST endpoints, authentication, JSON-API format
- [Configuration](./configuration) -- config file, deployment options, admin API
- [Upstream documentation](https://docs.cozy.io/en/cozy-stack/) -- full Cozy Stack reference
