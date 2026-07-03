---
title: CI/CD
sidebar_position: 1
---

Every service in the monorepo follows the same CI/CD pattern: GitHub Actions validate pull requests, publish `latest` images on merge to `main`, and publish versioned images when a release tag is pushed. All Docker images are stored in a private [Harbor](https://goharbor.io/) registry at `docker-registry.linagora.com`.

Helm charts are managed separately in GitLab and published to the same Harbor registry.

- [**GitHub Actions**](./github-actions) -- workflow templates for PR validation, Docker image builds, and release publishing
- [**Helm Charts**](./helm-charts) -- chart skeleton, template files, and GitLab CI pipeline for publishing to Harbor
- [**Deployment Secrets**](./secrets) -- how SOPS and OpenBao secrets reach a release, and how to wire a new one
