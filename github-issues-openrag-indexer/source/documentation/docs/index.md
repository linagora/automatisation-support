---
slug: /
sidebar_label: Home
sidebar_position: 0
title: Twake Workplace Documentation
---

Twake Workplace is a privacy-first, open-source alternative to Microsoft Office. It brings Chat, Mail, Drive, and Video into a unified platform built on open standards.

## Where to go next

- **Running the platform locally** — [Getting Started](/overview/getting-started) then the [Developer Guide](/developer-guide).
- **Understanding the architecture** — [Concepts](/overview) covers topology, authentication, RabbitMQ, security, and environments.
- **How B2C works** — [B2C](/b2c) covers self-service signup, account recovery, 2FA, and account deletion.
- **How B2B works** — [B2B](/b2b) explains the multi-tenant story: services involved, org and instance creation, invitations, DNS validation, user lifecycle, app provisioning.
- **Glossary** — Twake-specific terms in one place: [Glossary](/overview/glossary).
- **Deploying** — [Deployment](/deployment) groups Twake Workplace Docker, B2B deployments, and CI/CD configuration.
- **Service-level reference** — [Services](/services) is split into user-facing [Apps](/apps) (Mail, Chat, Calendar, Cozy) and the internal [Platform Services](/platform-services) (Registration, Admin Panel Backend, LDAP REST, Dashboard). Per-service deep dives live next to the code on GitHub.

## How this site is organised

This site is the cross-service narrative — architecture, B2B mechanics, ADRs, deployment. **Per-service code-level reference docs live with the code** (in each service's `docs/` directory on GitHub) so they stay in sync with the codebase. Each Platform Services page here is a one-paragraph summary that links out to the in-repo docs.
