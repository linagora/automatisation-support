---
title: Cozy Admin
sidebar_position: 1
---

Cozy Admin is the web-based administration panel for Twake Workplace, built as a Cozy application. It gives platform administrators a graphical interface to manage the organizational structure and users of the Twake Workplace platform.

:::info
Cozy Admin lives in a [separate repository](https://github.com/linagora/cozy-admin), not in the Twake Workplace monorepo.
:::

## What it does

- **Organization management** — create, configure, and delete organizations; manage DNS domain validation; control subscription and plan settings
- **User management** — invite users, manage roles within organizations, enable or disable accounts
- **DNS validation** — view and trigger DNS domain checks required for email and chat services
- **Subscription management** — manage premium/freemium status and feature access per organization

The admin panel connects to the Admin Panel Backend API, which in turn coordinates with LDAP, LemonLDAP::NG SSO, and other Twake Workplace services. Authentication is handled via SSO — only users whose LDAP DN matches the admin pattern can log in.

## Requirements

Cozy Admin requires the Twake Workplace platform to be running. The platform provides:

- Authentication (LemonLDAP::NG SSO)
- Admin Panel Backend API
- LDAP directory (OpenLDAP)
- Registration service

See the [Deployment](./deployment) page for how to publish and configure the app.

## Tech stack

- React 18
- Rsbuild (build toolchain)
- cozy-client (Cozy data layer)
- cozy-ui (UI component library)
- @tanstack/react-query (data fetching)
- cozy-flags (feature flag system)
- twake-i18n (internationalization)
