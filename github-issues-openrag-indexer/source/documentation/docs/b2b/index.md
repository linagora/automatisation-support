---
title: B2B
sidebar_position: 1
---

Twake Workplace runs in two modes on the same service fabric: **B2C** (individual users on `twake.app`) and **B2B** (organizations with their own domain). The code paths are shared; the differences are where entities live in LDAP, who is allowed to do what, and which lifecycle events fire.

This section is the engineering-facing narrative of how B2B actually works. Deployment and configuration details live under [Deployment → B2B Deployment](../b2b-deployment/); the service-by-service code-level reference lives with the code on GitHub.

## B2C vs B2B at a glance

| Dimension              | B2C                                  | B2B                                                                 |
| ---------------------- | ------------------------------------ | ------------------------------------------------------------------- |
| LDAP branch            | `ou=users,dc=twake,dc=app`           | `ou=users,ou=<org-domain>,ou=b2b,dc=twake,dc=app` (org entry at `ou=<org-domain>,ou=b2b,dc=twake,dc=app`) |
| Signup                 | Self-service via Registration        | Admin-invited via Admin Panel → Registration                        |
| Domain                 | `twake.app`                          | Customer-owned domain (validated by DNS check)                      |
| Chat tenant            | Shared Synapse                       | Per-org Synapse + TOM, provisioned by the Chat B2B Control Plane    |
| Cozy instance          | Per-user, created at signup          | Per-user, created when the invited user completes setup (admin's create call only writes the LDAP entry) |
| SSO OIDC client        | Shared (one per downstream app)      | Often a dedicated OIDC identity, fronted by the Chat B2B SSO Proxy  |
| Lifecycle events       | `user.created`, user self-managed    | Admin-driven: user/role/org events, DNS validation, app install    |

## What this section covers

- [Services involved in B2B](./services.md) — who owns what, and why there are two different auth paths
- [Organization and instance creation](./org-creation.md) — what happens when an org and its first user come into being
- [Invitations](./invitations.md) — the admin → registration flow
- [Domain validation](./domain-validation.md) — the DNS lifecycle: TXT proof, mail records, chat records
- [User lifecycle](./user-lifecycle.md) — add, disable, role change, delete, and the events each emits
- [Authentication in B2B](./auth.md) — LemonLDAP, OIDC proxy, why chat has its own proxy
- [App provisioning](./app-provisioning.md) — Cozy apps install/uninstall via RabbitMQ
- [Settings propagation](./settings.md) — how cross-app settings reach every service

## Cross-refs

- Platform authentication primer: [Authentication](../overview/authentication.md)
- OIDC / login pipeline: [SSO & OIDC Proxy](../overview/sso.md)
- Event bus topology: [RabbitMQ](../overview/rabbitmq.md)
- LDAP structure: [LDAP Structure](../overview/ldap-structure.md)
