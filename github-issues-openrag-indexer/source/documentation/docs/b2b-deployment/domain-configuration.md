---
title: Domain Configuration
sidebar_position: 2
---

Organizations must configure DNS records to use their own domain with Twake. The process has three steps: domain verification (mandatory), email configuration (optional), and chat/Matrix configuration (optional).

## Step 1 -- Domain verification (required)

The organization owner must prove domain ownership by adding a TXT record.

| Field          | Value                         |
| -------------- | ----------------------------- |
| Record type    | **TXT**                       |
| Name / Label   | `example.com`                 |
| Target / Value | `twake-verification=<org-id>` |

DNS propagation can take several minutes to hours depending on the provider. Once the record is created, the owner clicks "Check configuration" in the admin panel to confirm ownership.

After successful verification, the organization can configure email and/or chat on the domain.

## Step 2 -- Email configuration (optional)

To receive and send emails using the organization's domain, the following DNS records must be added.

### MX records (incoming email)

| Type | Name          | Target / Value  | Priority |
| ---- | ------------- | --------------- | -------- |
| MX   | `example.com` | `mx1.twake.app` | 10       |

Validation currently checks against a single MX hostname (`DNS_MX`). Configuring a secondary MX (e.g. `mx2.twake.app` with priority `20`) for redundancy is encouraged, but the DNS validator does not enforce its presence.

### SPF (authorize Twake to send email)

| Type | Name          | Value                               |
| ---- | ------------- | ----------------------------------- |
| TXT  | `example.com` | `v=spf1 include:spf.twake.app ~all` |

### DKIM (cryptographic email signature)

Three CNAME records delegate DKIM signing to Twake:

| Type  | Name                            | Target                        |
| ----- | ------------------------------- | ----------------------------- |
| CNAME | `twake1._domainkey.example.com` | `twake1._domainkey.twake.app` |
| CNAME | `twake2._domainkey.example.com` | `twake2._domainkey.twake.app` |
| CNAME | `twake3._domainkey.example.com` | `twake3._domainkey.twake.app` |

### DMARC (anti-spoofing policy)

| Type | Name                 | Value                    |
| ---- | -------------------- | ------------------------ |
| TXT  | `_dmarc.example.com` | `v=DMARC1; p=quarantine` |

After creating these records, wait for DNS propagation and click "Check configuration". Once validated, the organization can send and receive emails using `user@example.com` from Twake.

## Step 3 -- Chat / Matrix configuration (optional)

To use the organization's domain for chat and Matrix federation, create CNAME records pointing subdomains to the Twake infrastructure.

| Type  | Name                 | Target                |
| ----- | -------------------- | --------------------- |
| CNAME | `matrix.example.com` | `lb-b2b.linagora.com` |
| CNAME | `tom.example.com`    | `lb-b2b.linagora.com` |
| CNAME | `chat.example.com`   | `lb-b2b.linagora.com` |

Only HTTP(S) traffic is required on these subdomains -- no email records (MX/SPF/DKIM/DMARC) are needed.

After creating the records, wait for DNS propagation and click "Check configuration". Once validated, users can access Twake chat and Matrix federation via the organization's subdomains and use Matrix IDs based on the domain (e.g. `@user:example.com`).
