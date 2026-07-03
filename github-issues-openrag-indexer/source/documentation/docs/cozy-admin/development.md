---
title: Development
sidebar_position: 5
---

## Prerequisites

- Node.js
- Yarn
- The Twake Workplace platform running (for full integration)

## Setup

```bash
git clone https://github.com/cozy/cozy-admin.git
cd cozy-admin
yarn install
```

## Commands

```bash
# Development
yarn start              # Start dev server (rsbuild dev)
yarn watch              # Build in watch mode

# Build
yarn build              # Production build
yarn analyze            # Analyze bundle with RSDOCTOR

# Testing
yarn test               # Run all tests
yarn test --watch       # Watch mode

# Linting
yarn lint               # Run all linters (js + styles)
yarn lint:js            # ESLint only
yarn lint:styles        # Stylint for Stylus files

# Security
yarn audit              # Check for vulnerabilities
```

## Contribution Workflow

Pull requests point to the `master` branch. The general flow is:

1. **Fork** the repository and clone your fork locally
2. **Branch** from `master`: `git checkout -b my-branch origin/master`
3. **Implement** your change, following the coding guidelines below
4. **Test** — add tests and ensure they pass: `yarn test`
5. **Commit** with a descriptive message following [conventional commits](https://www.conventionalcommits.org/)
6. **Rebase** to keep history clean: `git rebase origin/master my-branch`
7. **Push** to your fork and open a pull request against `master`

Pull requests are reviewed within a few days. Address review comments in a separate commit and post a comment in the PR afterwards.

## Coding Guidelines

### Imports

Always use the `@/` alias for `src/` imports:

```javascript
import React from "react";
import { useI18n } from "twake-i18n";
import Stack from "cozy-ui/transpiled/react/Stack";
import AppSelection from "@/components/Company/AppSelection";
import { isDomainVerified } from "@/components/helpers";
```

### Naming Conventions

| Kind          | Convention                                      |
| ------------- | ----------------------------------------------- |
| Components    | `PascalCase.jsx` (e.g., `Sidebar.jsx`)          |
| Utilities     | `camelCase.js` (e.g., `editShortcut.js`)        |
| Constants     | `UPPER_SNAKE_CASE` (e.g., `AUTH_ERROR_CODES`)   |
| Custom hooks  | Prefix with `use` (e.g., `useOrganization`)     |
| TS interfaces | In `types.ts` files (e.g., `src/components/types.ts`) |

### Testing

- Use `@testing-library/react` with `render` and `screen`
- Wrap components with `AppLike` from `test/AppLike.jsx`
- Mock external dependencies (e.g., `jest.mock('cozy-flags')`)
- Test both success and error paths
- For complex business logic: write tests first (TDD)

### Security

- Validate all inputs at system boundaries
- Never trust client-side data
- Report security issues privately to `security@cozycloud.cc` — do not open public issues

## Translations

Translations are managed on [Transifex](https://www.transifex.com/cozy/). If you modify the source locale file for your feature, update it and let the translation platform sync. Use `yarn why <package>` after dependency updates to check if `resolutions` in `package.json` can be removed.
