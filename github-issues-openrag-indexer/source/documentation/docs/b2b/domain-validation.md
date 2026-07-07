---
title: Domain validation
sidebar_position: 5
---

B2B organizations bring their own domain. Before the domain can be used for mail or chat, Twake has to verify that the organization actually owns it. Admin Panel Backend owns the validation mechanism: it stores per-org validation state in PostgreSQL, runs live DNS lookups on demand, and mirrors the booleans back to LDAP so other services can check validity without re-doing DNS work.

For the customer-facing DNS record cheat-sheet (what to paste at their registrar), see [Domain Configuration](../b2b-deployment/domain-configuration.md). This page is about how validation actually runs.

## What gets validated

Three independent groups, validated separately:

- **`topdomain`** — a single `TXT` record proving control: `example.com → twake-verification=<challenge-token>`.
- **`mail`** — `MX` + `SPF` + three `DKIM` CNAMEs + `DMARC`. All four must pass for mail to be valid.
- **`chat`** — three CNAMEs: `matrix.<domain>`, `tom.<domain>`, `chat.<domain>`. All three must pass.

`topdomain` must pass before mail or chat makes sense. Mail and chat are independent after that — an org can ship with chat only, or mail only, or both.

## Where state lives

Validation state is split between PostgreSQL (authoritative, fine-grained, timestamped) and LDAP (booleans only, for cross-service consumption).

| State                                | Store                     | Written by           | Read by                  |
| ------------------------------------ | ------------------------- | -------------------- | ------------------------ |
| `challengeToken` per org             | Admin Panel Backend PG    | On org onboarding    | DNS validator, admin UI  |
| Per-record validity + timestamps     | Admin Panel Backend PG    | DNS validator        | Admin UI, support        |
| `isTopLevelDomainValid` (boolean)    | LDAP                      | DNS validator        | Dashboard, other services |
| `isChatDomainValid` (boolean)        | LDAP                      | DNS validator        | Chat Control Plane       |
| `isMailDomainValid` (boolean)        | LDAP                      | DNS validator        | Mail routing             |

The LDAP booleans are **derived** from PostgreSQL state. There is no background reconciliation job: if the LDAP write fails on a given run, the booleans stay stale until the next successful `POST /dns/validate/:appType` call re-writes them. PG is the truth; LDAP is a read-mostly mirror for services that prefer a boolean over a PG lookup.

## Validation endpoint

Admin Panel Backend exposes three endpoints (all LLNG-session authenticated, org resolved from the user):

| Endpoint                        | What it does                                                    |
| ------------------------------- | --------------------------------------------------------------- |
| `GET /api/v1/dns/status`        | Returns current booleans + `validatedAt` timestamps (no lookup) |
| `GET /api/v1/dns/records`       | Returns expected records + current status (for the admin UI)    |
| `POST /api/v1/dns/validate/:appType` | Runs live DNS lookups for `topdomain`, `mail`, or `chat`  |

Validation is admin-triggered, not background. The org admin clicks "Check configuration" in the admin panel; that fires a `POST /dns/validate/topdomain` (or `mail`, `chat`). Admin Panel Backend does the DNS lookup, updates PG, updates LDAP booleans if needed, and returns the result synchronously.

There is no cron retry. If the admin forgets to come back after DNS propagation, the records stay "invalid" until the next manual click.

## Validation rules (the interesting ones)

Most of these are simple exact-match. A few have subtlety worth knowing:

- **SPF**: must start with `v=spf1` and *must contain* `include:twake.app`. Other mechanisms are allowed — customers can keep their existing SPF and just add Twake's `include`.
- **DMARC**: must start with `v=DMARC1` and must match `\bp=${DNS_DMARC_POLICY}\b` at runtime. Default is `quarantine`; `reject` is also a valid value to configure. Only the configured policy is accepted on any given deployment — a record with `p=quarantine` won't pass if `DNS_DMARC_POLICY=reject`.
- **MX**: hostname match is case-insensitive with trailing-dot normalization; priority (10) is recommended but not enforced.
- **DKIM**: all three selectors (`twake1`, `twake2`, `twake3`) must resolve. Using CNAME-to-Twake lets Twake rotate keys without customer DNS changes.
- **CNAMEs** (chat + DKIM): case-insensitive hostname match with trailing-dot normalization.

The lookup is a plain DNS query against whatever resolver Admin Panel Backend is configured with. There is no caching layer beyond what the underlying resolver does.

## Partial failure shape

A group (e.g. `mail`) reports per-record details so the admin UI can highlight exactly what's wrong:

```json
{
  "appType": "mail",
  "valid": false,
  "validatedAt": "2026-04-22T10:10:00.000Z",
  "details": {
    "mx":    { "valid": true },
    "spf":   { "valid": true },
    "dkim":  { "valid": false, "error": "selector twake2 not found" },
    "dmarc": { "valid": true }
  }
}
```

The top-level `valid` is an AND of the sub-records.

## What happens after a validation attempt

On **every** `POST /dns/validate/:appType` call (not just a true→false or false→true flip), Admin Panel Backend:

1. Updates the PG row (booleans + timestamps, with the grace-period logic above).
2. Writes the corresponding boolean to LDAP (best-effort; errors are logged).
3. Publishes a `dns.validated` event on the `admin-panel` exchange (routing key `dns.validated`). The payload carries all three group booleans, so consumers can react to the latest state without having to remember which one flipped. **The key consumer is the Chat B2B Control Plane**: when the chat group first becomes valid, it triggers the GitLab pipeline that provisions Synapse + TOM. Once the pipeline finishes the control plane publishes `chat.deployment.completed`, which Admin Panel Backend consumes to batch-install the `chat` app per user.

**Only when the validation result itself is `valid: true`** does Admin Panel Backend also fan out per-user `app.install` messages (one per user in the org, slug `mail` / `chat`, so the apps appear on each user's Cozy instance — see [App provisioning](./app-provisioning.md)): `mail` fans out on any successful mail validation; `chat` fans out only if the chat server is also already deployed (otherwise the install runs later via the `chat.deployment.completed` handler). Failed validations update PG + LDAP + emit the DNS event but do not fan out any app install.

If you're adding a new behaviour that should react to a DNS flip, you have two options: subscribe to `dns.validated`, or read the LDAP boolean lazily the next time you care. The booleans are eventually consistent with PG (PG → LDAP write happens during validation, in-process), so reading them straight after a successful `POST /dns/validate/:appType` is safe.

## Reference

- Full mechanism doc: [`admin-panel-backend/docs/dns-validation.md`](https://github.com/linagora/twake-workplace-private/blob/main/admin-panel-backend/docs/dns-validation.md) — grace periods, PG schema, event fan-out in detail.
- API surface: [`admin-panel-backend/docs/api/dns-validation.md`](https://github.com/linagora/twake-workplace-private/blob/main/admin-panel-backend/docs/api/dns-validation.md)
- Customer-facing DNS cheat-sheet: [Domain Configuration](../b2b-deployment/domain-configuration.md)
- Code: `admin-panel-backend/src/services/dns.ts`, `dns-validator.ts`
