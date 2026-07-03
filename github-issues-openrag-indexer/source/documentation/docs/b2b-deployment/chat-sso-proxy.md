---
title: Chat B2B SSO Proxy
sidebar_position: 7
---

The Chat B2B SSO Proxy (OIDC Proxy) handles the OIDC/OAuth2 flow between the identity provider (LemonLDAP::NG) and the chat tenants (Matrix/Synapse). It exposes standard OIDC endpoints (`/api/oidc/authorize`, `/api/oidc/token`) used by deployed chat instances for user authentication.

## Prerequisites

| Service                       | Purpose                                                  |
| ----------------------------- | -------------------------------------------------------- |
| LemonLDAP::NG (OIDC provider) | The proxy connects to the OIDC issuer for authentication |

## How it works

The SSO proxy acts as a bridge between individual Synapse instances and the central LemonLDAP::NG identity provider. Each chat tenant is configured to use the proxy's OIDC endpoints instead of connecting directly to LemonLDAP, allowing centralized SSO management across all B2B chat deployments.

## Deployment

The proxy is typically deployed in the `auth` namespace alongside the identity provider. It exposes an ingress for the OIDC endpoints.

### Helm chart

Chart: `twake-chat-b2b-oidc-proxy`

### Environment variables

| Variable             | Source       | Description                                                                        |
| -------------------- | ------------ | ---------------------------------------------------------------------------------- |
| `OIDC_ISSUER_URL`    | values.yaml  | URL of the OIDC identity provider (e.g. `https://auth.twake.app`)                  |
| `PROXY_URL`          | values.yaml  | Public URL of this proxy (e.g. `https://oidc-proxy.twake.app`)                     |
| `OIDC_CLIENT_ID`     | secrets.yaml | OIDC client ID registered in LemonLDAP (sync with [LemonLDAP config](./lemonldap)) |
| `OIDC_CLIENT_SECRET` | secrets.yaml | OIDC client secret for the above client                                            |
| `NODE_ENV`           | values.yaml  | Runtime environment (e.g. `production`)                                            |
