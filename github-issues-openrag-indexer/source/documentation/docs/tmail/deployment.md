---
title: Deployment
sidebar_position: 5
---

## Backend

### Docker images

| Image                                | Description                             |
| ------------------------------------ | --------------------------------------- |
| `linagora/tmail-backend-distributed` | Production-ready distributed deployment |
| `linagora/tmail-backend-memory`      | In-memory variant for testing           |

### Prerequisites

Generate a JWT key pair for JMAP authentication:

```bash
openssl genrsa -out jwt_privatekey 4096
openssl rsa -in jwt_privatekey -pubout -out jwt_publickey
```

### Running with Docker Compose

The distributed variant requires Cassandra, OpenSearch, RabbitMQ, and S3-compatible storage. A minimal `docker-compose.yml`:

```yaml
services:
  tmail:
    image: linagora/tmail-backend-distributed:latest
    ports:
      - "25:25" # SMTP
      - "143:143" # IMAP
      - "465:465" # SMTP/TLS
      - "587:587" # SMTP submission
      - "993:993" # IMAP/TLS
      - "80:80" # JMAP + WebAdmin
      - "8000:8000" # Health check
    volumes:
      - ./jwt_publickey:/root/conf/jwt_publickey
      - ./jwt_privatekey:/root/conf/jwt_privatekey
    environment:
      - JAVA_TOOL_OPTIONS=-Xmx2g -Xms512m
    depends_on:
      - cassandra
      - opensearch
      - rabbitmq
      - s3
      - redis

  cassandra:
    image: cassandra:4.1
    ports:
      - "9042:9042"

  opensearch:
    image: opensearchproject/opensearch:2.17.0
    environment:
      - discovery.type=single-node
      - DISABLE_SECURITY_PLUGIN=true

  rabbitmq:
    image: rabbitmq:3.13-management
    ports:
      - "5672:5672"
      - "15672:15672"

  s3:
    image: zenko/cloudserver:latest
    environment:
      - SCALITY_ACCESS_KEY_ID=accessKey1
      - SCALITY_SECRET_ACCESS_KEY=secretKey1

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

### Health check

```bash
curl http://localhost:8000/healthcheck
```

### JVM tuning

Set memory and monitoring options through the `JAVA_TOOL_OPTIONS` environment variable:

```bash
JAVA_TOOL_OPTIONS=-Xmx2g -Xms512m -javaagent:/root/glowroot/glowroot.jar
```

## Web client

### Docker image

| Image                | Description            |
| -------------------- | ---------------------- |
| `linagora/tmail-web` | Nginx-based web client |

### Running

```bash
docker run -p 8080:80 \
  -e SERVER_URL=https://jmap.example.com \
  -e DOMAIN_REDIRECT_URL=https://mail.example.com \
  -e WEB_OIDC_CLIENT_ID=tmail-web \
  linagora/tmail-web:latest
```

See [Configuration](./configuration) for the full list of environment variables.

## Mobile clients

The mobile clients are distributed through the App Store (iOS) and Google Play (Android). They connect to any JMAP-compliant server and authenticate via OIDC.

Build from source:

```bash
# Install dependencies and generate code for all modules
./scripts/prebuild.sh

# Android
flutter build apk

# iOS
flutter build ios
```

## Dependencies

| Dependency            | Minimum version | Required by                             |
| --------------------- | --------------- | --------------------------------------- |
| Cassandra             | 4.1.3           | Backend (distributed)                   |
| OpenSearch            | 2.1.0           | Backend (distributed)                   |
| RabbitMQ              | 3.12.1          | Backend (distributed)                   |
| S3-compatible storage | --              | Backend (distributed)                   |
| Redis                 | 7.x             | Backend (caching, OIDC)                 |
| Tika                  | 2.8             | Backend (optional, attachment indexing) |
| OIDC provider         | --              | Authentication (Registration for SaaS, LemonLDAP::NG for on-premise) |
