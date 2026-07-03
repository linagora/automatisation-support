---
title: Service Tokens (Cloudery)
sidebar_position: 6
---

How a backend service (a migration tool, the Calendar attachment detacher, any
internal job) obtains a Cozy Stack bearer token for a given user's instance so
it can call the Stack API on that user's behalf.

This is the path that works in production today. For the OIDC based alternative,
see [Token Exchange](./token-exchange.md). For the broker service that fronts the
Stack admin API here, see [Cloudery](../cloudery/). For a task oriented walkthrough of
uploading files with the token you get here, see
[Uploading Files from Another App](./uploading-files.md).

## Why a broker exists

The Stack can mint any token for any instance, but the route that does it lives
on the Stack admin API, which is not exposed to the internet. Only trusted
infrastructure can reach it, and reaching it requires the admin secret.

The Cloudery holds that admin secret and exposes a thin, authenticated public
endpoint in front of it. A service never holds the Stack admin secret and never
talks to the admin API directly. It asks the Cloudery, the Cloudery calls the
Stack.

```
Service ──(partner bearer token, audience + scope)──> Cloudery public API
Cloudery ──(admin auth)─────────────────────────────> Stack admin API
Stack ────(signed JWT)──────────────────────────────> Cloudery ──> Service
Service ──(Authorization: Bearer <jwt>)─────────────> Stack data API (/files, ...)
```

The service authenticates to the Cloudery with a partner bearer token. The Stack
admin secret stays inside the Cloudery and is never handed to callers.

## Audience decides both lifetime and where permissions come from

The most important thing to understand before requesting a token: the audience
you ask for changes both how long the token lives and where its permissions come
from. The two audiences a service will realistically use behave very
differently.

| Audience | Validity     | Where do permissions come from?                                |
| -------- | ------------ | -------------------------------------------------------------- |
| `cli`    | 30 minutes   | Honors the scope you request directly                          |
| `app`    | 24 hours     | Ignores the requested scope; uses the installed app's manifest |

Consequences:

- A `cli` token is the simplest. You ask for `io.cozy.files io.cozy.permissions`
  and you get exactly that. But it expires in 30 minutes, so a long running job
  must re-request tokens.
- An `app` token lives 24 hours, but only works if there is an installed app
  whose slug you pass as the token subject, and that app's manifest already
  grants the permissions you need. The scope you pass is not used. An `app` token
  whose subject is not a real installed app slug produces a token that fails
  every data request, because the Stack cannot find a permission set for it.

There is no way to ask the Cloudery for a custom expiry. The lifetime is whatever
the audience implies.

## The Cloudery endpoints

### Generic token endpoint (preferred)

```
POST /api/public/instances/{fqdn}/token
Authorization: Bearer <partner-token>
Content-Type: application/json

{ "audience": "cli", "scope": "io.cozy.files io.cozy.permissions" }
```

The caller chooses the audience, the scope, and (for `app`) the subject. Rules
enforced by the Cloudery:

- `audience` and `scope` are both required.
- `audience` must be either `cli` or `app`. A caller cannot mint a long lived
  access token through this endpoint.
- `subject` is required when `audience` is `app`.

The response is the Stack JWT to use as a bearer token against the user's
instance. This endpoint is live in production.

### Legacy drive token endpoint

```
POST /api/public/instances/{fqdn}/drive_token
Authorization: Bearer <partner-token>
```

A fixed shortcut created for migrating the old Twake drives. It always returns a
`cli` token scoped to `io.cozy.files`, with no choice of scope or audience.
Prefer the generic endpoint for anything new.

## Choosing an audience for your service

- Short, one shot operation (detach a single attachment on the fly): request a
  `cli` token scoped to `io.cozy.files io.cozy.permissions`. It is gone in 30
  minutes, which is fine.
- Long running bulk job (migrate thousands of files): use an `app` token.
  Register a cozy-wrapper app for your service, give its manifest the permissions
  you need (`io.cozy.files`, plus `io.cozy.permissions` for public links), and
  request `app` audience with that app's slug as the subject for a 24 hour token.
  Re-request as needed for jobs longer than the validity window.

## Resolving the instance address

To call the Cloudery you need the user's instance address (the Drive URL). The
long term source is the `workplaceFqdn` field in the user info response, but it
is not populated for all deployments yet. Until it is, derive the address from
the OIDC `sub`, as is done elsewhere today.
