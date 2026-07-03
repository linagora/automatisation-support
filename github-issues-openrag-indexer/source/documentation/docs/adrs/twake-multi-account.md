---
title: "Twake Multi-Account"
sidebar_position: 31
---

## Context

Twake supports two types of user accounts:

- **B2C accounts** (`ou=users`): individual users who sign up directly
- **B2B accounts** (`ou=b2b`): users created within an organization

A person can have a B2C account and be a member of one or more B2B organizations simultaneously. Today, there is no explicit link between these accounts. The only shared signal is the phone number, but this is unreliable; an organization owner can assign a different phone number when creating the B2B user.

## Problem

Without a reliable link between B2C and B2B accounts, users have no way to:

- See the list of B2B organizations they belong to from their B2C account
- Easily switch back to their B2C account from within a B2B organization

## Proposed Solutions

### 1. LDAP attribute + LemonLDAP exposure via the SSO claims

Store the association directly in LDAP using a new attribute on each user entry (e.g., `twakeLinkedAccounts`) containing the emails of all associated accounts. LemonLDAP would expose this information in the userinfo endpoint or embed it in the access token. The stack consumes this data and persists the link in CouchDB.

**Pros:**

- LDAP is the source of truth; the link lives where the users live
- LemonLDAP already handles session/token enrichment, so the data flows naturally to consumers

**Cons:**

- Maintaining bidirectional references in LDAP adds complexity (both sides need updating on every account creation/deletion)
- Token size grows with the number of linked accounts (though in practice there is no hard limit, so this is not a blocking concern)

### 2. RabbitMQ event on account creation

When a B2B account is created, publish a RabbitMQ message so the stack can persist the B2C-to-B2B link in CouchDB (global instance).

**Pros:**

- Decoupled, LDAP doesn't need to know about account linking
- The stack already consumes RabbitMQ events

**Cons:**

- Eventual consistency, the link won't be available immediately after account creation
- If the message is lost or the consumer is down, the link is never created
- Only the stack knows about this relation

### 3. LDAP-REST in the home application (rejected)

Query LDAP-REST directly from the home frontend application to fetch linked accounts.

**Rejected** because the home app authenticates via LemonLDAP cookies (and stack cookie), while LDAP-REST only accepts HMAC-authenticated requests. This would require an intermediate proxy to translate the session cookie into HMAC credentials, adding unnecessary infrastructure complexity.

### 4. LDAP-REST in the stack

The stack calls LDAP-REST to fetch associated accounts from LDAP and exposes a new API route for frontend applications.

**Pros:**

- Frontend apps use their existing authentication (LemonLDAP cookie to stack) with no new proxy

**Cons:**

- Adds a new dependency path: frontend to stack to LDAP-REST to LDAP
- The stack becomes responsible for cross-branch search logic that may evolve with the LDAP structure

## Notes

- Represent the relations using groups in LDAP: [LDAP: les types de groupes](https://www.vincentliefooghe.net/content/ldap-les-types-groupes)
- In LDAP-REST create the relations on account creation
- We can develop a plugin in LemonLDAP that searches for this group relation and allows exchanging tokens between users in the same group
- The topbar can consume the information from the SSO (LemonLDAP)
- The topbar can be used to exchange tokens and provide them to embedded apps
