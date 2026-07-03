---
title: Company shared drive (local development setup)
sidebar_position: 10
---

The **Company Shared Drive** lets an organization's admin manage files on a Cozy instance owned by the organization, not by them personally. When they open [cozy-admin](../cozy-admin/index.md), the frontend obtains an access token scoped to that drive via a three-step chain across LemonLDAP, [Admin Panel Backend](../admin-panel-backend/index.md), and [Cozy Stack](../cozy-stack/index.md).

This page is the ground-up setup for a contributor who has the monorepo cloned and wants the flow working end to end. It follows on from [Getting Started](../overview/getting-started.md).

## Runtime flow

```mermaid
sequenceDiagram
    autonumber
    participant B as Admin browser<br/>(cozy-admin)
    participant APB as Admin Panel<br/>Backend
    participant LLNG as LemonLDAP
    participant ST as Cozy Stack<br/>(org instance)

    Note over B,LLNG: LemonLDAP session cookie is already set for `.example.com`

    B->>APB: GET /api/v1/id-token<br/>cookie: lemonldap=...
    APB->>LLNG: OIDC authorization-code flow<br/>(as the logged-in admin, client cozy-dev)
    LLNG-->>APB: id_token with org_id, org_domain, org_role
    APB-->>B: id_token

    B->>ST: POST /auth/token_exchange<br/>body: { id_token, scope: io.cozy.files }
    ST->>LLNG: fetch JWKS, verify signature
    ST->>ST: check claims against the org<br/>instance doc (OrgID, OrgDomain)
    ST-->>B: access_token scoped to io.cozy.files

    B->>ST: GET /files/... with Authorization: Bearer
    ST-->>B: shared drive contents
```

The key point the diagram cannot show: **the stack accepts the id_token without a prior OAuth client registration**. That behavior is gated by `authentication.<context>.oidc.allow_oauth_token` in `cozy.yaml` and exists only under the `b2b` context, which is why most of the configuration below is about setting that context up and making sure the id_token's claims resolve to it.

## Prerequisites

- `docker compose up -d` is running with the Getting Started `/etc/hosts` entries, plus the two hosts used by the shared drive chain:

  ```
  127.0.0.1 cozy.example.com admin.cozy.example.com
  ```

- A `cozy-stack` binary on the host, reading `~/.cozy/cozy.yml` and serving the cozy-admin build as the `admin` app:

  ```bash
  cozy-stack serve \
    --appdir admin:./path/to/cozy-admin/build \
    --disable-csp
  ```

  `./path/to/cozy-admin/build` is wherever you run `yarn build` inside [cozy-admin](../cozy-admin/development.md). Serving it under the `admin` slug is what lets the browser reach the app at `http://admin.cozy.example.com:8080/` once the org instance exists.

## Configuration

The setup falls into three parts: platform config (cozy.yaml, LemonLDAP, Admin Panel Backend), then data creation through signup, then the Cozy instance wiring that Cloudery would normally handle. Each numbered step below is one of those.

### 1. Cozy Stack: enable the B2B OIDC context

The `allow_oauth_token` flag gates `POST /auth/token_exchange`. Without a `b2b` context declared, the endpoint refuses every request. Append the block below to `~/.cozy/cozy.yml` and restart `cozy-stack serve`.

```yaml
authentication:
  b2b:
    disable_password_authentication: true
    oidc:
      client_id: cozy-dev
      client_secret: "123456"
      scope: openid profile
      login_domain: signup.example.com
      redirect_uri: http://oauthcallback.localhost:8080/oidc/redirect
      authorize_url: http://auth.example.com/oauth2/authorize
      token_url: http://auth.example.com/oauth2/token
      userinfo_url: http://auth.example.com/oauth2/userinfo
      userinfo_instance_field: preferred_username
      userinfo_instance_suffix: .example.com
      allow_custom_instance: true
      allow_oauth_token: true
      logout_url: http://auth.example.com/oauth2/logout
      id_token_jwk_url: http://auth.example.com/oauth2/jwks
```

