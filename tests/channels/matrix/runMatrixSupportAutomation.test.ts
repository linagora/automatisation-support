import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  runMatrixSupportAutomation
} from "../../../src/channels/matrix/runMatrixSupportAutomation";

import type {
  MatrixDeliveryResult
} from "../../../src/channels/matrix/typesMatrixChannel.types";
import type {
  MessagingEvent,
  MessagingTypingEvent
} from "../../../src/messaging/typesMessaging.types";
import type {
  DeliveryMessage,
  SupportAutomationTurnResult
} from "../../../src/orchestration/typesOrchestration.types";
import type {
  JsonMessageRepository
} from "../../../src/repositories/json/jsonMessageRepository";
import type {
  JsonTicketRepository
} from "../../../src/repositories/json/jsonTicketRepository";
import type {
  JsonUserRepository
} from "../../../src/repositories/json/jsonUserRepository";
import type {
  SupportProcessingPipelineInput,
  SupportProcessingPipelineOutput
} from "../../../src/support-processing-pipeline/typesSupportProcessingPipeline.types";
import { JsonMessageRepository as RealJsonMessageRepository } from "../../../src/repositories/json/jsonMessageRepository";
import { JsonTicketRepository as RealJsonTicketRepository } from "../../../src/repositories/json/jsonTicketRepository";
import { JsonUserRepository as RealJsonUserRepository } from "../../../src/repositories/json/jsonUserRepository";

function buildMessagingEvent(): MessagingEvent {
  return {
    channel: "matrix",
    roomId: "!room:example.org",
    userId: "@user:example.org",
    messageId: "$message_1",
    content: "Bonjour",
    createdAt: "2026-06-05T10:00:00.000Z"
  };
}

function buildTypingEvent(
  overrides: Partial<MessagingTypingEvent> = {}
): MessagingTypingEvent {
  return {
    channel: "matrix",
    roomId: "!room:example.org",
    userId: "@user:example.org",
    isTyping: true,
    updatedAt: "2026-06-05T10:00:00.000Z",
    ...overrides
  };
}

function buildRunnerStartedAt(): Date {
  return new Date("2026-06-05T09:59:59.000Z");
}

function buildSupportProcessingInput(): SupportProcessingPipelineInput {
  return {
    latestUserMessage: {
      id: "$message_1",
      content: "Bonjour",
      channel: "twake_chat",
      sentAt: "2026-06-05T10:00:00.000Z"
    },
    latestUserAttachments: [],
    accountTrustStatus: {
      status: "neutral"
    },
    accountProfile: {
      accountType: "individual",
      actualPlan: "free",
      paymentStatus: "unknown",
      planHistory: [],
      createdAt: "1970-01-01T00:00:00.000Z",
      daysSinceCreation: 0
    },
    accountInteractionTraits: {
      labels: [],
      lastUpdatedAt: "1970-01-01T00:00:00.000Z"
    },
    supportTopicKnowledge: {
      segments_topic: []
    },
    conversationHistory: []
  };
}

function buildSupportProcessingOutput(): SupportProcessingPipelineOutput {
  const turnUnderstandingDelta = {
    user_language: "french",
    securityGateSummary: {
      gateChecked: {},
      gateFailed: []
    },
    segments_lack_comprehension: [],
    segments_topic: [],
    segments_signal: [],
    segments_scope_boundary: [],
    segments_suspicious: []
  };
  const responsePlan = {
    responseLanguage: "french",
    messagesPlan: {
      scopeBoundaryPlanMessages: [],
      topicPlanMessages: [],
      signalPlanMessages: [],
      handoverPlanMessages: []
    }
  };

  return {
    userResponse: {
      messages: [
        {
          type: "topic_response",
          content: "Réponse"
        }
      ]
    },
    patches: {
      analysisPatch: {
        turnUnderstandingDelta
      },
      securityPatch: {
        securityGateSummary: {
          gateChecked: {},
          gateFailed: []
        }
      },
      responsePatch: {
        responsePlan
      },
      metadataPatch: {
        generatedAt: "2026-06-05T10:00:01.000Z",
        source: "support-processing-pipeline"
      }
    }
  };
}

