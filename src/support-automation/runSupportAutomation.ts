import "dotenv/config";
import {InMemoryMessageBuffer} from "./buffer/inMemoryMessageBuffer";
import {
  buildConversationScopeKey,
  getBufferedMessagesConversationScope,
  getMessageConversationScope,
  serializeConversationScopeKey
} from "./buffer/conversationScope";
import {listenMatrixEvents} from "../infrastructure/matrix/listenMatrixEvents";
import {sendMatrixDeliveryMessages} from "../infrastructure/matrix/sendMatrixMessages";
import {
  logError,
  logInfo,
  logWarn
} from "../infrastructure/matrix/matrixSupportAutomationLogger";
import {
  buildLiveMemoryConversationKey
} from "../infrastructure/live-memory/buildLiveMemoryConversationKey";
import {
  createEmptyLiveMemoryContextOptimized
} from "../infrastructure/live-memory/liveMemoryDefaults";
import {
  readLiveMemoryContext
} from "../infrastructure/live-memory/liveMemoryContextStore";
import {
  applyLiveMemoryPatch
} from "./patch-live-memory/applyLiveMemoryPatch";
import {
  runSupportProcessingPipelineV3Optimized as runSupportProcessingPipelineOptimized
} from "./support-processing-pipeline-optimized/runSupportProcessingPipelineOptimized";
import {
  createSupportProcessingRunDebugDumperFromEnv
} from "./debug/writeSupportProcessingRunDebugDump";

import type {
  BufferedMessages,
  MessagingEvent,
  MessagingTypingEvent,
  MessagingAttachment
} from "./buffer/typesMessaging.types";
import type {
  DeliveryMessage
} from "./delivery/typesDelivery.types";
import type {
  MatrixChannelConfig,
  MatrixDeliveryResult
} from "../infrastructure/matrix/typesMatrixChannel.types";
import type {
  MatrixSupportAutomationLogger
} from "../infrastructure/matrix/matrixSupportAutomationLogger";
import type {
  LiveMemoryContextOptimized
} from "../infrastructure/live-memory/liveMemoryContextOptimized.template";
import type {
  RunSupportProcessingPipelineV3OptimizedInput,
  RunSupportProcessingPipelineV3OptimizedOutput
} from "./support-processing-pipeline-optimized/runSupportProcessingPipelineOptimized";
import type {
  SupportProcessingProgressEvent
} from "./progress/typesSupportProgress.types";

const DEFAULT_BUFFER_INACTIVITY_MS = 2000;
const DEFAULT_BUFFER_MAX_WAIT_MS = 30000;
const DEFAULT_STARTUP_GRACE_MS = 5000;

type RunSupportProcessingPipelineFunction = (
  input: RunSupportProcessingPipelineV3OptimizedInput
) => Promise<RunSupportProcessingPipelineV3OptimizedOutput>;

type ListenMatrixEventsFunction = typeof listenMatrixEvents;
type SendMatrixDeliveryMessagesFunction = typeof sendMatrixDeliveryMessages;
type ReadLiveMemoryContextFunction = typeof readLiveMemoryContext;
type ApplyLiveMemoryPatchFunction = typeof applyLiveMemoryPatch;

type SupportAutomationStage =
  | "buffer_started"
  | "buffer_flushed"
  | "processing"
  | "sending_response"
  | "patching_live_memory"
  | "done"
  | "failed";

type SupportAutomationProgressContext = {
  roomId: string;
  userId: string;
  turnId: string;
  messageCount: number;
};

type SupportAutomationProgressReporter = {
  startBuffer?: (context: SupportAutomationProgressContext) => Promise<void>;
  startTurn?: (context: SupportAutomationProgressContext) => Promise<void>;
  stage?: (
    context: SupportAutomationProgressContext,
    stage: SupportAutomationStage
  ) => Promise<void>;
  update?: (
    context: SupportAutomationProgressContext,
    event: SupportProcessingProgressEvent
  ) => Promise<void>;
  deliverFinalMessages?: (
    context: SupportAutomationProgressContext,
    messages: DeliveryMessage[]
  ) => Promise<MatrixDeliveryResult[] | null>;
  finishTurn?: (context: SupportAutomationProgressContext) => Promise<void>;
  failTurn?: (
    context: SupportAutomationProgressContext,
    error: unknown
  ) => Promise<void>;
};

