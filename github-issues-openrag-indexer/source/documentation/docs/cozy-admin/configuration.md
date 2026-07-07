---
title: Configuration
sidebar_position: 3
---

Cozy Admin is configured via feature flags injected by the Cozy platform at runtime using `cozy-flags`. Flags are set in the Cozy platform's administration interface and are available to the app as soon as it loads.

## Configuration

| Flag                       | Type     | Purpose                        |
| -------------------------- | -------- | ------------------------------ |
| `admin-panel.api.base-url` | `string` | Backend API URL                |
| `signup.url`               | `string` | Redirect URL on session expiry |

The `admin-panel.api.base-url` flag is required — it tells the frontend where the Admin Panel Backend API is running.

## Features

| Flag                            | Type      | Purpose                                   |
| ------------------------------- | --------- | ----------------------------------------- |
| `admin.nav-extended.enabled`    | `boolean` | Show Security, Drive, Passwords nav items |
| `admin.teams-search.enabled`    | `boolean` | Show search bar in Teams view             |
| `admin.invitation-mail.enabled` | `boolean` | Show email field in invitation dialog     |

## Development

| Flag                       | Type      | Purpose                          |
| -------------------------- | --------- | -------------------------------- |
| `debug`                    | `boolean` | Show React Query Devtools        |
| `admin.force-valid-domain` | `boolean` | Bypass domain verification check |
| `admin.force-has-offer`    | `boolean` | Bypass premium/freemium check    |

The development flags are useful for local testing when the full platform stack is not available or when testing UI states that depend on external validation.