function buildDeliveryMessages(): DeliveryMessage[] {
  return [
    {
      localId: "delivery_1",
      channel: "matrix",
      roomId: "!room:example.org",
      userId: "@user:example.org",
      content: "Réponse"
    }
  ];
}

describe("runMatrixSupportAutomation", function () {
  let tempDir: string;
  let messageRepository: RealJsonMessageRepository;
  let ticketRepository: RealJsonTicketRepository;
  let userRepository: RealJsonUserRepository;

  beforeEach(async function () {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "matrix-runner-test-"));
    messageRepository = new RealJsonMessageRepository(
      path.join(tempDir, "messages.json")
    );
    ticketRepository = new RealJsonTicketRepository(
      path.join(tempDir, "tickets.json")
    );
    userRepository = new RealJsonUserRepository(path.join(tempDir, "users.json"));
  });

  afterEach(async function () {
    await fs.rm(tempDir, {
      recursive: true,
      force: true
    });
  });

  it("buffers Matrix messages, runs support automation, and sends delivery messages", async function () {
    let onMessage:
      | ((event: MessagingEvent) => void | Promise<void>)
      | undefined;
    const listenerStop = vi.fn(async () => undefined);
    const deliveryMessages = buildDeliveryMessages();
    const supportAutomationTurnResult: SupportAutomationTurnResult = {
      matchingResult: {
        channel: "matrix",
        roomId: "!room:example.org",
        userId: "@user:example.org",
        messages: [buildMessagingEvent()]
      },
      supportProcessingInput: buildSupportProcessingInput(),
      supportProcessingOutput: buildSupportProcessingOutput(),
      deliveryMessages,
      persistenceResult: {
        storedIncomingMessageIds: ["$message_1"],
        storedOutgoingMessageIds: ["delivery_1"],
        patchStatus: "skipped"
      }
    };
    const matrixDeliveryResults: MatrixDeliveryResult[] = [
      {
        channel: "matrix",
        roomId: "!room:example.org",
        deliveredMessages: [
          {
            localId: "delivery_1",
            providerMessageId: "$provider_1",
            content: "Réponse",
            deliveredAt: "2026-06-05T10:00:02.000Z"
          }
        ],
        failedMessages: []
      }
    ];
    const runTurn = vi.fn(async () => supportAutomationTurnResult);
    const sendDelivery = vi.fn(async () => matrixDeliveryResults);
    const persistDeliveryResult = vi.fn(async () => {
      return {
        status: "skipped" as const,
        warnings: ["test no-op"]
      };
    });
    const listenEvents = vi.fn(async (params) => {
      onMessage = params.onMessage;

      return {
        stop: listenerStop
      };
    });
    const logger = {
      log: vi.fn(),
      error: vi.fn()
    };

    const handle = await runMatrixSupportAutomation({
      config: {
        homeserverUrl: "https://matrix.example.org",
        accessToken: "super-secret-token",
        defaultRoomId: "!room:example.org"
      },
      inactivityTimeoutMs: 1000,
      runnerStartedAt: buildRunnerStartedAt(),
      messageRepository,
      ticketRepository,
      userRepository,
      logger,
      dependencies: {
        listenMatrixEvents: listenEvents,
        runSupportAutomationTurn: runTurn,
        sendMatrixDeliveryMessages: sendDelivery,
        applyDeliveryResult: persistDeliveryResult
      }
    });

    await onMessage?.(buildMessagingEvent());
    await expect(handle.flushPending()).resolves.toEqual([
      {
        supportAutomationTurnResult,
        matrixDeliveryResults,
        deliveryResultPersistenceResult: {
          status: "skipped",
          warnings: ["test no-op"]
        }
      }
    ]);

    expect(runTurn).toHaveBeenCalledWith({
      bufferedMessages: expect.objectContaining({
        channel: "matrix",
        roomId: "!room:example.org",
        userId: "@user:example.org",
        messages: [buildMessagingEvent()]
      }),
      ticketRepository: expect.anything() as JsonTicketRepository,
      userRepository: expect.anything() as JsonUserRepository,
      messageRepository: expect.anything() as JsonMessageRepository,
      steps: undefined
    });
    expect(sendDelivery).toHaveBeenCalledWith({
      config: {
        homeserverUrl: "https://matrix.example.org",
        accessToken: "super-secret-token",
        defaultRoomId: "!room:example.org"
      },
      messages: deliveryMessages
    });
    expect(persistDeliveryResult).toHaveBeenCalledWith({
      matrixDeliveryResults,
      messageRepository
    });
    expect(logger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "matrix.runner.started",
        dryRun: false,
        defaultRoomConfigured: true,
        bufferInactivityMs: 1000
      })
    );
    expect(logger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "matrix.runner.mode",
        mode: "single_room",
        defaultRoomId: "!room:example.org"
      })
    );
    expect(logger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "support.turn.completed",
        roomId: "!room:example.org",
        deliveryMessageCount: 1,
        persistenceResult: supportAutomationTurnResult.persistenceResult
      })
    );
    expect(logger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "matrix.delivery.completed",
        deliveryResults: matrixDeliveryResults
      })
    );
    expect(JSON.stringify(logger.log.mock.calls)).not.toContain(
      "super-secret-token"
    );
    expect(logger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "support.turn.missing_ticket"
      })
    );
    expect(logger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "support.turn.missing_user"
      })
    );

    await handle.stop();
    expect(listenerStop).toHaveBeenCalled();
  });

  it("ignores an incoming message already stored in JSON messages", async function () {
    let onMessage:
      | ((event: MessagingEvent) => void | Promise<void>)
      | undefined;
    const runTurn = vi.fn(async () => {
      throw new Error("runTurn should not be called for duplicates");
    });
    const sendDelivery = vi.fn(async () => []);
    const listenEvents = vi.fn(async (params) => {
      onMessage = params.onMessage;

      return {
        stop: vi.fn(async () => undefined)
      };
    });
    const logger = {
      log: vi.fn(),
      error: vi.fn()
    };

    await messageRepository.append({
      messageId: "$message_1",
      channel: "matrix",
      roomId: "!room:example.org",
      userId: "@user:example.org",
      direction: "incoming",
      content: "Already seen",
      createdAt: "2026-06-05T09:59:00.000Z"
    });

    const handle = await runMatrixSupportAutomation({
      config: {
        homeserverUrl: "https://matrix.example.org",
        accessToken: "token",
        defaultRoomId: "!room:example.org"
      },
      inactivityTimeoutMs: 1000,
      runnerStartedAt: buildRunnerStartedAt(),
      messageRepository,
      ticketRepository,
      userRepository,
      logger,
      dependencies: {
        listenMatrixEvents: listenEvents,
        runSupportAutomationTurn: runTurn,
        sendMatrixDeliveryMessages: sendDelivery
      }
    });

    await onMessage?.(buildMessagingEvent());
    await expect(handle.flushPending()).resolves.toEqual([]);

    expect(runTurn).not.toHaveBeenCalled();
    expect(sendDelivery).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "matrix.message.ignored_duplicate",
        messageId: "$message_1"
      })
    );

    await handle.stop();
  });

  it("runs in dry-run mode without calling Matrix delivery", async function () {
    let onMessage:
      | ((event: MessagingEvent) => void | Promise<void>)
      | undefined;
    const deliveryMessages = buildDeliveryMessages();
    const supportAutomationTurnResult: SupportAutomationTurnResult = {
      matchingResult: {
        channel: "matrix",
        roomId: "!room:example.org",
        userId: "@user:example.org",
        messages: [buildMessagingEvent()]
      },
      supportProcessingInput: buildSupportProcessingInput(),
      supportProcessingOutput: buildSupportProcessingOutput(),
      deliveryMessages,
      persistenceResult: {
        storedIncomingMessageIds: ["$message_1"],
        storedOutgoingMessageIds: ["delivery_1"],
        patchStatus: "skipped"
      }
    };
    const runTurn = vi.fn(async () => supportAutomationTurnResult);
    const sendDelivery = vi.fn(async () => {
      throw new Error("sendDelivery should not be called in dry-run");
    });
    const listenEvents = vi.fn(async (params) => {
      onMessage = params.onMessage;

      return {
        stop: vi.fn(async () => undefined)
      };
    });
    const logger = {
      log: vi.fn(),
      error: vi.fn()
    };

    const handle = await runMatrixSupportAutomation({
      config: {
        homeserverUrl: "https://matrix.example.org",
        accessToken: "token",
        defaultRoomId: "!room:example.org"
      },
      inactivityTimeoutMs: 1000,
      runnerStartedAt: buildRunnerStartedAt(),
      messageRepository,
      ticketRepository,
      userRepository,
      logger,
      dryRun: true,
      dependencies: {
        listenMatrixEvents: listenEvents,
        runSupportAutomationTurn: runTurn,
        sendMatrixDeliveryMessages: sendDelivery
      }
    });

    await onMessage?.(buildMessagingEvent());
    await expect(handle.flushPending()).resolves.toEqual([
      {
        supportAutomationTurnResult,
        matrixDeliveryResults: []
      }
    ]);

    expect(sendDelivery).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "matrix.delivery.dry_run",
        messages: deliveryMessages
      })
    );

    await handle.stop();
  });

  it("logs all joined rooms mode when no default room is configured", async function () {
    const listenEvents = vi.fn(async () => {
      return {
        stop: vi.fn(async () => undefined)
      };
    });
    const logger = {
      log: vi.fn(),
      error: vi.fn()
    };

    const handle = await runMatrixSupportAutomation({
      config: {
        homeserverUrl: "https://matrix.example.org",
        accessToken: "do-not-log-me"
      },
      runnerStartedAt: buildRunnerStartedAt(),
      messageRepository,
      ticketRepository,
      userRepository,
      logger,
      dependencies: {
        listenMatrixEvents: listenEvents,
        runSupportAutomationTurn: vi.fn(),
        sendMatrixDeliveryMessages: vi.fn()
      }
    });

    expect(logger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "matrix.runner.mode",
        mode: "all_joined_rooms",
        defaultRoomId: undefined
      })
    );
    expect(JSON.stringify(logger.log.mock.calls)).not.toContain(
      "do-not-log-me"
    );

    await handle.stop();
  });

  it("ignores historical Matrix messages before buffering", async function () {
    let onMessage:
      | ((event: MessagingEvent) => void | Promise<void>)
      | undefined;
    const runTurn = vi.fn(async () => {
      throw new Error("runTurn should not be called for historical messages");
    });
    const sendDelivery = vi.fn(async () => []);
    const listenEvents = vi.fn(async (params) => {
      onMessage = params.onMessage;

      return {
        stop: vi.fn(async () => undefined)
      };
    });
    const logger = {
      log: vi.fn(),
      error: vi.fn()
    };

    const handle = await runMatrixSupportAutomation({
      config: {
        homeserverUrl: "https://matrix.example.org",
        accessToken: "token",
        defaultRoomId: "!room:example.org"
      },
      runnerStartedAt: new Date("2026-06-05T10:00:00.000Z"),
      startupGraceMs: 5000,
      messageRepository,
      ticketRepository,
      userRepository,
      logger,
      dependencies: {
        listenMatrixEvents: listenEvents,
        runSupportAutomationTurn: runTurn,
        sendMatrixDeliveryMessages: sendDelivery
      }
    });

    await onMessage?.({
      ...buildMessagingEvent(),
      messageId: "$historical",
      createdAt: "2026-06-05T09:59:54.999Z"
    });
    await expect(handle.flushPending()).resolves.toEqual([]);

    expect(runTurn).not.toHaveBeenCalled();
    expect(sendDelivery).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "matrix.message.ignored_historical",
        messageId: "$historical",
        createdAt: "2026-06-05T09:59:54.999Z",
        runnerStartedAt: "2026-06-05T10:00:00.000Z"
      })
    );

    await handle.stop();
  });

  it("accepts Matrix messages sent after runner startup", async function () {
    let onMessage:
      | ((event: MessagingEvent) => void | Promise<void>)
      | undefined;
    const deliveryMessages = buildDeliveryMessages();
    const acceptedEvent = {
      ...buildMessagingEvent(),
      messageId: "$new_message",
      createdAt: "2026-06-05T10:00:01.000Z"
    };
    const supportAutomationTurnResult: SupportAutomationTurnResult = {
      matchingResult: {
        channel: "matrix",
        roomId: "!room:example.org",
        userId: "@user:example.org",
        messages: [acceptedEvent]
      },
      supportProcessingInput: buildSupportProcessingInput(),
      supportProcessingOutput: buildSupportProcessingOutput(),
      deliveryMessages,
      persistenceResult: {
        storedIncomingMessageIds: ["$new_message"],
        storedOutgoingMessageIds: ["delivery_1"],
        patchStatus: "skipped"
      }
    };
    const runTurn = vi.fn(async () => supportAutomationTurnResult);
    const listenEvents = vi.fn(async (params) => {
      onMessage = params.onMessage;

      return {
        stop: vi.fn(async () => undefined)
      };
    });
    const logger = {
      log: vi.fn(),
      error: vi.fn()
    };

    const handle = await runMatrixSupportAutomation({
      config: {
        homeserverUrl: "https://matrix.example.org",
        accessToken: "token",
        defaultRoomId: "!room:example.org"
      },
      runnerStartedAt: new Date("2026-06-05T10:00:00.000Z"),
      startupGraceMs: 5000,
      messageRepository,
      ticketRepository,
      userRepository,
      logger,
      dryRun: true,
      dependencies: {
        listenMatrixEvents: listenEvents,
        runSupportAutomationTurn: runTurn,
        sendMatrixDeliveryMessages: vi.fn()
      }
    });

    await onMessage?.(acceptedEvent);
    await handle.flushPending();

    expect(runTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        bufferedMessages: expect.objectContaining({
          messages: [acceptedEvent]
        })
      })
    );
    expect(logger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "buffer.message_added",
        messageId: "$new_message"
      })
    );

    await handle.stop();
  });

  it("processes historical messages when explicitly enabled", async function () {
    let onMessage:
      | ((event: MessagingEvent) => void | Promise<void>)
      | undefined;
    const historicalEvent = {
      ...buildMessagingEvent(),
      messageId: "$historical_allowed",
      createdAt: "2026-06-05T09:00:00.000Z"
    };
    const supportAutomationTurnResult: SupportAutomationTurnResult = {
      matchingResult: {
        channel: "matrix",
        roomId: "!room:example.org",
        userId: "@user:example.org",
        messages: [historicalEvent]
      },
      supportProcessingInput: buildSupportProcessingInput(),
      supportProcessingOutput: buildSupportProcessingOutput(),
      deliveryMessages: [],
      persistenceResult: {
        storedIncomingMessageIds: ["$historical_allowed"],
        storedOutgoingMessageIds: [],
        patchStatus: "skipped"
      }
    };
    const runTurn = vi.fn(async () => supportAutomationTurnResult);
    const listenEvents = vi.fn(async (params) => {
      onMessage = params.onMessage;

      return {
        stop: vi.fn(async () => undefined)
      };
    });
    const logger = {
      log: vi.fn(),
      error: vi.fn()
    };

    const handle = await runMatrixSupportAutomation({
      config: {
        homeserverUrl: "https://matrix.example.org",
        accessToken: "token",
        defaultRoomId: "!room:example.org"
      },
      runnerStartedAt: new Date("2026-06-05T10:00:00.000Z"),
      processHistoricalMessages: true,
      messageRepository,
      ticketRepository,
      userRepository,
      logger,
      dryRun: true,
      dependencies: {
        listenMatrixEvents: listenEvents,
        runSupportAutomationTurn: runTurn,
        sendMatrixDeliveryMessages: vi.fn()
      }
    });

    await onMessage?.(historicalEvent);
    await handle.flushPending();

    expect(runTurn).toHaveBeenCalled();
    expect(logger.log).not.toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "matrix.message.ignored_historical"
      })
    );

    await handle.stop();
  });

  it("delays buffered processing while Matrix typing is active", async function () {
    vi.useFakeTimers();

    try {
      let onMessage:
        | ((event: MessagingEvent) => void | Promise<void>)
        | undefined;
      let onTyping:
        | ((event: MessagingTypingEvent) => void | Promise<void>)
        | undefined;
      const supportAutomationTurnResult: SupportAutomationTurnResult = {
        matchingResult: {
          channel: "matrix",
          roomId: "!room:example.org",
          userId: "@user:example.org",
          messages: [buildMessagingEvent()]
        },
        supportProcessingInput: buildSupportProcessingInput(),
        supportProcessingOutput: buildSupportProcessingOutput(),
        deliveryMessages: [],
        persistenceResult: {
          storedIncomingMessageIds: ["$message_1"],
          storedOutgoingMessageIds: [],
          patchStatus: "skipped"
        }
      };
      const runTurn = vi.fn(async () => supportAutomationTurnResult);
      const listenEvents = vi.fn(async (params) => {
        onMessage = params.onMessage;
        onTyping = params.onTyping;

        return {
          stop: vi.fn(async () => undefined)
        };
      });
      const logger = {
        log: vi.fn(),
        error: vi.fn()
      };

      const handle = await runMatrixSupportAutomation({
        config: {
          homeserverUrl: "https://matrix.example.org",
          accessToken: "token",
          defaultRoomId: "!room:example.org"
        },
        inactivityTimeoutMs: 1000,
        maxWaitMs: 10000,
        runnerStartedAt: buildRunnerStartedAt(),
        messageRepository,
        ticketRepository,
        userRepository,
        logger,
        dryRun: true,
        dependencies: {
          listenMatrixEvents: listenEvents,
          runSupportAutomationTurn: runTurn,
          sendMatrixDeliveryMessages: vi.fn()
        }
      });

      await onTyping?.(buildTypingEvent({
        isTyping: true
      }));
      await onMessage?.(buildMessagingEvent());
      await vi.advanceTimersByTimeAsync(1000);

      expect(runTurn).not.toHaveBeenCalled();
      expect(logger.log).toHaveBeenCalledWith(expect.objectContaining({
        eventName: "matrix.typing.received",
        roomId: "!room:example.org",
        userId: "@user:example.org",
        isTyping: true
      }));
      expect(logger.log).toHaveBeenCalledWith(expect.objectContaining({
        eventName: "buffer.flush_blocked_typing",
        roomId: "!room:example.org",
        userId: "@user:example.org",
        isTyping: true,
        messageCount: 1
      }));

      await onTyping?.(buildTypingEvent({
        isTyping: false,
        updatedAt: "2026-06-05T10:00:02.000Z"
      }));
      await vi.advanceTimersByTimeAsync(1000);

      expect(runTurn).toHaveBeenCalledWith(expect.objectContaining({
        bufferedMessages: expect.objectContaining({
          messages: [buildMessagingEvent()]
        })
      }));
      expect(logger.log).toHaveBeenCalledWith(expect.objectContaining({
        eventName: "buffer.typing_updated",
        roomId: "!room:example.org",
        userId: "@user:example.org",
        isTyping: false,
        messageCount: 1
      }));

      await handle.stop();
    } finally {
      vi.useRealTimers();
    }
  });
});
