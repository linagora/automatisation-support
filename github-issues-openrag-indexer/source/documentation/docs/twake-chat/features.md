---
title: Features
sidebar_position: 2
---

## Messages

Messages can be: text, audio, video, link, document, image, geolocation, or contact.

**Attachments** can be sent as: plain text, file, video, audio, image, link, geolocation, or contact -- each optionally combined with text.

### Message actions

- Create, edit, delete, copy
- Reply, forward, select multiple
- Pin, jump to pinned
- Mark as unread
- Tag/mention users
- Social reactions (like/dislike)
- Add to favorites (with folder organization)
- Turn into a thread
- Send as email (TMail integration)
- View status: sent, delivered, read
- Block/report sender

## Threads

Threads are thematic discussions within chats and channels. They do not exist in direct messages.

### Thread actions

- Create, add media, comment, react
- Pin, forward, tag users, copy link
- Leave, mute, configure notifications

### Creator settings

- Add thread title
- Slow reply mode (30s / 1min / 2min / custom)
- Hide after inactivity period
- Sort/filter threads view

## Direct messages

- Open via contact list
- View contact info: name, avatar, status (online/offline/DND/invisible/typing)
- Block contact
- Pin conversation (for self or both)
- Mute notifications (temporary or permanent)
- Search within conversation
- Clear history (for self or both)
- Delete conversation
- Add to favorites
- Mark as unread, archive/hide

## Private channels

Roles: owner, administrator, member.

### Channel actions

- Create, name, rename, add avatar/description
- Create posts and threads
- Slow reply mode
- Delete channel (role-dependent)
- Invite/remove users and guests
- Create invitation link
- Leave channel
- View all members and roles
- Assign roles (admin/member)
- Create video chat
- Mute notifications

### Granular permissions

Configurable per role: edit channel, manage access, invite, send messages, post in threads, copy links, send files, add reactions, tag users, edit thread settings, join via link.

## Public channels

### Creator actions

- Create channel (with creation date, subscriber count, view count)
- Name, rename, add description/avatar
- Invite users via link or QR code
- Create/edit/delete posts with media
- Enable/disable commenting, reposting, reactions
- Activate/deactivate post signatures (admin authorship display)
- View admin action history (last 48 hours)
- Manage member roles, block/remove users

### Reader actions

- Join/leave channel
- Report channel
- Comment and react (if permitted)
- Copy link, forward (if permitted)
- Add to favorites

## Search

- Search within chats, channels, DMs, threads
- Search by message sending date
- Global search across users and channels

## User management

- Deactivate, delete, change status, add users
- Account deletion / offboarding from services
- Company statistics: user count, message count, recent activities

## Integrations

- **TDrive**: shared drive model for file management (see [ADR 006](../adrs/adr-006))
- **TMail**: send messages as email, email attachment actions (see [ADR 006](../adrs/adr-006))
- **SSO**: integration with existing SSO ecosystems for corporate installations
- **Jitsi**: video conferencing within channels
