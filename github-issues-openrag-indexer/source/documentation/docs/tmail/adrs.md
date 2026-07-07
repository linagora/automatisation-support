---
title: Architecture Decision Records
sidebar_position: 6
---

Both the TMail backend and client maintain their own ADR logs. This page groups the most significant decisions by topic and links to the source files.

## Backend ADRs

Located in [`james-project/src/adr/`](https://github.com/linagora/tmail-backend/tree/master/james-project/src/adr) (77 records). These cover the Apache James foundation that TMail extends. `james-project` is a git submodule of [`apache/james-project`](https://github.com/apache/james-project/tree/master/src/adr) (branch `master`), the canonical source for these ADRs.

### Distributed systems

| #    | Decision                                                                                                                                         |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0002 | [Make TaskManager distributed](https://github.com/linagora/tmail-backend/blob/master/james-project/src/adr/0002-make-taskmanager-distributed.md) |
| 0003 | [Distributed WorkQueue](https://github.com/linagora/tmail-backend/blob/master/james-project/src/adr/0003-distributed-workqueue.md)               |
| 0031 | [Distributed Mail Queue](https://github.com/linagora/tmail-backend/blob/master/james-project/src/adr/0031-distributed-mail-queue.md)             |
| 0037 | [Event bus](https://github.com/linagora/tmail-backend/blob/master/james-project/src/adr/0037-eventbus.md)                                        |
| 0038 | [Distributed Event bus](https://github.com/linagora/tmail-backend/blob/master/james-project/src/adr/0038-distributed-eventbus.md)                |
| 0046 | [Generalize EventBus](https://github.com/linagora/tmail-backend/blob/master/james-project/src/adr/0046-generalize-event-bus.md)                  |

### Storage and data consistency

| #    | Decision                                                                                                                                                                                |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0014 | [BlobStore storage policies](https://github.com/linagora/tmail-backend/blob/master/james-project/src/adr/0014-blobstore-storage-policies.md)                                            |
| 0020 | [Cassandra Mailbox object consistency](https://github.com/linagora/tmail-backend/blob/master/james-project/src/adr/0020-cassandra-mailbox-object-consistency.md)                        |
| 0022 | [Cassandra Message inconsistencies](https://github.com/linagora/tmail-backend/blob/master/james-project/src/adr/0022-cassandra-message-inconsistency.md)                                |
| 0025 | [Cassandra Blob Store Cache](https://github.com/linagora/tmail-backend/blob/master/james-project/src/adr/0025-cassandra-blob-store-cache.md)                                            |
| 0041 | [Replace JCloud with S3 SDK](https://github.com/linagora/tmail-backend/blob/master/james-project/src/adr/0041-replace-jcloud-with-s3.md)                                                |
| 0044 | [Against Cassandra Lightweight Transactions](https://github.com/linagora/tmail-backend/blob/master/james-project/src/adr/0044-against-the-use-of-cassandra-lightweight-transactions.md) |
| 0070 | [Native PostgreSQL adoption](https://github.com/linagora/tmail-backend/blob/master/james-project/src/adr/0070-postgresql-adoption.md)                                                   |
| 0071 | [SSE-C for S3 Object Storage](https://github.com/linagora/tmail-backend/blob/master/james-project/src/adr/0071-objectstorage-sse-c.md)                                                  |

### JMAP and protocols

| #    | Decision                                                                                                                                    |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 0012 | [Projections for JMAP Messages](https://github.com/linagora/tmail-backend/blob/master/james-project/src/adr/0012-jmap-partial-reads.md)     |
| 0018 | [New JMAP specifications adoption](https://github.com/linagora/tmail-backend/blob/master/james-project/src/adr/0018-jmap-new-specs.md)      |
| 0019 | [Reactor-netty for JMAP server](https://github.com/linagora/tmail-backend/blob/master/james-project/src/adr/0019-reactor-netty-adoption.md) |
| 0047 | [JMAP PUSH over WebSockets](https://github.com/linagora/tmail-backend/blob/master/james-project/src/adr/0047-jmap-push-over-websockets.md)  |
| 0050 | [Web push for JMAP](https://github.com/linagora/tmail-backend/blob/master/james-project/src/adr/0050-jmap-web-push.md)                      |
| 0057 | [Reactive IMAP](https://github.com/linagora/tmail-backend/blob/master/james-project/src/adr/0057-reactive-imap.md)                          |

### Search

| #    | Decision                                                                                                                                                           |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0009 | [Disable ElasticSearch dynamic mapping](https://github.com/linagora/tmail-backend/blob/master/james-project/src/adr/0009-disable-elasticsearch-dynamic-mapping.md) |
| 0010 | [Enable ElasticSearch routing](https://github.com/linagora/tmail-backend/blob/master/james-project/src/adr/0010-enable-elasticsearch-routing.md)                   |
| 0043 | [Avoid ElasticSearch on critical reads](https://github.com/linagora/tmail-backend/blob/master/james-project/src/adr/0043-avoid-elasticsearch-on-critical-reads.md) |
| 0056 | [OpenSearch migration](https://github.com/linagora/tmail-backend/blob/master/james-project/src/adr/0056-opensearch-migration.md)                                   |

### Security and authentication

| #    | Decision                                                                                                                                 |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 0051 | [Integrate James with OIDC](https://github.com/linagora/tmail-backend/blob/master/james-project/src/adr/0051-oidc.md)                    |
| 0053 | [Email rate limiting](https://github.com/linagora/tmail-backend/blob/master/james-project/src/adr/0053-email-rate-limiting.md)           |
| 0062 | [OIDC token introspection](https://github.com/linagora/tmail-backend/blob/master/james-project/src/adr/0062-oidc-token-introspection.md) |
| 0069 | [CrowdSec IP filtering](https://github.com/linagora/tmail-backend/blob/master/james-project/src/adr/0069-crowdsec-IP-filtering.md)       |
| 0075 | [Deleted Message Vault](https://github.com/linagora/tmail-backend/blob/master/james-project/src/adr/0075-deleted-message-vault.md)       |

---

## Client ADRs

Located in [`docs/adr/`](https://github.com/linagora/tmail-flutter/tree/master/docs/adr) (99 records). The tables below are a curated subset; see the folder for the full list.

### Caching and offline

| #     | Decision                                                                                                                                                     |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0002  | [Caching](https://github.com/linagora/tmail-flutter/blob/master/docs/adr/0002-caching.md)                                                                    |
| 0005  | [Cleaning up cache strategy](https://github.com/linagora/tmail-flutter/blob/master/docs/adr/0005-cleaning-up-cache-strategy.md)                              |
| 0017  | [Email cache guideline](https://github.com/linagora/tmail-flutter/blob/master/docs/adr/0017-email-cache-guideline.md)                                        |
| 0027  | [Use TupleKey store data cache](https://github.com/linagora/tmail-flutter/blob/master/docs/adr/0027-use-tuplekey-store-data-cache.md)                        |
| 0066a | [Synchronize caching](https://github.com/linagora/tmail-flutter/blob/master/docs/adr/0066-synchronize-caching.md)                                            |
| 0070  | [Synchronization strategy for disappearing emails](https://github.com/linagora/tmail-flutter/blob/master/docs/adr/0070-sync-strategy-disappearing-emails.md) |

### Performance and memory

| #    | Decision                                                                                                                                                  |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0003 | [Reduce main file size on web](https://github.com/linagora/tmail-flutter/blob/master/docs/adr/0003-reduce-main-file-size-on-web-browser.md)               |
| 0008 | [Handle heavy tasks with isolate](https://github.com/linagora/tmail-flutter/blob/master/docs/adr/0008-handle-heavy-task-with-isolate.md)                  |
| 0043 | [Fix memory leak with Controller dispose](https://github.com/linagora/tmail-flutter/blob/master/docs/adr/0043-fix-memory-leak-with-controller-dispose.md) |
| 0044 | [Memory leak at current state](https://github.com/linagora/tmail-flutter/blob/master/docs/adr/0044-memory-leak-at-current-state.md)                       |
| 0045 | [Memory leak with JS lifecycle](https://github.com/linagora/tmail-flutter/blob/master/docs/adr/0045-memory-leak-with-js-lifecycle.md)                     |

### Push notifications

| #    | Decision                                                                                                                                                        |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0019 | [Conventions for display push notifications](https://github.com/linagora/tmail-flutter/blob/master/docs/adr/0019-conventions-for-display-push-notifications.md) |
| 0032 | [Firebase registration token guideline](https://github.com/linagora/tmail-flutter/blob/master/docs/adr/0032-register-firebase-registration-token-guideline.md)  |
| 0047 | [FCM iOS push configuration](https://github.com/linagora/tmail-flutter/blob/master/docs/adr/0047-fcm-ios-push-configuration-confirmation.md)                    |
| 0050 | [Android notification permission check](https://github.com/linagora/tmail-flutter/blob/master/docs/adr/0050-android-notification-permission-check.md)           |
| 0051 | [Push notification click logic on iOS](https://github.com/linagora/tmail-flutter/blob/master/docs/adr/0051-push-notification-click-logic-on-ios.md)             |
| 0057 | [iOS FCM routing](https://github.com/linagora/tmail-flutter/blob/master/docs/adr/0057-ios-fcm-routing.md)                                                       |

### Authentication and networking

| #     | Decision                                                                                                                                            |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0031  | [Fix refresh token with OIDC](https://github.com/linagora/tmail-flutter/blob/master/docs/adr/0031-fix-refresh-token-with-oidc.md)                   |
| 0035  | [OIDC token refresh mechanism](https://github.com/linagora/tmail-flutter/blob/master/docs/adr/0035-error-handling-on-no-longer-valid-oidc-token.md) |
| 0055  | [WebSocket data synchronization](https://github.com/linagora/tmail-flutter/blob/master/docs/adr/0055-web-socket-data-synchronization.md)            |
| 0059  | [WebSocket ping strategy](https://github.com/linagora/tmail-flutter/blob/master/docs/adr/0059-web-socket-ping-strategy.md)                          |
| 0066b | [Robust OIDC guessing](https://github.com/linagora/tmail-flutter/blob/master/docs/adr/0066-robust-oidc-guessing.md)                                 |

### Threading and email display

| #    | Decision                                                                                                                                                  |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0014 | [Refactor RefreshChange to sync State](https://github.com/linagora/tmail-flutter/blob/master/docs/adr/0014-refactor-refresh-change-to-sync-state.md)      |
| 0037 | [Only request full Email/get one-by-one](https://github.com/linagora/tmail-flutter/blob/master/docs/adr/0037-only-request-full-email-get-one-by-one.md)   |
| 0054 | [Standardize HTML sanitizing](https://github.com/linagora/tmail-flutter/blob/master/docs/adr/0054-standardize-html-sanitizing.md)                         |
| 0068 | [Thread level actions](https://github.com/linagora/tmail-flutter/blob/master/docs/adr/0068-thread-level-actions.md)                                       |
| 0071 | [Enable collapseThreads in Email/query](https://github.com/linagora/tmail-flutter/blob/master/docs/adr/0071-collapse-threads-in-email-query.md)           |
| 0072 | [Thread-aware bulk actions](https://github.com/linagora/tmail-flutter/blob/master/docs/adr/0072-thread-aware-bulk-actions-email-list-collapse-threads.md) |

### Integrations

| #     | Decision                                                                                                                              |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 0036  | [Mailto URI schemes](https://github.com/linagora/tmail-flutter/blob/master/docs/adr/0036-mailto-uri-chemes-to-interact-twake-mail.md) |
| 0060a | [Cozy integration env](https://github.com/linagora/tmail-flutter/blob/master/docs/adr/0060-cozy-integration-env.md)                   |
| 0060b | [Team Mailboxes matching](https://github.com/linagora/tmail-flutter/blob/master/docs/adr/0060-team-mailboxes-matching.md)             |
| 0061  | [Cozy integration setup](https://github.com/linagora/tmail-flutter/blob/master/docs/adr/0061-cozy-integration-set-up.md)              |

### Security

| #    | Decision                                                                                                                                |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 0069 | [ReDoS vulnerability mitigation](https://github.com/linagora/tmail-flutter/blob/master/docs/adr/0069-redos-vulnerability-mitigation.md) |
| 0087 | [Block Sentry CDN on web](https://github.com/linagora/tmail-flutter/blob/master/docs/adr/0087-block-sentry-cdn-on-web.md)               |

### Recent additions

A sample of the newest client ADRs; see the [folder](https://github.com/linagora/tmail-flutter/tree/master/docs/adr) for the rest.

| #    | Decision                                                                                                                                       |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 0088 | [Force gson 2.12 for Android notification stability](https://github.com/linagora/tmail-flutter/blob/master/docs/adr/0088-force-gson-2.12-for-android-notification-stability.md) |
| 0089 | [Fix unexpected logout on poor network](https://github.com/linagora/tmail-flutter/blob/master/docs/adr/0089-fix-unexpected-logout-on-poor-network.md) |
| 0090 | [Migrate to Dart pub workspaces](https://github.com/linagora/tmail-flutter/blob/master/docs/adr/0090-migrate-to-dart-pub-workspaces.md)       |
| 0091 | [Fix auto-load-more infinite loop on large screens](https://github.com/linagora/tmail-flutter/blob/master/docs/adr/0091-fix-auto-load-more-infinite-loop-large-screen.md) |
| 0092 | [Upgrade flutter_riverpod 3](https://github.com/linagora/tmail-flutter/blob/master/docs/adr/0092-upgrade-flutter-riverpod-3.md)               |
