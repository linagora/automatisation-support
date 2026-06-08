# Matrix / Twake Chat Smoke Test

This document explains how to run a real Matrix / Twake Chat smoke test for
the support automation runner.

## Accounts

Use two distinct accounts:

- Bot account: the account used by the runner. Its Matrix access token is
  provided through `MATRIX_ACCESS_TOKEN`.
- User account: a normal Twake Chat user account used to write test messages in
  the room.

Do not use the bot account to send the manual test message. The Matrix listener
ignores messages sent by the bot itself.

## Room membership

The bot account must be a member of the room where the user writes. Invite the
bot account from Twake Chat if needed, then accept or join with the bot account.

`MATRIX_ROOM_ID` is the Matrix room id, usually shaped like:

```txt
!abcdef:example.org
```

Use an existing Matrix/Twake admin tool, client developer tools, or server logs
to verify the room id. If `MATRIX_ROOM_ID` is set, the runner works in
single-room mode. If it is omitted, the runner listens to all rooms joined by
the bot account.

## Environment

Create or update `.env`:

```bash
MATRIX_HOMESERVER_URL=
MATRIX_ACCESS_TOKEN=
MATRIX_ROOM_ID=
MATRIX_STORAGE_PATH=
SUPPORT_BUFFER_INACTIVITY_MS=
SUPPORT_BUFFER_MAX_WAIT_MS=30000
SUPPORT_MATRIX_DRY_RUN=true
SUPPORT_IGNORE_MESSAGES_BEFORE_STARTUP=true
SUPPORT_STARTUP_GRACE_MS=5000
SUPPORT_PROCESS_HISTORICAL_MESSAGES=false
```

Notes:

- `MATRIX_HOMESERVER_URL` is required.
- `MATRIX_ACCESS_TOKEN` is required and must belong to the bot account.
- `MATRIX_ROOM_ID` is recommended for the first smoke test.
- `MATRIX_STORAGE_PATH` is optional. It controls Matrix bot SDK sync storage.
- `SUPPORT_BUFFER_INACTIVITY_MS` is optional. Default is currently 2000 ms.
- `SUPPORT_BUFFER_MAX_WAIT_MS` is optional. Default is currently 30000 ms.
  It is only a safety fallback: normally the buffer waits until Matrix/Twake
  typing stops, then applies the inactivity timeout.
- `SUPPORT_MATRIX_DRY_RUN=true` runs the full pipeline without sending Matrix
  replies.
- `SUPPORT_IGNORE_MESSAGES_BEFORE_STARTUP=true` is the default. It prevents the
  runner from processing old Matrix events received during startup sync.
- `SUPPORT_STARTUP_GRACE_MS=5000` is the default grace period. Messages older
  than runner startup minus this grace period are ignored.
- `SUPPORT_PROCESS_HISTORICAL_MESSAGES=false` is the default. Set it to `true`
  only for explicit replay/debug runs.

Check the config without printing the token:

```bash
npm run support:matrix:check
```

## Dry-run test

Start the runner in dry-run mode:

```bash
SUPPORT_MATRIX_DRY_RUN=true npm run support:matrix
```

From the user account, send a message in the target Twake room, for example:

```txt
Comment partager un dossier dans Drive ?
```

Expected behavior:

- the runner receives the Matrix message;
- the in-memory buffer flushes after inactivity, unless the user is still
  typing;
- `runSupportAutomationTurn` runs;
- JSON messages are persisted;
- a ticket may be created if the pipeline produces useful topic knowledge;
- no Matrix reply is sent.

Useful logs:

- `matrix.runner.mode`
- `matrix.message.received`
- `matrix.message.ignored_historical`
- `buffer.message_added`
- `matrix.typing.received`
- `buffer.typing_updated`
- `buffer.flush_blocked_typing`
- `buffer.max_wait_reached`
- `buffer.flushed`
- `support.turn.started`
- `support.turn.completed`
- `matrix.delivery.dry_run`

## Real delivery test

Once dry-run looks correct, start real delivery:

```bash
SUPPORT_MATRIX_DRY_RUN=false npm run support:matrix
```

Send a new message from the user account. The bot should reply in the same room.

Useful logs:

- `matrix.delivery.completed`
- `matrix.delivery.partial_failed`

If delivery fails for one message, the runner should log the failure and keep
processing later messages.

## Historical Matrix events

Matrix clients can receive older room events when the bot starts or resumes
sync. By default, the support runner ignores messages created before startup,
with a small grace period:

```bash
SUPPORT_IGNORE_MESSAGES_BEFORE_STARTUP=true
SUPPORT_STARTUP_GRACE_MS=5000
SUPPORT_PROCESS_HISTORICAL_MESSAGES=false
```

This prevents the bot from answering old user messages, creating tickets from
old room history, or sending unexpected replies during a smoke test.

If an old event is ignored, the runner logs:

```txt
matrix.message.ignored_historical
```

Only set `SUPPORT_PROCESS_HISTORICAL_MESSAGES=true` for an intentional replay
or debugging run.

## JSON files to inspect

After a test, inspect:

```txt
data/tickets.json
data/users.json
data/messages.json
```

Expected first useful topic message:

- `data/messages.json` contains the incoming user message and outgoing bot
  message.
- `data/tickets.json` contains an active ticket if the pipeline produced useful
  ticket knowledge.
- The ticket contains `supportTopicKnowledge`, `conversationHistory`, and
  metadata such as `lastPatchGeneratedAt`, `lastResponsePlan`, and
  `lastSecurityGateSummary`.

`data/users.json` is not automatically populated by this runner. A missing user
is expected in this V1 unless the JSON user repository was pre-seeded.

## Shutdown

Stop the runner with `Ctrl+C`. The script handles `SIGINT` / `SIGTERM`, stops
the Matrix listener, flushes pending buffered messages, and disposes the
in-memory buffer.
