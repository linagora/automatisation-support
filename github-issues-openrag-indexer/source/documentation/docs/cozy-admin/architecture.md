---
title: Architecture
sidebar_position: 4
---

## Project Structure

```
src/
  components/     # React components organized by feature
  lib/           # Utilities and shared logic
  providers/     # React context providers
  locales/       # i18n translation files
  queries/       # React Query configurations
  styles/        # Global Stylus styles
  targets/       # Build targets (browser, intents)
test/            # Test utilities and setup
```

Components are grouped by feature domain (e.g., `Company/`, `DeleteOrganization/`). Each feature folder contains its React components, Stylus styles, and co-located tests.

## Code Organization

- **One file per operation** — actions follow the pattern of one file per operation (add, edit, trash) in `actions/` directories
- **Feature-grouped components** — related components live together in folders
- **Co-located tests** — tests live alongside source files or in the `test/` directory

### Key Dependencies

| Dependency              | Role                               |
| ----------------------- | ---------------------------------- |
| `cozy-client`           | Cozy data layer and API client     |
| `cozy-ui`               | UI component library               |
| `@tanstack/react-query` | Data fetching and caching          |
| `twake-i18n`            | Internationalization               |
| `cozy-flags`            | Feature flag access                |
| `react-router-dom`      | Client-side routing                |

### Data Fetching

All server state is managed with React Query. Cozy-specific operations (document CRUD, file management) use `cozy-client`. HTTP errors use a custom `HttpError` class defined in `src/lib/errors.js`.

### Styling

Components use `cozy-ui` utility classes (e.g., `u-mb-half`, `u-flex-justify-between`) and Stylus files for component-specific styles. Global styles live in `src/styles/`.

### Internationalization

All user-visible strings go through `twake-i18n`. Translation source files are in `src/locales/` and synchronized with Transifex for community translations.
