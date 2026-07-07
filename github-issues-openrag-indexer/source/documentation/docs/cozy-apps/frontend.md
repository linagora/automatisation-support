---
title: Frontend Development
sidebar_position: 2
---

This guide covers setting up a frontend development workflow for Cozy apps.

## Prerequisites

- [nvm](https://github.com/nvm-sh/nvm)
- Node 20: `nvm install 20`
- Yarn: `npm install --global yarn`

## Launch an app locally

Example with cozy-drive:

```bash
git clone https://github.com/cozy/cozy-drive.git
cd cozy-drive
yarn install
yarn build
```

Tell the stack to use your local build:

```bash
cozy-stack serve --appdir drive:/path/to/your/repository/cozy-drive/build
```

For live development with hot reload, start the app in watch mode and disable CSP:

```bash
# Terminal 1
yarn start

# Terminal 2
cozy-stack serve --appdir drive:/path/to/your/repository/cozy-drive/build --disable-csp
```

## Key libraries

### cozy-ui

Shared component and style library.

- Repository: https://github.com/cozy/cozy-ui
- Components: https://docs.cozy.io/cozy-ui/react/
- Utility classes: https://docs.cozy.io/cozy-ui/styleguide/section-utilities.html

**macOS note:** cozy-ui uses GNU Sed for icon class generation. Install it with `brew install gnu-sed`.

### cozy-client

Data fetching and state management library for Cozy apps.

- Repository: https://github.com/cozy/cozy-client
- Tutorial: https://docs.cozy.io/en/tutorials/data/
- Getting started: https://docs.cozy.io/en/cozy-client/getting-started/

See [Data and cozy-client](./data-and-cozy-client) for a deeper introduction.

### cozy-doctypes

Data model definitions shared across the platform. If you add a new kind of data (e.g. a new field in contacts or a new setting), open a PR on the doctypes repository first.

- Repository: https://github.com/cozy/cozy-doctypes/

## Guidelines

Follow the [Cozy Guidelines](https://github.com/cozy/cozy-guidelines), especially the [commit message conventions](https://github.com/cozy/cozy-guidelines?tab=readme-ov-file#commit-messages).

## Working with services

App services are Node.js scripts executed server-side. They require specific configuration to run locally: https://docs.cozy.io/en/howTos/dev/services/

## Working with connectors

Connectors also need specific local configuration: https://docs.cozy.io/en/howTos/dev/run-connectors-on-local-cozy-stack/

## Working with ACH

Automated Cozy Hydrater (ACH) is a CLI for creating, requesting, and removing records in your Cozy: https://github.com/cozy/ACH
