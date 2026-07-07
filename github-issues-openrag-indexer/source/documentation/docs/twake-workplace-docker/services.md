---
title: Services
sidebar_position: 3
---

## Database layer (`twake_db`)

Shared backing stores consumed by the application layers.

| Service        | Image                           | Consumers                                            |
| -------------- | ------------------------------- | ---------------------------------------------------- |
| **PostgreSQL** | `postgres:16`                   | LinShare, Meet, Chat (Synapse, TOM, FED), OnlyOffice |
| **MongoDB**    | `mongo:6`                       | LinShare, Calendar                                   |
| **CouchDB**    | `couchdb:3.3.3`                 | Cozy Stack                                           |
| **OpenLDAP**   | `osixia/openldap:1.5.0`         | LemonLDAP, Chat (TOM), Calendar                      |
| **Valkey**     | `bitnamilegacy/valkey`          | Meet backend                                         |
| **RabbitMQ**   | `rabbitmq:3.13.3-management`    | Chat (TOM), Calendar, OnlyOffice                     |
| **Cassandra**  | `bitnamilegacy/cassandra:4.1.7` | TMail                                                |
| **MinIO**      | `bitnamilegacy/minio`           | TMail (S3-compatible blob storage)                   |

PostgreSQL uses init scripts in `twake_db/postgres/init-db-postgres/` to create per-service databases on first startup.

## Authentication & proxy (`twake_auth`)

| Service                 | Purpose                                                                   |
| ----------------------- | ------------------------------------------------------------------------- |
| **Traefik v2.11**       | Reverse proxy, TLS termination, host-based routing via Docker labels      |
| **LemonLDAP::NG**       | Web SSO portal, OIDC provider, authenticates against OpenLDAP             |
| **Docker Socket Proxy** | Exposes the Docker socket to Traefik without giving it full daemon access |

See [Authentication](./authentication) for the full SSO flow.

## Chat (`chat_app`)

Matrix-based messaging with a custom frontend.

| Service                             | Role                                                                    |
| ----------------------------------- | ----------------------------------------------------------------------- |
| **Synapse** (`v1.119.0`)            | Matrix homeserver, stores messages in PostgreSQL, syncs users from LDAP |
| **TOM Server**                      | Backend for the Twake Chat web client, handles OIDC auth and user sync  |
| **FED**                             | Federated identity service for Matrix federation                        |
| **Chat Web** (`linagora/twake-web`) | Nginx-served frontend at `chat.twake.local`                             |

TOM and FED each have their own PostgreSQL database. All three backends connect to RabbitMQ for event propagation.

## Email (`tmail_app`)

Full email stack based on Apache James.

| Service                                                         | Role                                                         |
| --------------------------------------------------------------- | ------------------------------------------------------------ |
| **TMail Backend** (`linagora/tmail-backend:distributed-1.0.13`) | JMAP, SMTP, and IMAP server backed by Cassandra + OpenSearch |
| **TMail Web** (`linagora/tmail-web`)                            | Web mail client at `mail.twake.local`                        |
| **OpenSearch** (`opensearch:2.18.0`)                            | Full-text email search and analytics                         |

TMail uses OIDC tokens from LemonLDAP for authentication. The JMAP API is exposed at `jmap.twake.local`.

## Meet (`meet_app`)

Video conferencing powered by LiveKit.

| Service                                     | Role                                                    |
| ------------------------------------------- | ------------------------------------------------------- |
| **LiveKit**                                 | Real-time media server (WebRTC), ports 7880/7881        |
| **Django Backend**                          | Meeting room management, OIDC auth, PostgreSQL + Valkey |
| **Frontend** (`ghcr.io/cozy/meet-frontend`) | Nginx-served web UI at `meet.twake.local`               |

## LinShare (`linshare_app`)

Secure file sharing and storage.

| Service               | Role                                                              |
| --------------------- | ----------------------------------------------------------------- |
| **Backend** (Tomcat)  | File management API, PostgreSQL + MongoDB                         |
| **User UI**           | End-user interface at `linshare.twake.local`                      |
| **Admin UI**          | Administration interface at `admin-linshare.twake.local`          |
| **Upload Request UI** | External upload requests at `upload-request-linshare.twake.local` |
| **Thumbnail Server**  | Generates file previews                                           |
| **ClamAV**            | Antivirus scanning for uploaded files                             |

:::note
LinShare images are hosted on `docker-registry.linagora.com:5000` and require authentication to pull.
:::

## Calendar (`calendar_app`)

CalDAV/CardDAV-based calendar and contacts.

| Service                      | Role                                                       |
| ---------------------------- | ---------------------------------------------------------- |
| **Twake Calendar Frontend**  | Next-gen calendar UI at `calendar-ng.twake.local`          |
| **Calendar Side Service**    | Supporting backend at `tcalendar-side-service.twake.local` |
| **Sabre DAV**                | CalDAV/CardDAV server at `sabre-dav.twake.local`           |
| **Legacy Calendar Frontend** | Original calendar UI at `calendar.twake.local`             |
| **Public Calendar**          | Public event sharing at `excal.twake.local`                |
| **Contacts**                 | Contact management at `contacts.twake.local`               |
| **Account**                  | Account settings at `account.twake.local`                  |

All calendar services use MongoDB for data storage and RabbitMQ for the event bus.

## OnlyOffice (`onlyoffice_app`)

| Service                                                            | Role                                                                                      |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| **OnlyOffice Document Server** (`onlyoffice/documentserver:8.0.1`) | Collaborative document, spreadsheet, and presentation editing at `onlyoffice.twake.local` |

Uses PostgreSQL and RabbitMQ from the database layer.

## Cozy Stack (`cozy_stack`)

| Service                                   | Role                                                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Cozy Stack** (`cozy/cozy-stack:1.6.44`) | Personal cloud platform, integration hub for all apps                                                   |
| **Patcher**                               | Init container that enables apps (mail, linshare, chat, calendar, meet, contacts) on each Cozy instance |

Cozy uses a **flat subdomain model**: each user gets a set of subdomains like `user1.twake.local`, `user1-home.twake.local`, `user1-mail.twake.local`, etc. Data is stored in CouchDB.
