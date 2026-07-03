---
title: Security
sidebar_position: 4
---

Twake Chat provides three security levels for encryption key management, allowing organizations to choose the right balance between convenience and security.

## Transport security

All communication enforces HTTPS with TLS 1.3 or higher. Internal component communication uses HTTPS or mTLS. Authentication uses OIDC (via LemonLDAP::NG) with mandatory SSO for enterprise deployments.

## Encryption levels

### Level 1: Server-assisted key storage

The default for public SaaS. A recovery key is generated on the client device, encrypted using a secret derived from the user's password, and stored on the server. The server cannot decrypt it without the password.

**Trade-off:** Convenient for new users but security depends on password strength.

### Level 2: User-defined cipher secret

The user manually defines a cipher secret (separate from their password) to encrypt the recovery key before server storage. This reduces reliance on password strength.

**Trade-off:** Stronger than Level 1, but the user must remember their cipher secret.

**Suitable for:** SaaS, Company SaaS, and On-Premise deployments requiring higher security.

### Level 3: User-managed key (external storage)

The recovery key is never stored on the server. The user is solely responsible for storing it externally and providing it on each new device login.

**Trade-off:** Maximum security but requires disciplined key management.

**Suitable for:** Organizations with highly sensitive data and strict compliance requirements (Company SaaS, On-Premise).

## Key management and recovery

### Device verification

New devices are verified using standard Matrix methods:

- **QR code scanning** -- scan a code from a trusted device
- **Security emoji comparison** -- compare emoji sequences between devices

### Emergency key management

An "emergency" option allows users to erase and regenerate their encryption keys. For Level 2 users, it also enables changing the cipher secret.

## GDPR compliance

- User data ownership follows deployment model (user-centric for public SaaS, company-centric for enterprise)
- Account deletion triggers GDPR erasure across all services (see [ADR 034](../adrs/adr-034))
- Back-channel logout ensures session termination across services (see [ADR 035](../adrs/adr-035))
- Transparent data access mechanisms notify all members when authorized access occurs in company-managed spaces