This `client_id` must be the same client that Admin Panel Backend uses to mint the id_token (configured in step 3). The stack verifies the `aud` claim of the incoming id_token against this value.

See [Cozy Stack → Configuration](../cozy-stack/configuration.md) for the rest of `cozy.yaml`.

### 2. LemonLDAP: the `cozy-dev` OIDC client

`cozy-dev` is the client identity Admin Panel Backend and the stack agree on. Its definition lives in `registration/config/lmConf-1.json`, which is mounted into the `auth` container and used as the seed configuration. The file has no version number, so editing it in place and restarting the container is all that is needed.

```bash
docker compose restart auth
```

The relevant slice of the LemonLDAP configuration that defines `cozy-dev` looks like this:

```json
{
  "oidcRPMetaDataOptions": {
    "cozy-dev": {
      "oidcRPMetaDataOptionsClientID": "cozy-dev",
      "oidcRPMetaDataOptionsClientSecret": "123456",
      "oidcRPMetaDataOptionsPublic": 1,
      "oidcRPMetaDataOptionsIDTokenForceClaims": 1,
      "oidcRPMetaDataOptionsIDTokenSignAlg": "RS256",
      "oidcRPMetaDataOptionsAccessTokenJWT": 1,
      "oidcRPMetaDataOptionsBypassConsent": 1,
      "oidcRPMetaDataOptionsRedirectUris":
        "http://oauthcallback.localhost:8080 http://oauthcallback.localhost:8080/oidc/redirect"
    }
  },
  "oidcRPMetaDataExportedVars": {
    "cozy-dev": {
      "email": "mail",
      "name": "cn",
      "first_name": "givenName",
      "last_name": "sn",
      "sub": "cozyStackSub",
      "preferred_username": "cozyStackSub",
      "org_id": "organizationId",
      "org_role": "role",
      "org_domain": "mailDomain",
      "workplaceFqdn": "workplaceFqdn"
    }
  }
}
```

The options that are not defaults and that drive this flow:

- **`oidcRPMetaDataOptionsPublic = 1`.** The token endpoint expects HTTP Basic client authentication. LemonLDAP's Perl/FastCGI layer does not reliably receive `Authorization` headers for confidential clients in this stack, so the client is declared public. Local-dev only.
- **`oidcRPMetaDataOptionsIDTokenForceClaims = 1`.** Without this, LemonLDAP only puts the claims it considers standard into the id_token and returns the rest via `/userinfo`. Cozy Stack only inspects the id_token, so the organization claims must travel with it.
- **`oidcRPMetaDataOptionsRedirectUris`** is a space-separated allow-list. Both Cozy Stack and Admin Panel Backend use `http://oauthcallback.localhost:8080/oidc/redirect` from this list when running the authorization-code flow, so the value of `OIDC_REDIRECT_URI` in step 3 and `authentication.b2b.oidc.redirect_uri` in step 1 must match one of these entries.

The four claims the stack cares about, resolved end to end:

| Claim                        | Session variable | Origin                                                             |
| ---------------------------- | ---------------- | ------------------------------------------------------------------ |
| `org_id`                     | `organizationId` | LDAP `ldapExportedVars`: `organizationId` → `twakeOrganizationId`  |
| `org_role`                   | `role`           | LDAP `ldapExportedVars`: `role` → `twakeOrganizationRole`          |
| `org_domain`                 | `mailDomain`     | LemonLDAP macro: `lc((split('@', $mail))[1] // '')`                     |
| `sub` / `preferred_username` | `cozyStackSub`   | LemonLDAP macro: `$cn . $organizationId`                                |

Only `org_id` is typically missing from a fresh install. The LDAP exports and macros are already part of the baseline LemonLDAP config.

For deeper reference see [B2B Deployment → LemonLDAP](../b2b-deployment/lemonldap.md).

