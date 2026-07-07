---
title: Getting Started
sidebar_position: 4
---

## Prerequisites

- **Docker** and **Docker Compose** installed
- Ports **80** and **443** available
- Access to `docker-registry.linagora.com:5000` (for LinShare images)

## 1. Clone the repository

```bash
git clone https://github.com/linagora/twake-workplace-docker.git
cd twake-workplace-docker
```

## 2. Configure DNS

All services run under `*.twake.local` by default. Add these entries to `/etc/hosts`:

```
127.0.0.1  linshare.twake.local admin-linshare.twake.local upload-request-linshare.twake.local
127.0.0.1  meet.twake.local onlyoffice.twake.local calendar.twake.local contacts.twake.local
127.0.0.1  account.twake.local excal.twake.local mail.twake.local jmap.twake.local
127.0.0.1  oauthcallback.twake.local manager.twake.local auth.twake.local
127.0.0.1  tcalendar-side-service.twake.local sabre-dav.twake.local calendar-ng.twake.local
127.0.0.1  chat.twake.local matrix.twake.local tom.twake.local fed.twake.local traefik.twake.local
127.0.0.1  user1.twake.local user1-home.twake.local user1-linshare.twake.local user1-drive.twake.local
127.0.0.1  user1-settings.twake.local user1-mail.twake.local user1-chat.twake.local user1-notes.twake.local user1-dataproxy.twake.local
127.0.0.1  user2.twake.local user2-home.twake.local user2-linshare.twake.local user2-drive.twake.local
127.0.0.1  user2-settings.twake.local user2-mail.twake.local user2-chat.twake.local user2-notes.twake.local user2-dataproxy.twake.local
127.0.0.1  user3.twake.local user3-home.twake.local user3-linshare.twake.local user3-drive.twake.local
127.0.0.1  user3-settings.twake.local user3-mail.twake.local user3-chat.twake.local user3-notes.twake.local user3-dataproxy.twake.local
```

## 3. Create the shared network

```bash
docker network create twake-network --subnet=172.27.0.0/16
```

## 4. Start the stack

### Full stack (recommended)

```bash
./wrapper.sh up -d
```

The wrapper starts each layer in order, waits for health checks to pass, then proceeds to the next layer. This can take several minutes on the first run.

### Individual layers

Start layers one at a time if you want more control:

```bash
./wrapper.sh up -d twake_db      # Databases first
./wrapper.sh up -d twake_auth    # SSO + reverse proxy
./wrapper.sh up -d cozy_stack    # Personal cloud hub
./wrapper.sh up -d onlyoffice_app
./wrapper.sh up -d meet_app
./wrapper.sh up -d calendar_app
./wrapper.sh up -d chat_app      # Needs LemonLDAP healthy
./wrapper.sh up -d tmail_app     # Needs LemonLDAP healthy
```

:::caution Startup order matters
`twake_db` must come first, then `twake_auth`. The `chat_app` and `tmail_app` layers depend on LemonLDAP being healthy and will fail if started too early.
:::

## 5. Trust the CA certificate

Twake Workplace Docker generates a **self-signed CA** on first startup. Cozy Stack embeds other apps in iframes, and browsers block iframes from origins with untrusted certificates.

Import the CA into your system or browser trust store:

```
twake_auth/traefik/ssl/root-ca.pem
```

Without this step, applications loaded inside Cozy (Mail, LinShare, Chat, etc.) will not render correctly.

## 6. Access the platform

Open your browser and navigate to one of the pre-seeded user instances:

| URL                 | Login   | Password |
| ------------------- | ------- | -------- |
| `user1.twake.local` | `user1` | `user1`  |
| `user2.twake.local` | `user2` | `user2`  |
| `user3.twake.local` | `user3` | `user3`  |

SSO-protected services (Chat, Mail, Meet, Calendar) redirect to the LemonLDAP portal at `auth.twake.local`.

## Stopping the stack

```bash
./wrapper.sh down           # Stop all layers (reverse order)
./wrapper.sh down tmail_app # Stop a single layer
```

## Troubleshooting

**Services fail to start:**

Check that all containers from the previous layer are healthy before proceeding:

```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```

**Port conflicts:**

```bash
sudo lsof -i :80 -i :443
```

**Iframes show blank or security errors:**

The self-signed CA is not trusted. Import `twake_auth/traefik/ssl/root-ca.pem` into your browser.

**LemonLDAP takes a long time:**

LemonLDAP can take up to 5 minutes to become healthy on the first startup. The wrapper script waits automatically.
