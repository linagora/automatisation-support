---
title: Feature Flags
sidebar_position: 5
---

Feature flags control the availability of features across Cozy applications. They can be set per-instance, per-context, or globally.

## Naming convention

```
namespace.(sub-namespace.)description
```

- `namespace` -- generally the app slug or library name
- `sub-namespace` -- the view or feature area (optional)
- `description` -- what the flag does

All sections use **kebab-case** (lowercase, hyphens).

**Examples:**

| Old name                | New name                     |
| ----------------------- | ---------------------------- |
| `hide_konnector_errors` | `home.hide-konnector-errors` |
| `debug-groups`          | `banks.debug-groups`         |
| `home_show_timeline`    | `home.timeline.show`         |
| `balance.no-account`    | `banks.balance.no-account`   |

## Activating flags

### In production

Use Bender for internal Cozy instances: https://bender.cozycloud.cc/contexts/prod/cozy_internal

### In development

Some apps have a `flags.js` file with flags to activate locally (e.g. [cozy-drive flags.js](https://github.com/cozy/cozy-drive/blob/master/src/lib/flags.js)). Add flags here during development and remove them when the flag is cleaned up.

## Flag types

There are 5 types of flags:

1. In the stack configuration across all environments
2. In the default flags of all environments
3. In the ratio flags (context) of all environments
4. Across all instances of all environments
5. In the cloud configuration

## Managing flags

Backend documentation:

- https://docs.cozy.io/en/cozy-stack/cli/cozy-stack_features/
- https://docs.cozy.io/en/cozy-stack/settings/#feature-flags
- https://docs.cozy.io/en/cozy-stack/admin/

## Cleaning up flags

### Frontend cleanup

1. Remove from the app (components and development switch flags)
2. Remove from Bender

### Backend cleanup

Clean up across all 6 environments and all 5 flag types. To find instances with a specific flag:

```bash
curl -qs $COUCH_URL/global%2Finstances/_all_docs?include_docs=true \
  | jq -r '.rows[].doc | select(.feature_flags | has("drive.onlyoffice.enabled")) | .domain'
```

## Flag reference

### Global

| Flag                                  | Description                                                              |
| ------------------------------------- | ------------------------------------------------------------------------ |
| `hide.healthTheme.enabled`            | Disables health data features across Mes Papiers, Banks, Drive           |
| `cozy.pushbanners.hide`               | Enables/disables mobile app promotion banners in Store                   |
| `cozy.oauthclients.max`               | Limits the number of OAuth clients per Cozy                              |
| `cozy.universal-link.disabled`        | Disable universal link redirection from Drive/Notes                      |
| `ui.darkmode.enabled`                 | Enables dark mode support                                                |
| `ui.theme-twake.enabled`              | Enables Twake theme                                                      |
| `cozy.searchbar.enabled`              | Displays the search bar (desktop/mobile web)                             |
| `cozy.searchbar.enabled-for-flagship` | Displays the search bar (flagship app)                                   |
| `cozy.search.enabled`                 | Enables the search feature                                               |
| `cozy.assistant.enabled`              | Enables the Cozy Assistant                                               |
| `cozy.b2b.enabled`                    | Enables B2B features (enterprise account)                                |
| `cozy.b2b.createBusinessAccountUrl`   | URL to create a business account                                         |
| `cozy.hide-sharing-cozy-to-cozy`      | When true, disables sharing by email                                     |
| `cozy.desktop-app-download-link`      | Forces a link for desktop app download buttons                           |
| `apps.hidden`                         | List of apps to hide in Home, Store, and Bar                             |
| `apps.hidden-in-home`                 | List of apps to hide only in Home                                        |
| `apps.sort`                           | Ordered list of apps to display first (e.g. `["chat", "drive", "mail"]`) |
| `bar.onlyoffice.enabled`              | Enables OnlyOffice shortcuts in the top bar app grid                     |

### Admin Panel

| Flag                             | Description                           |
| -------------------------------- | ------------------------------------- |
| `admin-panel.api.base-url`       | URL of the backend                    |
| `admin.nav-extended.enabled`     | Add extra navigation tabs             |
| `admin.teams-search.enabled`     | Display search bar                    |
| `admin.invitation-email.enabled` | Show email field in invitation dialog |
| `admin.force-valid-domain`       | Skip real domain validation           |
| `admin.force-has-offer`          | Skip real plan subscription check     |

### Drive

| Flag                                    | Description                                                           |
| --------------------------------------- | --------------------------------------------------------------------- |
| `drive.onlyoffice.enabled`              | Enables OnlyOffice                                                    |
| `drive.enable-encryption`               | Enables client-side encryption                                        |
| `drive.shared-drive.enabled`            | Enables shared drives                                                 |
| `drive.virtualization.enabled`          | Enables MUI virtualized table with drag-and-drop                      |
| `drive.doubleclick.enabled`             | Enables double-click on files/folders                                 |
| `drive.lasuitedocs.enabled`             | Enables creating Docs files from La Suite Numerique                   |
| `drive.default-updated-at-sort.enabled` | Sort by update date by default                                        |
| `drive.keyboard-shortcuts.enabled`      | Enables keyboard shortcuts (Ctrl+A/C/V/X, F2)                         |
| `drive.highlight-new-items.enabled`     | Highlights new files                                                  |
| `drive.save-sort-choice.enabled`        | Persists user sorting choice                                          |
| `drive.folder-personalization.enabled`  | Enables folder personalization                                        |
| `drive.update-favicon.enabled`          | Changes favicon by file type                                          |
| `drive.new-file-viewer-ui.enabled`      | Enables new file viewer UI                                            |
| `drive.dynamic-selection.enabled`       | Enables drag-to-select                                                |
| `drive.not-scanned-file-action.enabled` | Blocks actions on unscanned files                                     |
| `drive.summary`                         | JSON config for AI summarization (mime types, page limit, max tokens) |
| `drive.office`                          | JSON config for OnlyOffice (see below)                                |

### Embedded apps

| Flag                        | Description                       |
| --------------------------- | --------------------------------- |
| `mail.embedded-app-url`     | Twake Mail URL for cozy-twakemail |
| `chat.embedded-app-url`     | Twake Chat URL for cozy-twakechat |
| `calendar.embedded-app-url` | Twake Calendar URL                |
| `docs.embedded-app-url`     | Docs URL for cozy-lasuite-docs    |

### Settings

| Flag                          | Description                                           |
| ----------------------------- | ----------------------------------------------------- |
| `settings.subscription`       | Displays subscriptions page                           |
| `settings.2fa.enabled`        | Displays 2FA section                                  |
| `settings.matrix.enabled`     | Displays Matrix section                               |
| `settings.phone.enabled`      | Displays phone section                                |
| `settings.email.readonly`     | Makes email section read-only                         |
| `settings.password.readonly`  | Makes password section read-only                      |
| `settings.delete.enabled`     | Displays delete section                               |
| `settings.delete.byEmailOnly` | Sends deletion request to support instead of deleting |
| `signup.url`                  | Sign Up URL for change password/phone URLs            |

### Flagship app

| Flag                                  | Description                        |
| ------------------------------------- | ---------------------------------- |
| `flagship.backup.enabled`             | Enables photo backup               |
| `flagship.backup.dedup`               | Enables photo backup deduplication |
| `flagship.backup.includeSharedAlbums` | Uploads shared iCloud albums (iOS) |
| `flagship.iap.enabled`                | Enables in-app purchase button     |

### AI / RAG

| Flag                                          | Description                            |
| --------------------------------------------- | -------------------------------------- |
| `cozy.assistant.enabled`                      | Enables Cozy Assistant                 |
| `cozy.assistant.create-assistant.enabled`     | Enables specialized assistant creation |
| `cozy.assistant.search-conversation.enabled`  | Enables conversation search            |
| `cozy.assistant.source-knowledge.enabled`     | Enables source knowledge selection     |
| `cozy.assistant.conversation-sharing.enabled` | Enables conversation sharing           |
| `rag.index.image.enabled`                     | Allows indexing image files (stack)    |
| `rag.index.video.enabled`                     | Allows indexing video files (stack)    |
| `rag.index.audio.enabled`                     | Allows indexing audio files (stack)    |

## JSON flag examples

### `drive.office`

```json
{
  "enabled": true,
  "write": true,
  "defaultMode": "view",
  "touchScreen": {
    "enabled": true,
    "readOnly": true
  },
  "mobile": {
    "defaultMode": "view"
  }
}
```

- `enabled` -- enables OnlyOffice
- `write` -- enables edit mode (otherwise read-only)
- `defaultMode` -- `"view"` or `"edit"`
- `touchScreen.enabled` -- enables OnlyOffice on mobile
- `touchScreen.readOnly` -- disables edit mode on touch screens

### `harvest.accounts`

```json
{
  "max": 10,
  "maxByKonnector": {
    "default": 1,
    "ameli": 3,
    "luko": 4
  }
}
```

- `max` -- maximum connected accounts on the Cozy (all accounts combined)
- `maxByKonnector.default` -- default accounts per connector
- `maxByKonnector.<slug>` -- override for a specific connector

### `home.announcements`

```json
{
  "remoteDoctype": "cc.cozycloud.announcements",
  "channels": "cozy,cozy_internal",
  "delayAfterDismiss": 24
}
```

- `remoteDoctype` -- Strapi server (`cc.cozycloud.announcements` for prod)
- `channels` -- comma-separated distribution channels
- `delayAfterDismiss` -- hours between modal re-appearances (default: 24)
