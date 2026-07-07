---
title: Features
sidebar_position: 3
---

## Server features

### Team mailboxes

Shared email addresses managed collaboratively. Members can be assigned `manager` or `member` roles, and each team mailbox gets its own folder hierarchy.

Managed through the [WebAdmin API](https://github.com/linagora/tmail-backend/blob/master/docs/modules/ROOT/pages/tmail-backend/webadmin.adoc):

- `PUT /domains/{domain}/team-mailboxes/{name}` -- create a team mailbox
- `PUT /domains/{domain}/team-mailboxes/{name}/members/{user}?role=manager` -- add a member
- `GET /domains/{domain}/team-mailboxes` -- list team mailboxes for a domain

### Encrypted mailboxes

Server-side GPG encryption for mailbox content, following RFC-4880 and RFC-3156. When enabled, email bodies and attachments are encrypted at rest using per-user GPG keys.

### Rate limiting

Admin-configurable rate-limiting plans applied per user. Controls the number of emails a user can send within a given time window to prevent abuse and protect deliverability.

### Email recovery

Deleted messages are moved to a vault with configurable retention. Users can request recovery of up to 5 emails per request, within a 15-day restoration window by default.

### Contact auto-complete

Server-side contact indexing that powers the client's address auto-complete. Supports both personal contacts and domain-wide contact directories.

### JMAP extensions

TMail extends the standard JMAP protocol (RFC-8620, RFC-8621) with custom methods for:

- GPG key management and encrypted mailbox operations
- Team mailbox provisioning and membership
- Email filter rules (conditions + actions)
- Firebase push notification subscriptions
- Label management
- Public asset storage (e.g. email signature images)
- Per-user settings synchronization

### Email forwarding

Server-side forwarding rules with optional local copy retention, configured per user.

### Push notifications

Firebase Cloud Messaging (FCM) integration for real-time email notifications to mobile and web clients.

## Client features

### Email management

- Thread-based email view with collapsible conversations
- Rich-text composition with HTML editor
- Draft auto-save
- Attachment management with thumbnail previews
- Trash management and deleted message recovery

### Organization

- **Labels** -- custom labels with colors, visibility toggles, and bulk assignment
- **Filter rules** -- automated server-side rules with combined conditions and actions
- **Folder management** -- full mailbox hierarchy with create, rename, and delete
- **Identity management** -- multiple sender identities with HTML signatures

### Search

Advanced search with criteria including sender, recipient, subject, body, date ranges, and attachment filters.

### AI Scribe

AI-powered email composition assistant that suggests replies and helps draft emails. Integrated as a dedicated module in the client.

### Platform-specific features

| Feature                         | Web | Mobile |
| ------------------------------- | --- | ------ |
| Push notifications (FCM)        | Yes | Yes    |
| OIDC authentication             | Yes | Yes    |
| Deep links                      | --  | Yes    |
| Share intent (receive files)    | --  | Yes    |
| Offline mode                    | --  | Yes    |
| Application grid (app launcher) | Yes | --     |
| WebSocket real-time updates     | Yes | --     |

### Integrations

- **Cozy** -- file sharing with the Cozy ecosystem
- **TDrive** -- forward attachments directly to Twake Drive
- **Twake Workplace** -- settings synchronization via RabbitMQ
