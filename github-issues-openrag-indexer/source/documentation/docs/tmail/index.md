---
title: Twake Mail
sidebar_position: 1
---

Twake Mail (TMail) is an enterprise email platform built on [Apache James](https://james.apache.org/). It pairs a scalable JMAP-native server with multi-platform Flutter clients to deliver a modern, private, and collaborative email experience.

- Web: https://mail.twake.app
- iOS: [App Store](https://apps.apple.com/app/twake-mail/id1587086189)
- Android: [Google Play](https://play.google.com/store/apps/details?id=com.linagora.android.teammail)
- Backend source: https://github.com/linagora/tmail-backend
- Client source: https://github.com/linagora/tmail-flutter

## Components

| Component     | Description                                                  | Stack                                               |
| ------------- | ------------------------------------------------------------ | --------------------------------------------------- |
| TMail Backend | Email server extending Apache James with enterprise features | Java 21, Guice, Cassandra, OpenSearch, RabbitMQ, S3 |
| TMail Web     | Browser-based email client                                   | Flutter Web, Dart, JMAP                             |
| TMail Mobile  | iOS and Android email client                                 | Flutter, Dart, JMAP                                 |

## Protocol

TMail uses **JMAP** (JSON Meta Application Protocol) as the primary client-server protocol. JMAP is a modern replacement for IMAP designed for mobile and web clients, offering lower bandwidth, fewer round trips, and native push support.

Legacy protocols are supported for interoperability:

| Protocol | Ports                           | Purpose                      |
| -------- | ------------------------------- | ---------------------------- |
| JMAP     | 80 (HTTP)                       | Primary client access        |
| IMAP     | 143 (STARTTLS), 993 (TLS)       | Legacy client access         |
| SMTP     | 25, 465 (TLS), 587 (submission) | Mail delivery and submission |

## Integration with Twake Workplace

TMail integrates with the broader Twake ecosystem through:

- **OIDC-based authentication** -- the [Registration](../registration) service in SaaS, or LemonLDAP::NG for on-premise deployments
- **RabbitMQ** for event-driven user provisioning from the [Registration](../registration) service
- **LDAP** as the shared user directory

## Further reading

- [Architecture](./architecture) -- backend infrastructure and client design
- [Features](./features) -- full feature reference
- [Configuration](./configuration) -- backend and client configuration
- [Deployment](./deployment) -- Docker images and production setup
- [ADRs](./adrs) -- architecture decision records for backend and client
