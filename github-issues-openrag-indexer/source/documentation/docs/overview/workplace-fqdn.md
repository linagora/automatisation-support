---
title: Workplace FQDN Claim
---

Twake SSO exposes a `workplaceFqdn` claim through the OIDC `user_info` endpoint. It is the canonical hostname of a user's workplace, stored in LDAP at signup as the `twakeWorkspaceUrl` attribute. Use it to build links to the platform API and to other Twake apps instead of guessing URLs from the username.

This page is the integration guide for that claim. For the decision behind it, see [ADR 023](/adrs/adr-023).

:::note
One value, two names. It lives in LDAP as `twakeWorkspaceUrl` and is surfaced to client apps through `user_info` as the `workplaceFqdn` claim. Integrate against the claim; the LDAP attribute is an internal implementation detail.
:::

## Why Not Build URLs From the Username

Constructing URLs like `https://{username}.twake.app` is fragile:

- **The username is not the host.** When a username contains a `.` (or the platform cleans/transforms it), the derived host is wrong and the link breaks.
- **The domain is not fixed.** With B2B custom domains, `twake.app` is no longer a safe constant to hardcode.

`workplaceFqdn` is the host the platform actually assigned, so it sidesteps both problems.

## Reading the Claim

After the standard authorization code flow, call the userinfo endpoint (resolved from the OIDC discovery document at `/.well-known/openid-configuration`) with the access token:

```http
GET /oauth2/userinfo HTTP/1.1
Host: <oidc-issuer-host>
Authorization: Bearer <access_token>
```

The response includes the claim alongside the usual profile fields:

```json
{
  "sub": "jdoe",
  "email": "jdoe@twake.app",
  "name": "Jane Doe",
  "workplaceFqdn": "jdoe.twake.app"
}
```

:::note
Request the `profile` scope so the claim is included. `workplaceFqdn` is a bare hostname, with no scheme and no trailing slash.
:::

The claim is also forced into the ID token (see [Exposing the Claim](#exposing-the-claim-lemonldap)), so you can read it from the decoded `id_token` without an extra userinfo round-trip.

## Using the Claim

There are two distinct cases. Do not conflate them.

| Goal | What to do |
| ---- | ---------- |
| Call the platform API for this user | Use `workplaceFqdn` as-is, prepending `https://` |
| Link to another Twake app (Settings, Drive, Chat...) | Insert the app slug into the first subdomain |

### Calling the platform API

Prepend the scheme and use the host directly:

```
https://jdoe.twake.app
```

### Linking to another app

Each app lives on a slugged subdomain derived from the workplace host: the slug is appended to the first DNS label. For `workplaceFqdn` = `jdoe.twake.app`:

| App | Slug | Derived URL |
| --- | ---- | ----------- |
| Settings | `settings` | `https://jdoe-settings.twake.app` |
| Drive | `drive` | `https://jdoe-drive.twake.app` |
| Chat | `chat` | `https://jdoe-chat.twake.app` |

## Testing on Staging

The claim is already exposed on staging for these OIDC clients:

```
chatb2b, cozy-twake-int, meet-stg, tcalendar, twakechat,
twakemail, teammail-mobile, tmail-stg-local, twake-mail-admin, twake-poc
```

You can inspect the claim end-to-end with [simple-oidc-client](https://github.com/linagora/simple-oidc-client). Run the OIDC flow against the staging portal and ask for `user_info`:

```sh
./sh/llng \
  --llng-url https://auth.stg.lin-saas.com/ \
  --login <your-login> \
  --client-id tcalendar \
  --client-secret <client-secret> \
  --redirect-uri https://calendar.stg.lin-saas.com/callback \
  --llng-cookie <llng-session-cookie> \
  user_info
```

Pass a valid LemonLDAP session cookie via `--llng-cookie` to skip interactive login. The response carries the claim:

```json
{
  "email": "<your-login>",
  "name": "<your-name>",
  "preferred_username": "<your-name>",
  "sid": "...",
  "sub": "<your-login>",
  "workplaceFqdn": "myworkspace.stg.lin-saas.com"
}
```

## Exposing the Claim (LemonLDAP)

For a new OIDC client to receive the claim, two things must be set on the Relying Party in LemonLDAP::NG Manager.

**1. Map the claim in the exported attributes.** Add a row mapping the `workplaceFqdn` claim to the `twakeWorkspaceUrl` LDAP variable:

| Claim name | Variable name | Type | Array |
| ---------- | ------------- | ------ | --------- |
| `email` | `mail` | String | Automatic |
| `name` | `cn` | String | Automatic |
| `preferred_username` | `uid` | String | Automatic |
| `workplaceFqdn` | `twakeWorkspaceUrl` | String | Automatic |

![LemonLDAP exported attributes mapping workplaceFqdn to twakeWorkspaceUrl](/img/sso/exported-attributes.png)

**2. Force the claim into the ID token.** Under the client's Advanced options, set **Force claims to be returned in ID Token** to On so the claim ships in the `id_token`, not only via the userinfo endpoint.

![LemonLDAP advanced option forcing claims into the ID token](/img/sso/force-claims-id-token.png)

## Limitation: External SSO

The claim is not populated for users coming through an **external SSO** (for example, an organization's own identity provider federated into Twake). Those users authenticate against a separate directory that does not carry the platform's `workplaceFqdn`.
