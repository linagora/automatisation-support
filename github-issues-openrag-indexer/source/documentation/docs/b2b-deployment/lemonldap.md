---
title: LemonLDAP Configuration
sidebar_position: 3
---

LemonLDAP::NG (LLNG) must be configured to read organization context from LDAP and deliver it to consumer apps via OIDC claims. This page covers the B2B-specific configuration changes.

## Exported LDAP variables

The following LDAP attributes must be exported as session variables in the LLNG configuration so they are available to macros and claims:

- `twakeOrganizationId` (as `organizationId`)
- `twakeWorkspaceUrl` (as `twakeWorkspaceUrl`)
- `twakeOrganizationRole` (as `organizationRole`)
- Standard attributes: `cn`, `mail`, `uid`, `givenName`, `sn`

## Macros

### \_whatToTrace

Track the user's email instead of uid:

```perl
$_auth eq 'SAML' ? lc($_user.'@'.$_idpConfKey) : $_auth eq 'OpenIDConnect' ? lc($uid.'@'.$_oidc_OP) : lc($mail)
```

### cozyStackSub

Provides the correct OIDC `sub` claim to the Cloudery to locate the Cozy instance:

```perl
join('', split(/\./, $cn)) . $organizationId
```

### instanceWorkplaceUrl

Supports both legacy B2C users and new B2B users:

```perl
$workplaceFqdn // $twakeWorkspaceUrl
```

### userDomain

Extracts the domain from the user's email address. Configured under the Cozy OIDC RP to provide the `org_domain` claim:

```perl
defined($organizationId) && $mail =~ /\@(.+)$/ ? lc($1) : ''
```

## Virtual hosts

Add the Admin Panel Backend as a LLNG virtual host.

- **Hostname:** `admin-panel-backend.twake.app`
- **Exported headers:**
  - `Auth-User` -- authenticated user identifier
  - Standard LLNG headers for downstream service consumption

## OpenID Connect Relying Party

### Cozy OIDC-RP

Configure the Cozy relying party's advanced settings to force user claims into both the ID and access tokens. This ensures downstream services receive organization context without additional userinfo requests.

### Chat B2B OIDC-RP

Add a `chatb2b` relying party for the SSO proxy:

| Setting              | Value                                            |
| -------------------- | ------------------------------------------------ |
| Client ID            | `chatb2b`                                        |
| Client secret        | (sync with [Chat SSO Proxy](./chat-sso-proxy))   |
| Allowed redirect URI | `https://oidc-proxy.twake.app/api/oidc/callback` |

**Exported claims** for the `chatb2b` RP should include: `sub`, `email`, `name`, `organizationId`, `organizationRole`, `userDomain`.
