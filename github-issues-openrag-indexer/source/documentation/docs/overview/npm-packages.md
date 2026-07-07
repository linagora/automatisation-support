---
title: Open-source npm packages
---

Linagora publishes two npm packages that are used inside Twake Workplace and are also available to the wider community. Both live on the public npm registry under the `@linagora` scope.

## `@linagora/ldap-rest-client`

Typed TypeScript client for the Twake LDAP REST API. Handles HMAC-SHA256 request signing (service ID + timestamp + request signature) so callers do not have to reimplement the auth flow on every service.

- npm: https://www.npmjs.com/package/@linagora/ldap-rest-client
- Exports: `LdapRestClient`, plus shared domain types (`User`, `Organization`, `OrganizationMetadata`, `ListUsersResponse`, ...)
- Used internally by Registration, Admin Panel Backend, and the Dashboard - see [Best Practices](./best-practices) for when to reach for it instead of hand-rolling an HTTP call.

The client is the only supported way to call LDAP REST from another service. It is the reason LDAP REST can enforce HMAC-only access: all in-house services go through this library.

## `@linagora/rabbitmq-client`

Small wrapper over `amqplib` that standardises how Twake services publish and consume events on RabbitMQ. Designed with an internal contract in mind (the exchanges described on the [RabbitMQ](./rabbitmq) page), but intentionally kept generic so the community can use it for any AMQP workload.

- npm: https://www.npmjs.com/package/@linagora/rabbitmq-client
- Exports: `RabbitMQClient`, `RabbitMQMessage`, `RabbitMQMessageHandler`
- The mandated RabbitMQ client for all Twake Workplace Node.js services. Used today by Registration and Admin Panel Backend (the services that publish/consume events); any future Node.js service that needs RabbitMQ must use it rather than hand-rolling amqplib.

Both packages follow semver and publish source maps + declaration files. Bug reports and PRs are welcome on the public repositories.
