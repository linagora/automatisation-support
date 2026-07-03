---
title: Registration
sidebar_position: 1
pagination_next: null
pagination_prev: null
---

SvelteKit app that handles B2C signup, login, OTP verification, account recovery, and B2B invitation acceptance. Also acts as the OIDC entry point that wraps LemonLDAP::NG with the client-side PBKDF2 + server-side Scrypt password handling.

The full reference (architecture, configuration, deployment, development, API) lives next to the code:

**→ [`registration/docs/`](https://github.com/linagora/twake-workplace-private/tree/main/registration/docs)** on GitHub.

For the B2B side of registration (invitation flow, instance creation), see [B2B](../b2b/).