type SupportAutomationDependencies = {
  listenMatrixEvents?: ListenMatrixEventsFunction;
  sendMatrixDeliveryMessages?: SendMatrixDeliveryMessagesFunction;
  runSupportProcessingPipeline?: RunSupportProcessingPipelineFunction;
  readLiveMemoryContext?: ReadLiveMemoryContextFunction;
  applyLiveMemoryPatch?: ApplyLiveMemoryPatchFunction;
};

type SupportAutomationRunRecord = {
  conversationKey: string;
  supportProcessingInput: RunSupportProcessingPipelineV3OptimizedInput;
  supportProcessingOutput: RunSupportProcessingPipelineV3OptimizedOutput;
  deliveryMessages: DeliveryMessage[];
  matrixDeliveryResults: MatrixDeliveryResult[];
  liveMemoryPatchStatus: "skipped" | "applied";
};

type SupportAutomationHandle = {
  stop: () => Promise<void>;
  flushPending: () => Promise<SupportAutomationRunRecord[]>;
};

type RunSupportAutomationParams = {
  matrixConfig: MatrixChannelConfig;
  inactivityTimeoutMs?: number;
  maxWaitMs?: number;
  logger?: MatrixSupportAutomationLogger;
  dependencies?: SupportAutomationDependencies;
  dryRun?: boolean;
  progressReporter?: SupportAutomationProgressReporter;
  ignoreMessagesBeforeStartup?: boolean;
  processHistoricalMessages?: boolean;
  startupGraceMs?: number;
  runnerStartedAt?: Date;
};

type LiveMemoryPatchDeliveryResult = {
  status: "sent" | "failed" | "partial";
  deliveredMessages: Array<{
    content: string;
  }>;
};

const noopProgressReporter: Required<SupportAutomationProgressReporter> = {
  startBuffer: async () => undefined,
  startTurn: async () => undefined,
  stage: async () => undefined,
  update: async () => undefined,
  deliverFinalMessages: async () => null,
  finishTurn: async () => undefined,
  failTurn: async () => undefined
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function buildTurnId(bufferedMessages: BufferedMessages): string {
  return bufferedMessages.messages[0]?.messageId ??
    `${bufferedMessages.roomId}:${bufferedMessages.userId}:${Date.now()}`;
}

function getBufferedMessageIds(bufferedMessages: BufferedMessages): string[] {
  return bufferedMessages.messages.map((message) => {
    return message.messageId;
  });
}

function compactText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const compacted = value.replace(/\s+/g, " ").trim();

  return compacted === "" ? null : compacted;
}

function buildLatestUserMessage(bufferedMessages: BufferedMessages): {
  content: string;
  channel: string;
} {
  const content = bufferedMessages.messages
    .map((message) => compactText(message.content))
    .filter((messageContent): messageContent is string => messageContent !== null)
    .join("\n\n");

  return {
    content,
    channel: bufferedMessages.channel
  };
}

function buildLatestUserAttachments(
  bufferedMessages: BufferedMessages
): MessagingAttachment[] {
  return bufferedMessages.messages.flatMap((message) => {
    return message.attachments ?? [];
  });
}

function buildConversationKey(bufferedMessages: BufferedMessages): string {
  return buildLiveMemoryConversationKey({
    channel: bufferedMessages.channel,
    roomId: bufferedMessages.roomId,
    threadId: bufferedMessages.threadId ?? null,
    userId: bufferedMessages.userId
  });
}

