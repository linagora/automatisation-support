---
title: OIDC Token Exchange
sidebar_position: 7
---

The token exchange endpoint turns an organization administrator's OIDC token into
a Cozy Stack OAuth client plus access and refresh tokens. It is the mechanism the
Twake admin panel uses to act on an instance after the admin has authenticated
against the organization's identity provider.

It is not a general "any app converts the user's OIDC token into a Stack token
scoped to that app" primitive. The constraints below are why. For the admin
brokered token path that backend services use today, see
[Service Tokens (Cloudery)](./service-tokens.md).

## Request and response

```
POST /auth/token_exchange
Content-Type: application/json

{ "id_token": "<OIDC id_token>", "scope": "io.cozy.files io.cozy.contacts" }
```

A successful call returns a freshly created OAuth client and its tokens: an
access token, a refresh token, the token type (`bearer`), the granted scope, and
the new client's id, secret, and registration token. Every successful call
creates a new OAuth client named "Twake Admin Panel" and binds it to the OIDC
session for coordinated logout.

## What it validates

The gating is stricter than "any OIDC token works", and the org checks are worth
stating precisely.

**The feature is enabled.** Token exchange is a per context operator switch in
the Stack configuration. It is turned on for SaaS, so this is not something a
caller needs to arrange. (A context where it is off would refuse every call with
"this endpoint is not enabled".)

**The token must verify.** Its signature is checked against the provider's keys,
the issuer must match the configured issuer, the audience must match the OIDC
client, and the token must not be issued more than five minutes in the future.

**Admin role required.** The token must carry an organization role of admin or
owner. A non admin token is rejected.

**Organization id is always required and must match.** The token's `org_id` must
be present and equal to the instance's organization id. There is no path that
skips this. As a consequence, an instance with no organization id configured
cannot use token exchange at all, because an empty id is treated as a mismatch.

**Organization domain is conditional.** It is only checked when the instance has
an organization domain configured. If it does, the token's `org_domain` claim
must be present and match. If the instance has no organization domain, this claim
is not checked. In short: organization id gating is unconditional, organization
domain gating depends on instance configuration.

**Scope allowlist.** Every requested scope must be one of a fixed set: files,
contacts, contact groups, apps, and sharings. There is no way to request a
narrower sub permission or a doctype outside this list.

## Origin restrictions

The endpoint is origin restricted. Allowed origins are subdomains of the
instance's organization domain and the SaaS admin panel, with HTTPS enforced for
the public ones. The created client's redirect address is derived from the
calling origin.

## Why this is not general app delegation

Put the constraints together: the caller must present an admin or owner token for
the same organization as the instance, the scope is limited to a fixed list, and
the created client is always the Twake Admin Panel. There is no notion of "use
the permissions of the calling app", and no per user, per app mapping. A regular
user cannot use this to let an arbitrary third party app act on their Drive.

That generalized delegation (exchange a user's OIDC token for a Stack token
bounded by an application's permissions) is not implemented. Until it is,
services use the [Cloudery service token](./service-tokens.md) path.

## Not the same as OIDC login

The Stack also has an OIDC access token endpoint used during normal mobile and
flagship login, which converts a delegated login code or an external OIDC token
into Stack tokens and handles two factor authentication. That is part of user
login, not a service to service delegation primitive, and should not be confused
with token exchange.
