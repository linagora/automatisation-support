import { afterEach, describe, expect, it, vi } from "vitest";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

import {
  runMatrixSupportAutomationV2
} from "../../../src/channels/matrix/runMatrixSupportAutomationV2";
import type {
  SupportAutomationTurnV2Result
} from "../../../src/orchestration/runSupportAutomationTurnV2";
import { JsonMessageRepository } from "../../../src/repositories/json/jsonMessageRepository";
import { JsonTicketRepository } from "../../../src/repositories/json/jsonTicketRepository";
import { JsonUserRepository } from "../../../src/repositories/json/jsonUserRepository";

import type {
  MessagingEvent,
  MessagingTypingEvent
} from "../../../src/messaging/typesMessaging.types";
import type {
  SupportProgressReporter
} from "../../../src/orchestration/supportProgressReporter";

function buildTempRepositories(): {
  ticketRepository: JsonTicketRepository;
  userRepository: JsonUserRepository;
  messageRepository: JsonMessageRepository;
} {
  const dir = mkdtempSync(join(tmpdir(), "matrix-v2-test-"));

  return {
    ticketRepository: new JsonTicketRepository(join(dir, "tickets.json")),
    userRepository: new JsonUserRepository(join(dir, "users.json")),
    messageRepository: new JsonMessageRepository(join(dir, "messages.json"))
  };
}

function buildMessage(overrides: Partial<MessagingEvent> = {}): MessagingEvent {
  return {
    channel: "matrix",
    roomId: "!room",
    userId: "@user",
    messageId: "$event",
    content: "Bonjour",
    createdAt: "2026-06-22T10:00:00.000Z",
    ...overrides
  };
}

function buildTypingEvent(
  overrides: Partial<MessagingTypingEvent> = {}
): MessagingTypingEvent {
  return {
    channel: "matrix",
    roomId: "!room",
    userId: "@user",
    isTyping: true,
    updatedAt: "2026-06-22T10:00:01.000Z",
    rawEvent: {},
    ...overrides
  };
}

function createDeferred<T = void>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return {
    promise,
    resolve,
    reject
  };
}

function buildRunResult(params: {
  roomId: string;
  userId: string;
  messages: MessagingEvent[];
  content?: string;
}): SupportAutomationTurnV2Result {
  const content = params.content ?? "Réponse V2.";

  return {
    matchingResult: {
      channel: "matrix",
      roomId: params.roomId,
      userId: params.userId,
      messages: params.messages
    },
    supportProcessingInput: {} as never,
    supportProcessingOutput: {
      userResponse: {
        messages: [
          {
            type: "topic_response",
            content
          }
        ]
      },
      patches: {} as never
    },
    deliveryMessages: [
      {
        localId: `delivery_${params.messages.at(-1)?.messageId ?? "none"}`,
        channel: "matrix",
        roomId: params.roomId,
        userId: params.userId,
        content
      }
    ],
    persistenceResult: {
      patchStatus: "applied",
      storedIncomingMessageIds: [],
      storedOutgoingMessageIds: [],
      warnings: []
    }
  };
}