function buildSupportProcessingInput(params: {
  bufferedMessages: BufferedMessages;
  liveMemoryContext: LiveMemoryContextOptimized;
}): RunSupportProcessingPipelineV3OptimizedInput {
  return {
    latestUserMessage: buildLatestUserMessage(params.bufferedMessages),
    latestUserAttachments: buildLatestUserAttachments(params.bufferedMessages),
    liveMemory: {
      topics: params.liveMemoryContext.topics ?? [],
      previousConversationTurn: params.liveMemoryContext.previousConversationTurn,
      userState: params.liveMemoryContext.userState,
      securityAlerts: params.liveMemoryContext.securityAlerts,
      failedPipelineMessages: params.liveMemoryContext.failedPipelineMessages
    }
  };
}

function buildDeliveryLocalId(params: {
  bufferedMessages: BufferedMessages;
  index: number;
}): string {
  const latestMessageId = params.bufferedMessages.messages.at(-1)?.messageId ??
    "no-message";

  return [
    "delivery",
    params.bufferedMessages.channel,
    params.bufferedMessages.roomId,
    params.bufferedMessages.userId,
    latestMessageId,
    String(params.index)
  ].join(":");
}

function mapPipelineResponseToDeliveryMessages(params: {
  bufferedMessages: BufferedMessages;
  output: RunSupportProcessingPipelineV3OptimizedOutput;
}): DeliveryMessage[] {
  const content = params.output.userResponse.content.trim();

  if (content === "") {
    return [];
  }

  return [
    {
      localId: buildDeliveryLocalId({
        bufferedMessages: params.bufferedMessages,
        index: 0
      }),
      channel: params.bufferedMessages.channel,
      roomId: params.bufferedMessages.roomId,
      ...(params.bufferedMessages.threadId
        ? {threadId: params.bufferedMessages.threadId}
        : {}),
      userId: params.bufferedMessages.userId,
      content,
      metadata: {
        pipelineStatus: params.output.status,
        handoffRecommended: params.output.userResponse.handoffRecommended
      }
    }
  ];
}

function toLiveMemoryPatchDeliveryResult(
  matrixDeliveryResults: MatrixDeliveryResult[]
): LiveMemoryPatchDeliveryResult {
  const deliveredMessages = matrixDeliveryResults.flatMap((result) => {
    return result.deliveredMessages.map((message) => {
      return {
        content: message.content
      };
    });
  });
  const failedCount = matrixDeliveryResults.reduce((count, result) => {
    return count + result.failedMessages.length;
  }, 0);

  if (deliveredMessages.length > 0 && failedCount > 0) {
    return {
      status: "partial",
      deliveredMessages
    };
  }

  if (deliveredMessages.length > 0) {
    return {
      status: "sent",
      deliveredMessages
    };
  }

  return {
    status: "failed",
    deliveredMessages: []
  };
}

function shouldIgnoreHistoricalMessage(params: {
  event: MessagingEvent;
  runnerStartedAt: Date;
  startupGraceMs: number;
  ignoreMessagesBeforeStartup: boolean;
  processHistoricalMessages: boolean;
}): boolean {
  if (
    params.processHistoricalMessages ||
    !params.ignoreMessagesBeforeStartup
  ) {
    return false;
  }

  const eventCreatedAt = new Date(params.event.createdAt);

  if (!Number.isFinite(eventCreatedAt.getTime())) {
    return false;
  }

  return eventCreatedAt.getTime() <
    params.runnerStartedAt.getTime() - params.startupGraceMs;
}

