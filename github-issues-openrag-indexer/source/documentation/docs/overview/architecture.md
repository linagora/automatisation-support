---
title: Architecture
---

Twake Workplace runs as a set of independent services inside a Kubernetes cluster on OVH, fronted by Traefik and authenticated through LemonLDAP::NG.

:::note
Two production environments are in active use: **Twake SaaS** (`*.twake.app`) and **LINAGORA** (`*.linagora.com`). They share the same service fabric. Cozy infrastructure (cozy-stack, CouchDB, Swift, Cloudery, Registry) lives on a separate network and is reached over HTTPS and an IP-whitelisted RabbitMQ bridge. See [Environments](./environments) for per-environment hostnames.
:::

## Production Topology

The topology is broken out per subsystem so each diagram stays readable at normal page widths. The [RabbitMQ](./rabbitmq) page documents the event bus separately.

### Ingress and authentication

Browser and mobile traffic always lands on Traefik; CrowdSec acts as an IP-level WAF. LemonLDAP owns user authentication; the OIDC B2B proxy exists because some chat B2B deployments need a distinct OIDC client identity from the main SaaS tenant.

```mermaid
graph TB
    classDef gateway fill:#e74c3c,stroke:#c0392b,color:#fff
    classDef security fill:#c0392b,stroke:#922b21,color:#fff
    classDef auth fill:#9b59b6,stroke:#8e44ad,color:#fff
    classDef platform fill:#1abc9c,stroke:#16a085,color:#fff
    classDef database fill:#f39c12,stroke:#e67e22,color:#fff

    USER(("Browser / Mobile"))

    subgraph INGRESS["Ingress"]
        TRAEFIK["Traefik<br/>HTTP / HTTPS"]:::gateway
        TRAEFIK_TCP["Traefik TCP<br/>SMTP / IMAP"]:::gateway
        CROWDSEC["CrowdSec WAF"]:::security
    end

    subgraph AUTH["Auth"]
        LEMON["LemonLDAP::NG<br/>sso.twake.app"]:::auth
        OIDC_PROXY["OIDC B2B Proxy<br/>oidc-proxy.twake.app"]:::auth
    end

    subgraph DIR["Directory"]
        OPENLDAP[("OpenLDAP")]:::database
        LDAP_REST["LDAP REST<br/>ldap-rest.twake.app<br/>HMAC only"]:::platform
    end

    REG["Registration<br/>sign-up.twake.app"]:::platform
    ADMIN["Admin Panel Backend<br/>admin-panel-backend.twake.app"]:::platform

    USER -->|HTTPS| TRAEFIK
    USER -->|SMTP / IMAP| TRAEFIK_TCP
    CROWDSEC -.->|filters| TRAEFIK

    TRAEFIK --> LEMON
    TRAEFIK --> REG
    TRAEFIK --> ADMIN
    TRAEFIK --> OIDC_PROXY

    REG -->|OIDC| LEMON
    ADMIN -->|session validate| LEMON
    LEMON -->|LDAP bind| OPENLDAP

    REG -->|HMAC| LDAP_REST
    ADMIN -->|HMAC| LDAP_REST
    LDAP_REST -->|LDAP ops| OPENLDAP
```

### Cozy Stack

cozy-stack serves per-user instances for Drive, Notes, Home, and Settings. It stores documents in CouchDB and keeps file blobs on Swift. OnlyOffice handles document editing and uses PostgreSQL.

```mermaid
graph TB
    classDef frontend fill:#3498db,stroke:#2980b9,color:#fff
    classDef backend fill:#2ecc71,stroke:#27ae60,color:#fff
    classDef database fill:#f39c12,stroke:#e67e22,color:#fff
    classDef storage fill:#e67e22,stroke:#d35400,color:#fff

    APPS["Drive / Notes / Home / Settings<br/>{uid}-{app}.*"]:::frontend
    STACK["cozy-stack<br/>{uid}.*"]:::backend
    OO["OnlyOffice<br/>{uid}-office.*"]:::backend
    CD[("CouchDB")]:::database
    SW[("Swift")]:::storage
    PG[("PostgreSQL")]:::database

    APPS --> STACK
    STACK --> CD
    STACK --> SW
    STACK --> OO
    OO --> PG
```

### TMail

Apache James is the backend, accessed over JMAP from the Flutter web client. Cassandra holds mail data, OpenSearch provides full-text search, and attachments go to OVH S3.