### 3. Admin Panel Backend: enable the id-token endpoint

Admin Panel Backend authenticates its browser callers through LemonLDAP's handler module, not through OIDC. The id-token endpoint is separate: it acts on the logged-in admin's behalf by replaying the OIDC authorization-code flow against LemonLDAP using the admin's session cookie. These environment variables drive that second OIDC client.

In the root `.env` (the file `docker compose` reads):

```env
OIDC_PROVIDER_URL=http://auth.example.com
OIDC_CLIENT_ID=cozy-dev
OIDC_CLIENT_SECRET=123456
OIDC_REDIRECT_URI=http://oauthcallback.localhost:8080/oidc/redirect
OIDC_SCOPES=openid profile
OIDC_COOKIE_NAME=lemonldap
```

`OIDC_CLIENT_ID` must match `client_id` in `cozy.yaml` (step 1). The id_token's `aud` is what the stack verifies against its configured client.

`CORS_ALLOWED_ORIGINS` in the same file must include the origin cozy-admin is served from, typically `http://admin.cozy.example.com:8080`. The browser call `GET /api/v1/id-token` is cross-origin and will otherwise be blocked.

After editing `.env`:

```bash
docker compose up -d admin-panel-backend
```

### 4. Create the organization and its owner through signup

Organization and owner creation is done by the [Registration](../registration/index.md) application, not by hand. It lays down the LDAP entries under `ou=<org-id>,ou=b2b` with the right object classes and attributes, publishes the lifecycle events, and hands the owner off to Admin Panel Backend. See [Organization and instance creation](./org-creation.md) for the full sequence.

Open `http://signup.example.com/create-business`, fill in the form with the domain you picked above and any name and email for the owner, then submit. Locally the post-signup redirect into the admin panel does not happen because the stack and Registration are not integrated, so navigate to `http://admin.cozy.example.com:8080/` manually instead. When the flow finishes you will have:

- An `ou=<org-id>,ou=b2b,dc=twake,dc=test` entry with the `twakeOrganization` object class, where `<org-id>` is the identifier Registration generates for the org (for example `exampleorgh2cfd8`).
- An owner user under `ou=users,ou=<org-id>,ou=b2b,dc=twake,dc=test` carrying `twakeOrganizationId=<org-id>`, `twakeOrganizationRole=owner`, `mail=<owner>@<org-domain>`, and `twakeUserDomain=<owner-fqdn>`.
- Two Cozy instances on the local stack: the owner's personal instance and the organization instance (the one that will host the shared drive).

Note the three values the signup produced; you will need them in the next steps:

- the **organization identifier** (LDAP `twakeOrganizationId` on the owner, shown as `Organization` in the admin panel URL path)
- the **organization domain** (what you entered in the signup form)
- the **two Cozy instance domains** (visible via `cozy-stack instances ls`)

You can pull the first two straight from LDAP. Pick the owner by their `twakeOrganizationRole` and ask for the handful of fields that matter:

```bash
ldapsearch -LLL -x -H ldap://localhost:3389 \
  -D "cn=admin,dc=twake,dc=test" -w admin \
  -b "dc=twake,dc=test" \
  "(twakeOrganizationRole=owner)" \
  dn cn mail twakeOrganizationId twakeUserDomain
```

The response carries everything at once: the `dn` contains the `ou=<org-id>,ou=b2b,…` path, `twakeOrganizationId` is that same `<org-id>` as an attribute, and the `mail` domain suffix matches `<org-domain>`. If signup created more than one org on the same stack, add an `ou=` prefix to `-b` to scope the search to a specific org subtree.

### 5. Create the Cozy instances