async function runSupportAutomation(
  params: RunSupportAutomationParams
): Promise<SupportAutomationHandle> {
  const logger = params.logger ?? console;
  const dryRun = params.dryRun === true;
  const inactivityTimeoutMs =
    params.inactivityTimeoutMs ?? DEFAULT_BUFFER_INACTIVITY_MS;
  const maxWaitMs = params.maxWaitMs ?? DEFAULT_BUFFER_MAX_WAIT_MS;
  const runnerStartedAt = params.runnerStartedAt ?? new Date();
  const startupGraceMs = params.startupGraceMs ?? DEFAULT_STARTUP_GRACE_MS;
  const ignoreMessagesBeforeStartup =
    params.ignoreMessagesBeforeStartup ?? true;
  const processHistoricalMessages = params.processHistoricalMessages === true;
  const progressReporter = {
    ...noopProgressReporter,
    ...(params.progressReporter ?? {})
  };
  const debugDumper = createSupportProcessingRunDebugDumperFromEnv();

  const listenEvents = params.dependencies?.listenMatrixEvents ?? listenMatrixEvents;
  const sendDelivery =
    params.dependencies?.sendMatrixDeliveryMessages ?? sendMatrixDeliveryMessages;
  const runPipeline =
    params.dependencies?.runSupportProcessingPipeline ??
    runSupportProcessingPipelineOptimized;
  const readMemory =
    params.dependencies?.readLiveMemoryContext ?? readLiveMemoryContext;
  const patchMemory =
    params.dependencies?.applyLiveMemoryPatch ?? applyLiveMemoryPatch;

  const activeBufferTurnIdsByKey = new Map<string, string>();
  const activeProcessingScopeKeys = new Set<string>();
  const activeProcessingTurnIdsByKey = new Map<string, string>();
  const activeProcessingPromises = new Set<Promise<unknown>>();
  const seenMessageKeys = new Set<string>();

  logInfo({
    logger,
    eventName: "support_automation.runner.started",
    metadata: {
      dryRun,
      defaultRoomConfigured: params.matrixConfig.defaultRoomId !== undefined,
      bufferInactivityMs: inactivityTimeoutMs,
      bufferMaxWaitMs: maxWaitMs,
      runnerStartedAt: runnerStartedAt.toISOString(),
      ignoreMessagesBeforeStartup,
      processHistoricalMessages,
      startupGraceMs,
      matrixStoragePath: params.matrixConfig.storagePath
    }
  });

  async function runBufferedMessagesTurn(
    bufferedMessages: BufferedMessages
  ): Promise<SupportAutomationRunRecord> {
    const bufferKey = serializeConversationScopeKey(
      getBufferedMessagesConversationScope(bufferedMessages)
    );
    const turnId = activeBufferTurnIdsByKey.get(bufferKey) ??
      buildTurnId(bufferedMessages);
    const progressContext: SupportAutomationProgressContext = {
      roomId: bufferedMessages.roomId,
      userId: bufferedMessages.userId,
      turnId,
      messageCount: bufferedMessages.messages.length
    };
    const conversationKey = buildConversationKey(bufferedMessages);

    activeBufferTurnIdsByKey.delete(bufferKey);

    logInfo({
      logger,
      eventName: "buffer.flushed",
      metadata: {
        roomId: bufferedMessages.roomId,
        userId: bufferedMessages.userId,
        conversationKey,
        messageCount: bufferedMessages.messages.length
      }
    });

    await progressReporter.stage(progressContext, "buffer_flushed");
    await progressReporter.startTurn(progressContext);
    await progressReporter.stage(progressContext, "processing");

    const liveMemoryContext =
      await readMemory(conversationKey) ?? createEmptyLiveMemoryContextOptimized();
    const supportProcessingInput = {
      ...buildSupportProcessingInput({
        bufferedMessages,
        liveMemoryContext
      }),
      progress: {
        report: async (event: SupportProcessingProgressEvent): Promise<void> => {
          try {
            await progressReporter.update(progressContext, event);
          } catch (error) {
            logError({
              logger,
              eventName: "support_automation.progress_update.failed",
              metadata: {
                roomId: progressContext.roomId,
                userId: progressContext.userId,
                turnId: progressContext.turnId,
                progressCode: event.code,
                error: getErrorMessage(error)
              }
            });
          }
        }
      }
    };
    let supportProcessingOutput: RunSupportProcessingPipelineV3OptimizedOutput;

    try {
      supportProcessingOutput = await runPipeline(supportProcessingInput);

      await writePipelineDebugDump({
        phase: "pipeline",
        progressContext,
        conversationKey,
        dryRun,
        latestUserMessage: supportProcessingInput.latestUserMessage,
        latestUserAttachments: supportProcessingInput.latestUserAttachments,
        liveMemoryContextBeforePipeline: liveMemoryContext,
        supportProcessingInput,
        supportProcessingOutput
      });
    } catch (error) {
      await writePipelineDebugDump({
        phase: "runner_error",
        progressContext,
        conversationKey,
        dryRun,
        latestUserMessage: supportProcessingInput.latestUserMessage,
        latestUserAttachments: supportProcessingInput.latestUserAttachments,
        liveMemoryContextBeforePipeline: liveMemoryContext,
        supportProcessingInput,
        runnerError: error
      });

      throw error;
    }

    const deliveryMessages = mapPipelineResponseToDeliveryMessages({
      bufferedMessages,
      output: supportProcessingOutput
    });

    logInfo({
      logger,
      eventName: "support_automation.turn.processed",
      metadata: {
        roomId: bufferedMessages.roomId,
        userId: bufferedMessages.userId,
        conversationKey,
        deliveryMessageCount: deliveryMessages.length,
        pipelineStatus: supportProcessingOutput.status,
        handoffRecommended: supportProcessingOutput.userResponse.handoffRecommended
      }
    });

    let matrixDeliveryResults: MatrixDeliveryResult[] = [];

    if (dryRun) {
      logInfo({
        logger,
        eventName: "support_automation.delivery.dry_run",
        metadata: {
          roomId: bufferedMessages.roomId,
          userId: bufferedMessages.userId,
          conversationKey,
          messages: deliveryMessages
        }
      });

      await progressReporter.finishTurn(progressContext);

      return {
        conversationKey,
        supportProcessingInput,
        supportProcessingOutput,
        deliveryMessages,
        matrixDeliveryResults,
        liveMemoryPatchStatus: "skipped"
      };
    }

    await progressReporter.stage(progressContext, "sending_response");

    const progressDeliveryResults = await progressReporter.deliverFinalMessages(
      progressContext,
      deliveryMessages
    );

    matrixDeliveryResults = progressDeliveryResults ?? await sendDelivery({
      config: params.matrixConfig,
      messages: deliveryMessages
    });

    const hasFailedDeliveries = matrixDeliveryResults.some((result) => {
      return result.failedMessages.length > 0;
    });

    logInfo({
      logger,
      eventName: hasFailedDeliveries
        ? "support_automation.delivery.partial_failed"
        : "support_automation.delivery.completed",
      metadata: {
        roomId: bufferedMessages.roomId,
        userId: bufferedMessages.userId,
        conversationKey,
        deliveryResults: matrixDeliveryResults
      }
    });

    let liveMemoryPatchStatus: "skipped" | "applied" = "skipped";

    try {
      await progressReporter.stage(progressContext, "patching_live_memory");

      await patchMemory({
        conversationKey,
        patches: supportProcessingOutput.patches,
        deliveryResult: toLiveMemoryPatchDeliveryResult(matrixDeliveryResults)
      });

      liveMemoryPatchStatus = "applied";
    } catch (error) {
      logError({
        logger,
        eventName: "support_automation.live_memory_patch_failed",
        metadata: {
          roomId: bufferedMessages.roomId,
          userId: bufferedMessages.userId,
          conversationKey,
          error: getErrorMessage(error)
        }
      });
    }

    await progressReporter.stage(progressContext, "done");
    await progressReporter.finishTurn(progressContext);

    return {
      conversationKey,
      supportProcessingInput,
      supportProcessingOutput,
      deliveryMessages,
      matrixDeliveryResults,
      liveMemoryPatchStatus
    };
  }

  async function writePipelineDebugDump(params: {
    phase: "pipeline" | "runner_error";
    progressContext: SupportAutomationProgressContext;
    conversationKey: string;
    dryRun: boolean;
    latestUserMessage: unknown;
    latestUserAttachments: unknown;
    liveMemoryContextBeforePipeline: unknown;
    supportProcessingInput: unknown;
    supportProcessingOutput?: unknown;
    runnerError?: unknown;
  }): Promise<void> {
    if (!debugDumper) {
      return;
    }

    try {
      await debugDumper({
        phase: params.phase,
        run: {
          roomId: params.progressContext.roomId,
          userId: params.progressContext.userId,
          turnId: params.progressContext.turnId,
          messageCount: params.progressContext.messageCount,
          conversationKey: params.conversationKey,
          dryRun: params.dryRun
        },
        latestUserMessage: params.latestUserMessage,
        latestUserAttachments: params.latestUserAttachments,
        liveMemoryContextBeforePipeline: params.liveMemoryContextBeforePipeline,
        supportProcessingInput: params.supportProcessingInput,
        supportProcessingOutput: params.supportProcessingOutput,
        runnerError: params.runnerError
      });
    } catch (error) {
      logError({
        logger,
        eventName: "support_automation.debug_dump.failed",
        metadata: {
          roomId: params.progressContext.roomId,
          userId: params.progressContext.userId,
          turnId: params.progressContext.turnId,
          phase: params.phase,
          error: getErrorMessage(error)
        }
      });
    }
  }

  async function processBufferedMessages(
    bufferedMessages: BufferedMessages
  ): Promise<SupportAutomationRunRecord> {
    const scopeKey = serializeConversationScopeKey(
      getBufferedMessagesConversationScope(bufferedMessages)
    );
    const messageIds = getBufferedMessageIds(bufferedMessages);
    const turnId = activeBufferTurnIdsByKey.get(scopeKey) ??
      buildTurnId(bufferedMessages);

    activeProcessingScopeKeys.add(scopeKey);
    activeProcessingTurnIdsByKey.set(scopeKey, turnId);

    logInfo({
      logger,
      eventName: "conversation.processing_started",
      metadata: {
        scopeKey,
        turnId,
        messageIds,
        queueLength: 0
      }
    });

    try {
      const result = await runBufferedMessagesTurn(bufferedMessages);

      logInfo({
        logger,
        eventName: "conversation.processing_finished",
        metadata: {
          scopeKey,
          turnId,
          messageIds,
          queueLength: 0
        }
      });

      return result;
    } catch (error) {
      const progressContext: SupportAutomationProgressContext = {
        roomId: bufferedMessages.roomId,
        userId: bufferedMessages.userId,
        turnId,
        messageCount: bufferedMessages.messages.length
      };

      await progressReporter.failTurn(progressContext, error);

      logError({
        logger,
        eventName: "conversation.processing_failed",
        metadata: {
          scopeKey,
          turnId,
          messageIds,
          queueLength: 0,
          error: getErrorMessage(error)
        }
      });

      throw error;
    } finally {
      activeProcessingScopeKeys.delete(scopeKey);
      activeProcessingTurnIdsByKey.delete(scopeKey);

      logInfo({
        logger,
        eventName: "conversation.pending_processing_released",
        metadata: {
          scopeKey,
          turnId
        }
      });

      buffer.reevaluateGroup(
        getBufferedMessagesConversationScope(bufferedMessages)
      );
    }
  }

  const buffer = new InMemoryMessageBuffer({
    inactivityTimeoutMs,
    maxWaitMs,
    canFlush: (groupKey) => {
      const scopeKey = serializeConversationScopeKey(
        buildConversationScopeKey(groupKey)
      );

      return !activeProcessingScopeKeys.has(scopeKey);
    },
    onDebugEvent: (event) => {
      if (event.eventName === "buffer.flush_blocked_processing") {
        logInfo({
          logger,
          eventName: "conversation.pending_processing_delayed",
          metadata: {
            scopeKey: event.scopeKey,
            turnId: activeProcessingTurnIdsByKey.get(event.scopeKey),
            messageIds: event.messageIds,
            queueLength: event.messageCount
          }
        });
        return;
      }

      logInfo({
        logger,
        eventName: event.eventName,
        metadata: {
          roomId: event.roomId,
          userId: event.userId,
          ...("isTyping" in event ? {isTyping: event.isTyping} : {}),
          messageCount: event.messageCount
        }
      });
    },
    onFlush: async (bufferedMessages) => {
      const processingPromise = processBufferedMessages(bufferedMessages);

      activeProcessingPromises.add(processingPromise);

      try {
        await processingPromise;
      } catch (error) {
        logError({
          logger,
          eventName: "support_automation.turn.failed",
          metadata: {
            roomId: bufferedMessages.roomId,
            userId: bufferedMessages.userId,
            error: getErrorMessage(error)
          }
        });
      } finally {
        activeProcessingPromises.delete(processingPromise);
      }
    }
  });

  const listenerHandle = await listenEvents({
    config: params.matrixConfig,
    downloadAttachments: !dryRun,
    onMessage: async (event: MessagingEvent) => {
      if (shouldIgnoreHistoricalMessage({
        event,
        runnerStartedAt,
        startupGraceMs,
        ignoreMessagesBeforeStartup,
        processHistoricalMessages
      })) {
        logWarn({
          logger,
          eventName: "matrix.message.ignored_historical",
          metadata: {
            roomId: event.roomId,
            userId: event.userId,
            messageId: event.messageId,
            createdAt: event.createdAt
          }
        });
        return;
      }

      const messageKey = `${event.channel}:${event.messageId}`;

      if (seenMessageKeys.has(messageKey)) {
        logWarn({
          logger,
          eventName: "matrix.message.ignored_duplicate",
          metadata: {
            roomId: event.roomId,
            userId: event.userId,
            messageId: event.messageId
          }
        });
        return;
      }

      seenMessageKeys.add(messageKey);

      const accepted = buffer.addMessage(event);

      if (!accepted) {
        logWarn({
          logger,
          eventName: "matrix.message.ignored_empty",
          metadata: {
            roomId: event.roomId,
            userId: event.userId,
            messageId: event.messageId
          }
        });
        return;
      }

      logInfo({
        logger,
        eventName: "buffer.message_added",
        metadata: {
          roomId: event.roomId,
          userId: event.userId,
          messageId: event.messageId
        }
      });

      const bufferKey = serializeConversationScopeKey(
        getMessageConversationScope(event)
      );

      if (activeProcessingScopeKeys.has(bufferKey)) {
        logInfo({
          logger,
          eventName: "conversation.pending_messages_collected",
          metadata: {
            scopeKey: bufferKey,
            turnId: activeProcessingTurnIdsByKey.get(bufferKey),
            messageIds: [event.messageId],
            queueLength: 1
          }
        });
      }

      if (!activeBufferTurnIdsByKey.has(bufferKey)) {
        activeBufferTurnIdsByKey.set(bufferKey, event.messageId);

        await progressReporter.startBuffer({
          roomId: event.roomId,
          userId: event.userId,
          turnId: event.messageId,
          messageCount: 1
        });
      }
    },
    onTyping: async (event: MessagingTypingEvent) => {
      buffer.updateTypingState(event);
    }
  });

  async function flushPending(): Promise<SupportAutomationRunRecord[]> {
    const pendingGroups = buffer.flushAll();

    return Promise.all(
      pendingGroups.map(async (bufferedMessages) => {
        return processBufferedMessages(bufferedMessages);
      })
    );
  }

  return {
    flushPending,
    stop: async () => {
      await listenerHandle.stop();
      await flushPending();

      while (activeProcessingPromises.size > 0) {
        await Promise.all([...activeProcessingPromises]);
      }

      buffer.dispose();
    }
  };
}

export {
  DEFAULT_BUFFER_INACTIVITY_MS,
  DEFAULT_BUFFER_MAX_WAIT_MS,
  DEFAULT_STARTUP_GRACE_MS,
  runSupportAutomation
};

export type {
  RunSupportAutomationParams,
  SupportAutomationDependencies,
  SupportAutomationHandle,
  SupportAutomationProgressContext,
  SupportAutomationProgressReporter,
  SupportAutomationRunRecord,
  SupportAutomationStage
};