```mermaid
graph TB
    classDef frontend fill:#3498db,stroke:#2980b9,color:#fff
    classDef backend fill:#2ecc71,stroke:#27ae60,color:#fff
    classDef database fill:#f39c12,stroke:#e67e22,color:#fff
    classDef storage fill:#e67e22,stroke:#d35400,color:#fff

    MWEB["tmail-web<br/>mail.twake.app"]:::frontend
    MBACK["tmail-backend<br/>Apache James"]:::backend
    PUSH["Mail push<br/>push.twake.app"]:::backend
    CAS[("Cassandra")]:::database
    OS[("OpenSearch")]:::database
    S3[("OVH S3")]:::storage

    MWEB -->|JMAP| MBACK
    PUSH --> MBACK
    MBACK --> CAS
    MBACK --> OS
    MBACK --> S3
```

### TChat

Synapse handles Matrix protocol. TOM bridges Synapse with Twake-specific APIs (reading Synapse's PostgreSQL directly for lookups) and keeps its own state in KVRocks. Fed covers federated identity.

```mermaid
graph TB
    classDef frontend fill:#3498db,stroke:#2980b9,color:#fff
    classDef backend fill:#2ecc71,stroke:#27ae60,color:#fff
    classDef database fill:#f39c12,stroke:#e67e22,color:#fff

    WEB["twake-web<br/>chat.twake.app"]:::frontend
    SYN["Synapse<br/>matrix.twake.app"]:::backend
    TOM["TOM<br/>tom.twake.app"]:::backend
    FED["Fed<br/>fed.twake.app"]:::backend
    KV[("KVRocks")]:::database
    PG[("PostgreSQL")]:::database

    WEB --> SYN
    WEB --> TOM
    TOM --> SYN
    TOM -->|direct read| PG
    TOM --> KV
    SYN --> PG
    FED --> PG
```

### Meet

Video meetings served by `lasuite-meet`, with recordings and artefacts stored in a dedicated MinIO.

```mermaid
graph TB
    classDef backend fill:#2ecc71,stroke:#27ae60,color:#fff
    classDef database fill:#f39c12,stroke:#e67e22,color:#fff
    classDef storage fill:#e67e22,stroke:#d35400,color:#fff

    MEET["lasuite-meet<br/>meet.twake.app"]:::backend
    MIN[("MinIO<br/>minio.meet.*")]:::storage
    PG[("PostgreSQL")]:::database

    MEET --> MIN
    MEET --> PG
```

### Platform control plane and external integrations

Registration and Admin Panel drive the lifecycle of users, organisations, and per-user instances. Lifecycle events flow over RabbitMQ; [Cloudery](../cloudery/) and Registry are reached over HTTPS on a separate network.

```mermaid
graph TB
    classDef platform fill:#1abc9c,stroke:#16a085,color:#fff
    classDef bus fill:#e74c3c,stroke:#c0392b,color:#fff
    classDef external fill:#9b59b6,stroke:#8e44ad,color:#fff

    REG["Registration"]:::platform
    ADMIN["Admin Panel Backend"]:::platform
    CS["Common Settings"]:::platform
    SCP["SaaS Control Plane"]:::platform
    SENT["ALTCHA Sentinel"]:::platform

    RABBIT["RabbitMQ<br/>event bus"]:::bus

    CLOUDERY["Cloudery"]:::external
    REGISTRY["Registry"]:::external
    SMS["Octopush / Twilio"]:::external

    REG -->|provision| CLOUDERY
    REG -->|SMS OTP| SMS
    REG -->|CAPTCHA| SENT
    ADMIN -->|invitations| REG

    REG ==> RABBIT
    ADMIN ==> RABBIT
    CS ==> RABBIT
    CLOUDERY ==> RABBIT
    RABBIT ==> SCP
    RABBIT ==> CLOUDERY
    RABBIT ==> REGISTRY
```

Thick arrows denote RabbitMQ event flow. See [Authentication](./authentication) for the service-to-service auth mechanisms and [RabbitMQ](./rabbitmq) for the event bus topology.

## Platform Services

Hostnames live in [Environments](./environments) and are not repeated here. This table captures what each service is and how it is built.

| Service                  | Tech               | Role                                                                          |
| ------------------------ | ------------------ | ----------------------------------------------------------------------------- |
| Landing pages            | `tilda-to-nginx`   | Public marketing pages                                                        |
| Registration             | SvelteKit + PG     | B2C/B2B signup, login, OTP, recovery, provisioning. Also SSO entry point.    |
| LemonLDAP portal         | `yadd/llng`        | SSO / OIDC provider                                                           |
| LemonLDAP Manager        | `yadd/llng`        | Admin UI for LLNG configuration                                               |
| Admin Panel Backend      | Express.js + PG    | Session validation, HMAC proxy to LDAP REST, DNS validation, lifecycle events |
| LDAP REST                | Node.js            | REST API over OpenLDAP, HMAC-SHA256 only (no browser access)                  |
| Common Settings          | Node.js + PG       | Shared settings across apps, broadcasts updates via RabbitMQ                  |
| SaaS Control Plane       | -                  | Platform orchestration, consumes lifecycle events                             |
| OIDC B2B proxy           | -                  | B2B chat OIDC proxy                                                           |
| ALTCHA Sentinel          | Altcha             | Anti-bot challenge service used by Registration                               |
| Cozy Stack               | Go                 | Per-user instances serving Drive, Notes, Home, Settings                       |
| OnlyOffice               | -                  | Document editing                                                              |
| TMail backend            | Apache James       | JMAP, SMTP, IMAP (internal)                                                   |
| TMail web                | Flutter            | Email frontend                                                                |
| Mail push                | -                  | Mobile push notifications                                                     |
| TChat web                | React              | Chat frontend                                                                 |
| Synapse                  | Matrix             | Chat backend                                                                  |
| Synapse Sliding Sync v3  | Matrix             | Matrix sync v3 proxy                                                          |
| TOM server               | Node.js            | Twake identity / gateway, reads Synapse PG directly                           |
| Federated identity       | Node.js            | Federated identity service                                                    |
| Meet                     | lasuite-all-in-one | Video meeting service with dedicated MinIO object store                       |

TCalendar (SabreDAV + side-service) is not yet in SaaS production; see the [Twake Calendar](../tcalendar) section.

## Databases

| Database   | Location                     | Used by                                                                                   | Notes                                     |
| ---------- | ---------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------- |
| OpenLDAP   | K8s `dbs`                    | All apps via LemonLDAP + LDAP REST                                                        | B2C + B2B directory                       |
| PostgreSQL | OVH managed                  | synapse, tom, fed, LLNG, signup-db, admin-panel-db, common-settings, OnlyOffice           | External to the cluster, multiple DBs     |
| MongoDB    | K8s `dbs` (STG only)         | TCalendar work-in-progress                                                                | Not enabled in current PRD                |
| Redis      | K8s `dbs`                    | Shared cache                                                                              | Both standalone and HA deployments exist  |
| RabbitMQ   | K8s `dbs`                    | All apps (event bus)                                                                      | TLS certs, IP whitelisting for partners   |
| KVRocks    | K8s `kvrocks`                | TChat (TOM)                                                                               | Persistent Redis-compatible               |
| OpenSearch | K8s `tmail`                  | TMail                                                                                     | Full-text search                          |
| Cassandra  | OVH (outside K8s)            | TMail                                                                                     | Email storage                             |

## Object Storage

| Technology | Used by            | Content                                    |
| ---------- | ------------------ | ------------------------------------------ |
| Swift      | Cozy Stack         | User files                                 |
| OVH S3     | TMail              | Email blobs                                |
| MinIO      | Meet               | Meet recordings and artefacts              |

## Data Flow Examples

### B2C registration

```mermaid
sequenceDiagram
    participant U as User
    participant R as Registration
    participant LR as LDAP REST
    participant C as Cloudery
    participant MQ as RabbitMQ
    participant CS as cozy-stack

    U->>R: Submit signup form
    R->>R: Phone/email OTP (Octopush/Twilio)
    R->>LR: Create user (HMAC)
    R->>C: Provision Cozy instance
    R->>MQ: publish user.created (auth exchange)
    MQ->>CS: user.created
    CS->>CS: Provision instance artifacts
```

### B2B user creation

```mermaid
sequenceDiagram
    participant A as Admin (Browser)
    participant APB as Admin Panel Backend
    participant LLNG as LemonLDAP::NG
    participant LR as LDAP REST
    participant MQ as RabbitMQ
    participant SCP as SaaS Control Plane

    A->>APB: Create user
    APB->>LLNG: Validate session cookie
    LLNG-->>APB: Auth-User header
    APB->>LR: Create user in org branch (HMAC)
    APB->>MQ: domain.user.deleted / user.role.changed / dns.validated
    MQ->>SCP: lifecycle events
    APB->>MQ: app.installation.requested (b2b exchange)
```

### SSO login

End users never authenticate against the LemonLDAP portal directly - the Registration service acts as an OIDC proxy that applies the client-side PBKDF2 and server-side Scrypt hashing before LLNG performs the LDAP bind. See [SSO and OIDC Proxy](./sso) for the full sequence.

## Related Pages

- [Authentication](./authentication) - HMAC, OIDC, LLNG session handling
- [SSO and OIDC Proxy](./sso) - Registration as SSO entry point
- [LDAP Structure](./ldap-structure) - directory layout and schema
- [RabbitMQ](./rabbitmq) - exchanges, vhosts, producers, consumers
- [Environments](./environments) - PRD, STG, DEV, QA, Linagora URLs
- [Security](./security) - attack surface, trust boundaries, encryption
