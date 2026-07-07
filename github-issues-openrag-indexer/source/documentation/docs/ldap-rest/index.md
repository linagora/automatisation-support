---
title: LDAP REST
sidebar_position: 1
pagination_next: null
pagination_prev: null
---

REST gateway over OpenLDAP for B2C and B2B users, organizations, and groups (ADR 024 v2). HMAC-only — no browser access. Implemented as a plugin on top of [`ldap-rest`](https://www.npmjs.com/package/ldap-rest).

The full reference (LDAP structure, data model, uniqueness rules, configuration, deployment, development, API) lives next to the code:

**→ [`twake-ldap-rest/docs/`](https://github.com/linagora/twake-workplace-private/tree/main/twake-ldap-rest/docs)** on GitHub.

Consumers should use the [`@linagora/ldap-rest-client`](https://www.npmjs.com/package/@linagora/ldap-rest-client) TypeScript client rather than calling HMAC endpoints directly.
