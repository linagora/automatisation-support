---
title: Deployment
sidebar_position: 2
---

Cozy Admin is a Cozy app published to the Cozy registry. It runs inside the Cozy Cloud platform, not as a standalone container.

## Building

```bash
cd cozy-admin
yarn install
yarn build
```

The production build outputs to `build/`.

## Publishing

The app is published to the Cozy registry using `cozy-app-publish`:

```bash
yarn run cozyPublish
```

This is handled automatically by the CI/CD pipeline on merges to `master` or version tags.

## Platform Requirements

Cozy Admin requires the Twake Workplace platform to be running. The platform provides:

- **Admin Panel Backend** - the API that Cozy Admin calls
- **LemonLDAP::NG** - SSO for user authentication
- **OpenLDAP** - user directory

## Configuration

The app is configured via feature flags injected by the Cozy platform. See [Configuration](./configuration) for the flag reference.

The critical flag is `admin-panel.api.base-url`, which points the frontend to the Admin Panel Backend API.

## CI/CD

The GitHub Actions pipeline (`ci-cd.yml`) handles:

1. **Lint** - ESLint and Stylint
2. **Test** - Jest unit tests
3. **Build** - Production build with Rsbuild
4. **Publish** - Push to Cozy registry (on `master` or version tags)
