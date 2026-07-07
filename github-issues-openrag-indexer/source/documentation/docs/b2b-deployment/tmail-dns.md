---
title: Tmail DNS
sidebar_position: 5
---

This page covers the infrastructure-side DNS records that must exist on the Twake platform to support B2B custom domain email. These are records on `twake.app` itself, not on the customer's domain (for customer-side DNS, see [Domain Configuration](./domain-configuration)).

## MX records

Two mail servers must be prepared to handle incoming email for B2B organizations:

| Record          | Role                                    |
| --------------- | --------------------------------------- |
| `mx1.twake.app` | Primary mail server for premium users   |
| `mx2.twake.app` | Secondary mail server for premium users |

## SPF

Create `spf.twake.app` as a TXT record that customer domains will `include:`:

```
v=spf1 mx ip4:162.19.116.136/32 include:spf.mailjet.com ~all
```

## DKIM

Three domain key pairs must be created on the Twake infrastructure. Customer domains reference these via CNAME delegation.

| Selector                      | Notes                                         |
| ----------------------------- | --------------------------------------------- |
| `twake1._domainkey.twake.app` | Copy of existing `tmail._domainkey.twake.app` |
| `twake2._domainkey.twake.app` | New key pair                                  |
| `twake3._domainkey.twake.app` | New key pair                                  |

## Tmail configuration

Tmail must be configured to:

- Accept mail for customer domains routed through `mx1.twake.app` / `mx2.twake.app`
- Sign outbound mail with the appropriate DKIM selector for the sending domain
- Recognize the CNAME-delegated DKIM selectors (`twake1`, `twake2`, `twake3`)