describe("runMatrixSupportAutomationV2", function () {
  afterEach(function () {
    vi.useRealTimers();
  });

  it("buffers Matrix messages, runs the V2 turn once, and skips delivery in dry-run", async function () {
    const repositories = buildTempRepositories();
    await repositories.ticketRepository.list();
    await repositories.userRepository.list();
    await repositories.messageRepository.list();
    const repositoriesBefore = {
      tickets: await repositories.ticketRepository.list(),
      users: await repositories.userRepository.list(),
      messages: await repositories.messageRepository.list()
    };
    let onMessage!: (event: MessagingEvent) => Promise<void> | void;
    const listenMatrixEvents = vi.fn(async (params) => {
      onMessage = params.onMessage;

      return {
        stop: vi.fn()
      };
    });
    const sendMatrixDeliveryMessages = vi.fn();
    const runSupportAutomationTurnV2 = vi.fn(async (params) => {
      const result: SupportAutomationTurnV2Result = {
        matchingResult: {
          channel: "matrix",
          roomId: params.bufferedMessages.roomId,
          userId: params.bufferedMessages.userId,
          messages: params.bufferedMessages.messages
        },
        supportProcessingInput: {} as never,
        supportProcessingOutput: {
          userResponse: {
            messages: [
              {
                type: "topic_response",
                content: "Réponse V2."
              }
            ]
          },
          patches: {} as never
        },
        deliveryMessages: [
          {
            localId: "delivery_1",
            channel: "matrix",
            roomId: params.bufferedMessages.roomId,
            userId: params.bufferedMessages.userId,
            content: "Réponse V2."
          }
        ],
        persistenceResult: {
          patchStatus: "applied",
          storedIncomingMessageIds: [],
          storedOutgoingMessageIds: [],
          warnings: []
        }
      };

      return result;
    });
    const handle = await runMatrixSupportAutomationV2({
      config: {
        homeserverUrl: "https://matrix.local",
        accessToken: "token",
        defaultRoomId: "!room"
      },
      dryRun: true,
      inactivityTimeoutMs: 10_000,
      ticketRepository: repositories.ticketRepository,
      userRepository: repositories.userRepository,
      messageRepository: repositories.messageRepository,
      dependencies: {
        listenMatrixEvents,
        sendMatrixDeliveryMessages,
        runSupportAutomationTurnV2
      }
    });

    await onMessage({
      channel: "matrix",
      roomId: "!room",
      userId: "@user",
      messageId: "$event",
      content: "Bonjour",
      createdAt: new Date().toISOString()
    });

    const records = await handle.flushPending();

    expect(runSupportAutomationTurnV2).toHaveBeenCalledTimes(1);
    expect(runSupportAutomationTurnV2).toHaveBeenCalledWith(
      expect.objectContaining({
        persist: false
      })
    );
    expect(listenMatrixEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        downloadAttachments: false
      })
    );
    expect(records).toHaveLength(1);
    expect(records[0].supportAutomationTurnResult.deliveryMessages).toHaveLength(1);
    expect(records[0].matrixDeliveryResults).toEqual([]);
    expect(sendMatrixDeliveryMessages).not.toHaveBeenCalled();
    expect(await repositories.ticketRepository.list())
      .toEqual(repositoriesBefore.tickets);
    expect(await repositories.userRepository.list())
      .toEqual(repositoriesBefore.users);
    expect(await repositories.messageRepository.list())
      .toEqual(repositoriesBefore.messages);

    await handle.stop();
  });

  it("starts progress after buffer activity and passes the reporter to the V2 turn", async function () {
    const repositories = buildTempRepositories();
    let onMessage!: (event: MessagingEvent) => Promise<void> | void;
    const listenMatrixEvents = vi.fn(async (params) => {
      onMessage = params.onMessage;

      return {
        stop: vi.fn()
      };
    });
    const progressReporter: SupportProgressReporter = {
      startBuffer: vi.fn(async () => undefined),
      startTurn: vi.fn(async () => undefined),
      stage: vi.fn(async () => undefined),
      finishTurn: vi.fn(async () => undefined),
      failTurn: vi.fn(async () => undefined)
    };
    const runSupportAutomationTurnV2 = vi.fn(async (params) => {
      await params.progressReporter?.stage({
        roomId: params.bufferedMessages.roomId,
        userId: params.bufferedMessages.userId,
        turnId: params.progressContext?.turnId,
        messageCount: params.bufferedMessages.messages.length
      }, "analyzing_support");

      const result: SupportAutomationTurnV2Result = {
        matchingResult: {
          channel: "matrix",
          roomId: params.bufferedMessages.roomId,
          userId: params.bufferedMessages.userId,
          messages: params.bufferedMessages.messages
        },
        supportProcessingInput: {} as never,
        supportProcessingOutput: {
          userResponse: {
            messages: [
              {
                type: "topic_response",
                content: "Réponse V2."
              }
            ]
          },
          patches: {} as never
        },
        deliveryMessages: [
          {
            localId: "delivery_1",
            channel: "matrix",
            roomId: params.bufferedMessages.roomId,
            userId: params.bufferedMessages.userId,
            content: "Réponse V2."
          }
        ],
        persistenceResult: {
          patchStatus: "applied",
          storedIncomingMessageIds: [],
          storedOutgoingMessageIds: [],
          warnings: []
        }
      };

      return result;
    });
    const handle = await runMatrixSupportAutomationV2({
      config: {
        homeserverUrl: "https://matrix.local",
        accessToken: "token",
        defaultRoomId: "!room"
      },
      dryRun: true,
      inactivityTimeoutMs: 10_000,
      ticketRepository: repositories.ticketRepository,
      userRepository: repositories.userRepository,
      messageRepository: repositories.messageRepository,
      progressReporter,
      dependencies: {
        listenMatrixEvents,
        runSupportAutomationTurnV2
      }
    });

    await onMessage({
      channel: "matrix",
      roomId: "!room",
      userId: "@user",
      messageId: "$event-progress",
      content: "J'ai un probleme avec mes mails",
      createdAt: new Date().toISOString()
    });

    await handle.flushPending();

    expect(progressReporter.startBuffer).toHaveBeenCalledWith({
      roomId: "!room",
      userId: "@user",
      turnId: "$event-progress",
      messageCount: 1
    });
    expect(progressReporter.startTurn).toHaveBeenCalledWith({
      roomId: "!room",
      userId: "@user",
      turnId: "$event-progress",
      messageCount: 1
    });
    expect(runSupportAutomationTurnV2).toHaveBeenCalledWith(
      expect.objectContaining({
        progressReporter,
        progressContext: {
          roomId: "!room",
          userId: "@user",
          turnId: "$event-progress",
          messageCount: 1
        }
      })
    );
    expect(progressReporter.stage).toHaveBeenCalledWith({
      roomId: "!room",
      userId: "@user",
      turnId: "$event-progress",
      messageCount: 1
    }, "analyzing_support");
    expect(progressReporter.finishTurn).toHaveBeenCalledWith({
      roomId: "!room",
      userId: "@user",
      turnId: "$event-progress",
      messageCount: 1
    });
    expect(progressReporter.failTurn).not.toHaveBeenCalled();

    await handle.stop();
  });

  it("keeps same-scope messages pending while the current turn and delivery are active", async function () {
    const repositories = buildTempRepositories();
    let onMessage!: (event: MessagingEvent) => Promise<void> | void;
    const firstDelivery = createDeferred<[]>();
    const listenMatrixEvents = vi.fn(async (params) => {
      onMessage = params.onMessage;

      return {
        stop: vi.fn()
      };
    });
    const runSupportAutomationTurnV2 = vi.fn(async (params) => {
      return buildRunResult({
        roomId: params.bufferedMessages.roomId,
        userId: params.bufferedMessages.userId,
        messages: params.bufferedMessages.messages
      });
    });
    const sendMatrixDeliveryMessages = vi.fn(async () => {
      if (sendMatrixDeliveryMessages.mock.calls.length === 1) {
        return firstDelivery.promise;
      }

      return [];
    });
    const logger = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };
    const handle = await runMatrixSupportAutomationV2({
      config: {
        homeserverUrl: "https://matrix.local",
        accessToken: "token",
        defaultRoomId: "!room"
      },
      dryRun: false,
      processHistoricalMessages: true,
      inactivityTimeoutMs: 10_000,
      ticketRepository: repositories.ticketRepository,
      userRepository: repositories.userRepository,
      messageRepository: repositories.messageRepository,
      logger,
      dependencies: {
        listenMatrixEvents,
        sendMatrixDeliveryMessages,
        runSupportAutomationTurnV2
      }
    });

    await onMessage(buildMessage({
      messageId: "$message_a",
      content: "Message A"
    }));

    const firstFlush = handle.flushPending();

    await vi.waitFor(() => {
      expect(runSupportAutomationTurnV2).toHaveBeenCalledTimes(1);
      expect(sendMatrixDeliveryMessages).toHaveBeenCalledTimes(1);
    });

    await onMessage(buildMessage({
      messageId: "$message_b",
      content: "Message B",
      createdAt: "2026-06-22T10:00:01.000Z"
    }));

    const delayedFlushRecords = await handle.flushPending();

    expect(delayedFlushRecords).toEqual([]);
    expect(runSupportAutomationTurnV2).toHaveBeenCalledTimes(1);
    expect(logger.log).toHaveBeenCalledWith(expect.objectContaining({
      eventName: "conversation.pending_messages_collected",
      scopeKey: JSON.stringify(["matrix", "!room", null, "@user"]),
      pendingMessageIds: ["$message_b"]
    }));
    expect(logger.log).toHaveBeenCalledWith(expect.objectContaining({
      eventName: "conversation.pending_processing_delayed_until_current_turn_done",
      scopeKey: JSON.stringify(["matrix", "!room", null, "@user"]),
      pendingMessageIds: ["$message_b"]
    }));

    await onMessage(buildMessage({
      messageId: "$message_c",
      content: "Message C",
      createdAt: "2026-06-22T10:00:02.000Z"
    }));

    firstDelivery.resolve([]);

    await firstFlush;
    await vi.waitFor(() => {
      expect(runSupportAutomationTurnV2).toHaveBeenCalledTimes(2);
    });

    expect(runSupportAutomationTurnV2.mock.calls[1][0].bufferedMessages.messages)
      .toEqual([
        expect.objectContaining({
          messageId: "$message_b"
        }),
        expect.objectContaining({
          messageId: "$message_c"
        })
      ]);
    expect(logger.log).toHaveBeenCalledWith(expect.objectContaining({
      eventName: "conversation.pending_processing_released_after_current_turn",
      scopeKey: JSON.stringify(["matrix", "!room", null, "@user"])
    }));

    await handle.stop();
  });

  it("waits for typing to stop before flushing pending messages collected during a turn", async function () {
    vi.useFakeTimers();
    const repositories = buildTempRepositories();
    let onMessage!: (event: MessagingEvent) => Promise<void> | void;
    let onTyping!: (event: MessagingTypingEvent) => Promise<void> | void;
    const firstTurn = createDeferred<SupportAutomationTurnV2Result>();
    const listenMatrixEvents = vi.fn(async (params) => {
      onMessage = params.onMessage;
      onTyping = params.onTyping;

      return {
        stop: vi.fn()
      };
    });
    const runSupportAutomationTurnV2 = vi.fn(async (params) => {
      if (runSupportAutomationTurnV2.mock.calls.length === 1) {
        return firstTurn.promise;
      }

      return buildRunResult({
        roomId: params.bufferedMessages.roomId,
        userId: params.bufferedMessages.userId,
        messages: params.bufferedMessages.messages
      });
    });
    const handle = await runMatrixSupportAutomationV2({
      config: {
        homeserverUrl: "https://matrix.local",
        accessToken: "token",
        defaultRoomId: "!room"
      },
      dryRun: true,
      processHistoricalMessages: true,
      inactivityTimeoutMs: 1000,
      ticketRepository: repositories.ticketRepository,
      userRepository: repositories.userRepository,
      messageRepository: repositories.messageRepository,
      dependencies: {
        listenMatrixEvents,
        runSupportAutomationTurnV2
      }
    });

    await onMessage(buildMessage({
      messageId: "$message_a"
    }));
    await vi.advanceTimersByTimeAsync(1000);
    await vi.waitFor(() => {
      expect(runSupportAutomationTurnV2).toHaveBeenCalledTimes(1);
    });

    await onMessage(buildMessage({
      messageId: "$message_b",
      createdAt: "2026-06-22T10:00:01.000Z"
    }));
    await onTyping(buildTypingEvent({
      isTyping: true
    }));
    await vi.advanceTimersByTimeAsync(5000);

    firstTurn.resolve(buildRunResult({
      roomId: "!room",
      userId: "@user",
      messages: [buildMessage({
        messageId: "$message_a"
      })]
    }));
    await vi.advanceTimersByTimeAsync(5000);

    expect(runSupportAutomationTurnV2).toHaveBeenCalledTimes(1);

    await onTyping(buildTypingEvent({
      isTyping: false,
      updatedAt: "2026-06-22T10:00:12.000Z"
    }));
    await vi.advanceTimersByTimeAsync(1000);

    await vi.waitFor(() => {
      expect(runSupportAutomationTurnV2).toHaveBeenCalledTimes(2);
    });

    await handle.stop();
  });

  it("processes different conversation scopes in parallel", async function () {
    const repositories = buildTempRepositories();
    let onMessage!: (event: MessagingEvent) => Promise<void> | void;
    const firstTurn = createDeferred<SupportAutomationTurnV2Result>();
    const secondTurn = createDeferred<SupportAutomationTurnV2Result>();
    const listenMatrixEvents = vi.fn(async (params) => {
      onMessage = params.onMessage;

      return {
        stop: vi.fn()
      };
    });
    const runSupportAutomationTurnV2 = vi.fn(async (params) => {
      if (params.bufferedMessages.roomId === "!room-a") {
        return firstTurn.promise;
      }

      return secondTurn.promise;
    });
    const handle = await runMatrixSupportAutomationV2({
      config: {
        homeserverUrl: "https://matrix.local",
        accessToken: "token"
      },
      dryRun: true,
      processHistoricalMessages: true,
      inactivityTimeoutMs: 10_000,
      ticketRepository: repositories.ticketRepository,
      userRepository: repositories.userRepository,
      messageRepository: repositories.messageRepository,
      dependencies: {
        listenMatrixEvents,
        runSupportAutomationTurnV2
      }
    });

    await onMessage(buildMessage({
      roomId: "!room-a",
      messageId: "$message_a"
    }));
    await onMessage(buildMessage({
      roomId: "!room-b",
      messageId: "$message_b"
    }));

    const flush = handle.flushPending();

    await vi.waitFor(() => {
      expect(runSupportAutomationTurnV2).toHaveBeenCalledTimes(2);
    });

    firstTurn.resolve(buildRunResult({
      roomId: "!room-a",
      userId: "@user",
      messages: [buildMessage({
        roomId: "!room-a",
        messageId: "$message_a"
      })]
    }));
    secondTurn.resolve(buildRunResult({
      roomId: "!room-b",
      userId: "@user",
      messages: [buildMessage({
        roomId: "!room-b",
        messageId: "$message_b"
      })]
    }));

    await flush;
    await handle.stop();
  });

  it("cleans up a failed same-scope turn and releases pending messages", async function () {
    const repositories = buildTempRepositories();
    let onMessage!: (event: MessagingEvent) => Promise<void> | void;
    const firstTurn = createDeferred<SupportAutomationTurnV2Result>();
    const listenMatrixEvents = vi.fn(async (params) => {
      onMessage = params.onMessage;

      return {
        stop: vi.fn()
      };
    });
    const runSupportAutomationTurnV2 = vi.fn(async (params) => {
      if (runSupportAutomationTurnV2.mock.calls.length === 1) {
        return firstTurn.promise;
      }

      return buildRunResult({
        roomId: params.bufferedMessages.roomId,
        userId: params.bufferedMessages.userId,
        messages: params.bufferedMessages.messages
      });
    });
    const logger = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };
    const handle = await runMatrixSupportAutomationV2({
      config: {
        homeserverUrl: "https://matrix.local",
        accessToken: "token",
        defaultRoomId: "!room"
      },
      dryRun: true,
      processHistoricalMessages: true,
      inactivityTimeoutMs: 10_000,
      ticketRepository: repositories.ticketRepository,
      userRepository: repositories.userRepository,
      messageRepository: repositories.messageRepository,
      logger,
      dependencies: {
        listenMatrixEvents,
        runSupportAutomationTurnV2
      }
    });

    await onMessage(buildMessage({
      messageId: "$message_a"
    }));
    const firstFlush = handle.flushPending().catch((error: unknown) => error);

    await vi.waitFor(() => {
      expect(runSupportAutomationTurnV2).toHaveBeenCalledTimes(1);
    });

    await onMessage(buildMessage({
      messageId: "$message_b",
      createdAt: "2026-06-22T10:00:01.000Z"
    }));
    await handle.flushPending();

    firstTurn.reject(new Error("turn failed"));
    await firstFlush;

    await vi.waitFor(() => {
      expect(runSupportAutomationTurnV2).toHaveBeenCalledTimes(2);
    });
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({
      eventName: "conversation.processing_failed",
      scopeKey: JSON.stringify(["matrix", "!room", null, "@user"]),
      messageIds: ["$message_a"]
    }));

    await handle.stop();
  });
});
