---
title: Twake Drive
sidebar_position: 1
---

Twake Drive is the file storage, synchronisation, and sharing app of Twake Workplace. Users upload files and folders, organise them, share them with other users or through public links, and sync them across devices. Storage, file metadata, sharing, and permissions are handled by the Cozy stack; the Drive web client is a separate frontend that talks to the stack's API.

- Source: https://github.com/linagora/twake-drive

## Components

| Component   | Role                                                                        | Repository                                                       |
| ----------- | --------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Drive Web   | User-facing web client: file list, upload tray, sharing, public link views  | [twake-drive](https://github.com/linagora/twake-drive)          |
| Cozy Stack  | Backend API: file and folder storage, metadata, sharing, permissions, links | [cozy/cozy-stack](https://github.com/cozy/cozy-stack)           |
| Desktop app | Two-way file synchronisation between a local folder and the user's Drive    | [twake-drive](https://github.com/linagora/twake-drive)          |

## How it fits together

Every file lives under a parent directory in the user's Cozy instance. The stack exposes the `io.cozy.files` API the Drive clients use to create folders, upload content, and manage sharing. A folder created through the API shows up in both Drive Web and the Desktop app.

- **Backend reference** -- see the [Cozy Stack](../cozy-stack/) docs for the file API, [uploading files from another app](../cozy-stack/uploading-files), and [service tokens](../cozy-stack/service-tokens).
- **Local development** -- the Drive app is one of the apps you provision in a [Cozy development environment](../cozy-apps/); see [Frontend Development](../cozy-apps/frontend) for running it locally.

## Integration with Twake Workplace

- **Authentication**: users reach Drive through the standard SSO entry; their Cozy instance is provisioned per account.
- **Mail attachments**: Twake Mail can forward attachments directly into Twake Drive, and Calendar attachments are detached from events and stored in Drive.
- **Antivirus**: uploaded files are scanned with ClamAV (see [ADR 028](../adrs/adr-028)).

## Further reading

- [Drive Upload Mechanism](./drive-upload) -- how the upload queue, folder handling, limits, and name clashes behave.
