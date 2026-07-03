---
title: Twake Chat
sidebar_position: 1
---

Twake Chat is a secure messaging and collaboration platform built on the open [Matrix Protocol](https://matrix.org/). It provides end-to-end encryption, granular administrative control, and flexible deployment options.

- Web: https://chat.twake.app
- iOS: [App Store](https://apps.apple.com/fr/app/twake-chat/id6473384641)
- Android: [Google Play](https://play.google.com/store/apps/details?id=app.twake.android.chat)
- Source: https://github.com/linagora/twake-on-matrix

## Deployment options

| Model                   | Description                                                       |
| ----------------------- | ----------------------------------------------------------------- |
| Public TOM server       | Publicly accessible Twake server                                  |
| SaaS domain model       | Hosted by Linagora, domain registration required, priced per user |
| On-premise domain model | Self-hosted on the customer's infrastructure                      |

## Components

| Component                | Description                                       | Repository                                                     |
| ------------------------ | ------------------------------------------------- | -------------------------------------------------------------- |
| Twake on Matrix (client) | Flutter-based chat client (web, mobile, desktop)  | [twake-on-matrix](https://github.com/linagora/twake-on-matrix) |
| TOM Server (identity)    | Identity server for user discovery and federation | [ToM-server](https://github.com/linagora/ToM-server/)          |
| Synapse                  | Matrix homeserver                                 | [element-hq/synapse](https://github.com/element-hq/synapse)    |

## Platform structure

The platform is organized hierarchically:

- **Company** -- represents an organization (e.g. Linagora, Acme Corp)
- **Channels** -- communication spaces within a company
  - **Private channels** -- internal company communications with ownership, admins, and participants
  - **Public channels** -- broader communication open to any Matrix-compatible user
- **Group chats** -- 2+ participant conversations with a name and role management
- **Direct messages (DM)** -- one-on-one conversations between users

## Entities

| Entity  | Description                                            |
| ------- | ------------------------------------------------------ |
| Profile | User's personal information and identifiers            |
| Contact | User's address book or contacts from the Matrix server |
| Message | Content within dialogues and chats                     |
| Thread  | A topic of discussion within a message                 |
| Post    | A message within a channel                             |

## Roles

| Role               | Scope                                             |
| ------------------ | ------------------------------------------------- |
| Owner              | Highest level of control over the company/channel |
| Administrator      | Manages channels and users                        |
| Editor             | Creates and modifies content                      |
| Participant/Member | Engages in communication                          |
| Guest/Follower     | Read-only access (public channels)                |

## Further reading

- [Features](../twake-chat/features) -- full feature reference
- [Architecture](../twake-chat/architecture) -- TOM server, identity services, and infrastructure
- [Security](../twake-chat/security) -- encryption levels and key management