In production, [Cloudery](https://github.com/cozy/cozy-manager) provisions the owner's personal instance and the organization instance once signup hands off to it. Locally, `CLOUDERY_MANAGER_URL` points to the Cozy-operated manager and does not reach back to your stack, so the two instances have to be created by hand on the local `cozy-stack`.

:::tip
If the stack is listening on a different port than 80 (for example 8080) both `<owner-instance-domain>` and `<org-instance-domain>` need to contain the stack port, for example:

```bash
cozy-stack instances add ownerinstance.example.com:8080 ...
cozy-stack instances add orginstance.example.com:8080 ...
```

:::

Use the CLI against the stack's admin endpoint:

```bash
# Owner's personal instance. OIDC sub must match what LemonLDAP will mint.
cozy-stack instances add <owner-instance-domain> \
  --context-name b2b \
  --oidc_id <owner-oidc-sub> \
  --email <owner>@<org-domain> \
  --public-name "<owner-name>" \
  --passphrase cozy

# Organization instance. No oidc_id; it only ever receives delegated calls.
cozy-stack instances add <org-instance-domain> \
  --context-name b2b \
  --email org@<org-domain> \
  --public-name "<org-name>" \
  --passphrase cozy
```

`<owner-oidc-sub>` is the `sub` claim LemonLDAP will put in the id_token, computed by the `cozyStackSub` macro as `cn` concatenated with `twakeOrganizationId`. For an owner with `cn=jdoe` in an organization with `twakeOrganizationId=exampleorg`, the sub is `jdoeexampleorg`. Get the exact value for your owner by running a quick search against LDAP:

```bash
ldapsearch -LLL -x -H ldap://localhost:3389 \
  -D "cn=admin,dc=twake,dc=test" -w admin \
  -b "ou=<org-id>,ou=b2b,dc=twake,dc=test" \
  "(twakeOrganizationRole=owner)" cn twakeOrganizationId
```

### 6. Set the organization fields on both instances

The `--context-name` and `--oidc_id` flags handle two of the four fields the exchange needs. `org_id` and `org_domain` are not exposed by the CLI, so patch the instance documents in CouchDB.

```bash
COUCH=http://admin:password@localhost:5984/global%2Finstances

patch_instance() {
  local domain="$1"
  local doc id
  doc=$(curl -s "${COUCH}/_all_docs?include_docs=true" \
    | jq -c --arg d "$domain" '.rows[].doc | select(.domain == $d)')
  id=$(echo "$doc" | jq -r '._id')
  echo "$doc" \
    | jq -c '. + {org_id: "<org-id>", org_domain: "<org-domain>"}' \
    | curl -s -X PUT -H "Content-Type: application/json" -d @- "${COUCH}/${id}"
}

patch_instance "<owner-instance-domain>"
patch_instance "<org-instance-domain>"
```

Verify both documents carry the four B2B fields the stack will check:

```bash
curl -s "${COUCH}/_find" \
  -H "Content-Type: application/json" \
  -d '{"selector":{"context":"b2b"},"fields":["domain","context","org_id","org_domain","oidc_id"]}' \
  | jq .docs
```

Both entries should show `context: b2b` and the two `org_*` fields populated; the owner's entry additionally shows `oidc_id` set to the owner's OIDC sub.

### 7. Point the LDAP technical account at the org instance

In production, Cloudery publishes a workspace-created event on RabbitMQ once it provisions an instance. Registration consumes it (`handleWorkspaceCreatedNotification` in `registration/src/lib/services/notification/auth-notification-service.ts`) and writes the FQDN to `twakeWorkspaceUrl` on the matching LDAP user. For the org instance, the matching user is the **technical account** that signup created alongside the owner -- `uid=<org-id>,ou=users,ou=<org-id>,ou=b2b,dc=twake,dc=test`, with `twakeIsTechnical=TRUE`. That account is the one bound to the org instance, and its `twakeWorkspaceUrl` is what the shared-drive chain dereferences when it needs to resolve the org instance from LDAP.

Locally there is no Cloudery and no message bus, so the attribute is unset. Patch it with `ldapmodify`:

```bash
ldapmodify -x -H ldap://localhost:3389 \
  -D "cn=admin,dc=twake,dc=test" -w admin <<EOF
dn: uid=<org-id>,ou=users,ou=<org-id>,ou=b2b,dc=twake,dc=test
changetype: modify
add: twakeWorkspaceUrl
twakeWorkspaceUrl: <org-instance-domain>
EOF
```

Use the FQDN only, no scheme and no path, and include the stack port if you used one (e.g. `<org-instance-domain>:8080`). The directive is `add:` rather than `replace:` because the attribute is not present on a fresh signup, and `replace` on a missing attribute fails.

For completeness you can apply the same modification to the owner DN (`uid=<owner-cn>,ou=users,ou=<org-id>,ou=b2b,dc=twake,dc=test`) with `<owner-instance-domain>`, but that one is a placeholder for owner-side flows and is not what the shared-drive chain needs.

## Verifying the chain

Log in at `http://signup.example.com/` as the owner created in step 4, copy the `lemonldap` cookie from your browser, then run:

```bash
LEMON=<paste the cookie value>

# Step 1: admin-panel-backend mints the id_token
ID_TOKEN=$(curl -s "http://admin-panel-backend.example.com/api/v1/id-token" \
  -H "Accept: application/json" -H "Cookie: lemonldap=${LEMON}" \
  | jq -r .id_token)

# Step 2: cozy-stack exchanges it
ACCESS=$(curl -s -X POST "http://<org-instance-domain>/auth/token_exchange" \
  -H "Origin: http://admin.<org-instance-domain>" \
  -H "Content-Type: application/json" \
  --data "{\"id_token\":\"${ID_TOKEN}\",\"scope\":\"io.cozy.files\"}" \
  | jq -r .access_token)

# Step 3: use the access token on the org instance
curl -s "http://<org-instance-domain>/files/io.cozy.files.root-dir" \
  -H "Authorization: Bearer ${ACCESS}" | jq .data.attributes.path
```

A chain that ends on `"/"` means every participant agreed: LemonLDAP issued an id_token with the expected claims, Cozy Stack accepted it against the org instance, and the returned access token has the right scope. The same chain runs unchanged from cozy-admin in the browser at `http://admin.<org-instance-domain>/`.

## Troubleshooting

| Symptom | Where to look |
| --- | --- |
| `/api/v1/id-token` responds `501 OIDC is not configured` | `OIDC_*` variables are missing from `.env`, or the container was not recreated |
| `/api/v1/id-token` responds `401 Session cookie not found` | LemonLDAP cookie is absent or expired; re-authenticate at `signup.example.com` and retry |
| `/api/v1/id-token` responds `502` | LemonLDAP unreachable, or `cozy-dev` client is mis-configured (step 2) |
| `/oauth2/authorize` returns the portal HTML instead of a redirect | Redirect URI not in the allow-list for `cozy-dev` |
| `/oauth2/token` returns `invalid_client` | HTTP Basic auth header missing on the token request |
| `/auth/token_exchange` returns `403` with no CORS headers | Request `Origin` does not match `org_domain` on the target instance |
| `/auth/token_exchange` returns `400` on claims | Compare the decoded id_token claims against the org instance doc; `org_id`, `org_domain`, and `org_role` must all agree |
| id_token is missing `org_*` claims | `IDTokenForceClaims` is off, or the `org_id` claim mapping is absent from `cozy-dev`'s exported vars |
| Signup completes but `cozy-stack instances ls` shows no new instances | Cloudery did not provision; see the [Registration](../registration/index.md) service notes for how it calls Cloudery and what is required locally |

## Further reading

- [Organization and instance creation](./org-creation.md) for what signup does under the hood
- [Authentication in B2B](./auth.md) for how LemonLDAP sessions are created in the first place
- [B2B Deployment → LemonLDAP](../b2b-deployment/lemonldap.md) for production LemonLDAP layout
