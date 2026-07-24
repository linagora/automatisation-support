import { InMemoryMessageBuffer } from "./buffer/inMemoryMessageBuffer";
import {
  runSupportAutomationTurnV2
} from "./runSupportAutomationPipelineV2";
import {
  applyLiveMemoryUpdate
} from "./patch-live-memory/applyLiveMemoryUpdate";
import {
  noopSupportPipelineInformationRepository
} from "../infrastructure/live-memory/noopSupportPipelineInformationRepository";
import {
  noopTelemetryEmitter
} from "../infrastructure/live-memory/noopTelemetryEmitter";
import { listenMatrixEvents } from "../infrastructure/matrix/listenMatrixEvents";
import {
  createMatrixSupportProgressReporter
} from "../infrastructure/matrix/matrixSupportProgressReporter";
import {
  logError,
  logInfo,
  logWarn
} from "../infrastructure/matrix/matrixSupportAutomationLogger";
import { sendMatrixDeliveryMessages } from "../infrastructure/matrix/sendMatrixMessages";

import type {
  BufferedMessages,
  MessagingEvent,
  MessagingTypingEvent
} from "./buffer/typesMessaging.types";
import type {
  SupportAutomationTurnV2Result
} from "./runSupportAutomationPipelineV2";
import type {
  ApplyLiveMemoryUpdateDeliveryResult
} from "./patch-live-memory/applyLiveMemoryUpdate";
import type {
  SupportPipelineInformationRepository
} from "../infrastructure/live-memory/noopSupportPipelineInformationRepository";
import type {
  TelemetryEmitter
} from "../infrastructure/live-memory/noopTelemetryEmitter";
import type {
  SupportProcessingPipelineV2Steps
} from "./support-processing-pipeline-v2-LEGACY/typesSupportProcessingPipelineV2.types";
import type {
  MatrixSupportAutomationLogger
} from "../infrastructure/matrix/matrixSupportAutomationLogger";
import type {
  SupportProgressReporter
} from "./progress/supportProgressReporter";
import type {
  MatrixSupportProgressReporterConfig
} from "../infrastructure/matrix/matrixSupportProgressReporter";
import type {
  MatrixChannelConfig,
  MatrixDeliveryResult
} from "../infrastructure/matrix/typesMatrixChannel.types";
import {
  getBufferedMessagesConversationScope,
  getMessageConversationScope,
  buildConversationScopeKey,
  serializeConversationScopeKey
} from "./buffer/conversationScope";

const DEFAULT_MATRIX_BUFFER_INACTIVITY_MS = 2000;
const DEFAULT_MATRIX_BUFFER_MAX_WAIT_MS = 30000;
const DEFAULT_MATRIX_STARTUP_GRACE_MS = 5000;

type RunSupportAutomationTurnV2Function = typeof runSupportAutomationTurnV2;
type ListenMatrixEventsFunction = typeof listenMatrixEvents;
type SendMatrixDeliveryMessagesFunction = typeof sendMatrixDeliveryMessages;
type ApplyLiveMemoryUpdateFunction = typeof applyLiveMemoryUpdate;

type MatrixSupportAutomationV2Dependencies = {
  listenMatrixEvents?: ListenMatrixEventsFunction;
  sendMatrixDeliveryMessages?: SendMatrixDeliveryMessagesFunction;
  runSupportAutomationTurnV2?: RunSupportAutomationTurnV2Function;
  applyLiveMemoryUpdate?: ApplyLiveMemoryUpdateFunction;
  telemetryEmitter?: TelemetryEmitter;
  supportPipelineInformationRepository?: SupportPipelineInformationRepository;
};

type MatrixSupportAutomationV2RunRecord = {
  supportAutomationTurnResult: SupportAutomationTurnV2Result;
  matrixDeliveryResults: MatrixDeliveryResult[];
  liveMemoryUpdateStatus?: "skipped" | "applied";
};

type MatrixSupportAutomationV2Handle = {
  stop: () => Promise<void>;
  flushPending: () => Promise<MatrixSupportAutomationV2RunRecord[]>;
};

type RunMatrixSupportAutomationV2Params = {
  config: MatrixChannelConfig;
  inactivityTimeoutMs?: number;
  maxWaitMs?: number;
  steps?: SupportProcessingPipelineV2Steps;
  logger?: MatrixSupportAutomationLogger;
  dependencies?: MatrixSupportAutomationV2Dependencies;
  dryRun?: boolean;
  progressConfig?: MatrixSupportProgressReporterConfig;
  progressReporter?: SupportProgressReporter;
  ignoreMessagesBeforeStartup?: boolean;
  processHistoricalMessages?: boolean;
  startupGraceMs?: number;
  runnerStartedAt?: Date;
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

function toLiveMemoryDeliveryResult(
  matrixDeliveryResults: MatrixDeliveryResult[]
): ApplyLiveMemoryUpdateDeliveryResult {
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

async function runMatrixSupportAutomationV2(
  params: RunMatrixSupportAutomationV2Params
): Promise<MatrixSupportAutomationV2Handle> {
  const logger = params.logger ?? console;
  const runTurn =
    params.dependencies?.runSupportAutomationTurnV2 ?? runSupportAutomationTurnV2;
  const listenEvents =
    params.dependencies?.listenMatrixEvents ?? listenMatrixEvents;
  const sendDelivery =
    params.dependencies?.sendMatrixDeliveryMessages ??
    sendMatrixDeliveryMessages;
  const persistLiveMemory =
    params.dependencies?.applyLiveMemoryUpdate ?? applyLiveMemoryUpdate;
  const telemetryEmitter =
    params.dependencies?.telemetryEmitter ?? noopTelemetryEmitter;
  const supportPipelineInformationRepository =
    params.dependencies?.supportPipelineInformationRepository ??
    noopSupportPipelineInformationRepository;
  const dryRun = params.dryRun === true;
  const inactivityTimeoutMs =
    params.inactivityTimeoutMs ?? DEFAULT_MATRIX_BUFFER_INACTIVITY_MS;
  const maxWaitMs =
    params.maxWaitMs ?? DEFAULT_MATRIX_BUFFER_MAX_WAIT_MS;
  const runnerStartedAt = params.runnerStartedAt ?? new Date();
  const startupGraceMs =
    params.startupGraceMs ?? DEFAULT_MATRIX_STARTUP_GRACE_MS;
  const ignoreMessagesBeforeStartup =
    params.ignoreMessagesBeforeStartup ?? true;
  const processHistoricalMessages = params.processHistoricalMessages === true;
  const progressReporter = params.progressReporter ??
    (params.progressConfig
      ? createMatrixSupportProgressReporter({
          matrixConfig: params.config,
          progressConfig: params.progressConfig,
          logger,
          dryRun
        })
      : undefined);
  const activeBufferTurnIdsByKey = new Map<string, string>();
  const activeProcessingScopeKeys = new Set<string>();
  const activeProcessingTurnIdsByKey = new Map<string, string>();
  const activeProcessingPromises = new Set<Promise<unknown>>();
  const seenMessageKeys = new Set<string>();

  logInfo({
    logger,
    eventName: "matrix.v2.runner.started",
    metadata: {
      dryRun,
      defaultRoomConfigured: params.config.defaultRoomId !== undefined,
      bufferInactivityMs: inactivityTimeoutMs,
      bufferMaxWaitMs: maxWaitMs,
      runnerStartedAt: runnerStartedAt.toISOString(),
      ignoreMessagesBeforeStartup,
      processHistoricalMessages,
      startupGraceMs,
      matrixStoragePath: params.config.storagePath
    }
  });

  async function runBufferedMessagesTurn(
    bufferedMessages: BufferedMessages
  ): Promise<MatrixSupportAutomationV2RunRecord> {
    const bufferKey = serializeConversationScopeKey(
      getBufferedMessagesConversationScope(bufferedMessages)
    );
    const turnId = activeBufferTurnIdsByKey.get(bufferKey) ??
      buildTurnId(bufferedMessages);
    const progressContext = {
      roomId: bufferedMessages.roomId,
      userId: bufferedMessages.userId,
      turnId,
      messageCount: bufferedMessages.messages.length
    };

    activeBufferTurnIdsByKey.delete(bufferKey);

    logInfo({
      logger,
      eventName: "buffer.flushed",
      metadata: {
        roomId: bufferedMessages.roomId,
        userId: bufferedMessages.userId,
        messageCount: bufferedMessages.messages.length
      }
    });

    await progressReporter?.startTurn(progressContext);

    let supportAutomationTurnResult: SupportAutomationTurnV2Result;

    try {
      supportAutomationTurnResult = await runTurn({
        bufferedMessages,
        steps: params.steps,
        progressReporter,
        progressContext
      });
    } catch (error) {
      await progressReporter?.failTurn(progressContext, error);
      throw error;
    }

    logInfo({
      logger,
      eventName: "support.v2.turn.completed",
      metadata: {
        roomId: bufferedMessages.roomId,
        userId: bufferedMessages.userId,
        deliveryMessageCount:
          supportAutomationTurnResult.deliveryMessages.length,
        turnIdentity: supportAutomationTurnResult.turnIdentity
      }
    });

    await progressReporter?.finishTurn(progressContext);

    if (dryRun) {
      logInfo({
        logger,
        eventName: "matrix.v2.delivery.dry_run",
        metadata: {
          roomId: bufferedMessages.roomId,
          userId: bufferedMessages.userId,
          messages: supportAutomationTurnResult.deliveryMessages
        }
      });

      return {
        supportAutomationTurnResult,
        matrixDeliveryResults: []
      };
    }

    const matrixDeliveryResults = await sendDelivery({
      config: params.config,
      messages: supportAutomationTurnResult.deliveryMessages
    });
    const hasFailedDeliveries = matrixDeliveryResults.some((result) => {
      return result.failedMessages.length > 0;
    });

    logInfo({
      logger,
      eventName: hasFailedDeliveries
        ? "matrix.v2.delivery.partial_failed"
        : "matrix.v2.delivery.completed",
      metadata: {
        roomId: bufferedMessages.roomId,
        userId: bufferedMessages.userId,
        deliveryResults: matrixDeliveryResults
      }
    });

    let liveMemoryUpdateStatus: "skipped" | "applied" = "skipped";

    try {
      await persistLiveMemory({
        turnIdentity: supportAutomationTurnResult.turnIdentity,
        liveMemoryUpdate:
          supportAutomationTurnResult.persistenceEffects.liveMemoryUpdate,
        deliveryResult: toLiveMemoryDeliveryResult(matrixDeliveryResults)
      });

      await telemetryEmitter.emit(
        supportAutomationTurnResult.persistenceEffects.openTelemetry
      );
      await supportPipelineInformationRepository.persist(
        supportAutomationTurnResult.persistenceEffects
          .otherSupportPipelineInformation
      );
      liveMemoryUpdateStatus = "applied";
    } catch (error) {
      logError({
        logger,
        eventName: "support_v2_persistence_failed",
        metadata: {
          roomId: bufferedMessages.roomId,
          userId: bufferedMessages.userId,
          error: getErrorMessage(error)
        }
      });
    }

    return {
      supportAutomationTurnResult,
      matrixDeliveryResults,
      liveMemoryUpdateStatus
    };
  }

  async function processBufferedMessages(
    bufferedMessages: BufferedMessages
  ): Promise<MatrixSupportAutomationV2RunRecord> {
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
        pendingMessageIds: [],
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
          pendingMessageIds: [],
          queueLength: 0
        }
      });

      return result;
    } catch (error) {
      logError({
        logger,
        eventName: "conversation.processing_failed",
        metadata: {
          scopeKey,
          turnId,
          messageIds,
          pendingMessageIds: [],
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
        eventName: "conversation.pending_processing_released_after_current_turn",
        metadata: {
          scopeKey,
          turnId,
          messageIds: [],
          pendingMessageIds: [],
          queueLength: 0
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
          eventName: "conversation.pending_processing_delayed_until_current_turn_done",
          metadata: {
            scopeKey: event.scopeKey,
            turnId: activeProcessingTurnIdsByKey.get(event.scopeKey),
            messageIds: event.messageIds,
            pendingMessageIds: event.messageIds,
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
          ...("isTyping" in event ? { isTyping: event.isTyping } : {}),
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
          eventName: "support.v2.turn.failed",
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
    config: params.config,
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
          eventName: "matrix.v2.message.ignored_historical",
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
          eventName: "matrix.v2.message.ignored_duplicate",
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
          eventName: "matrix.v2.message.ignored_empty",
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
            pendingMessageIds: [event.messageId],
            queueLength: 1
          }
        });
      }

      if (!activeBufferTurnIdsByKey.has(bufferKey)) {
        activeBufferTurnIdsByKey.set(bufferKey, event.messageId);
        await progressReporter?.startBuffer({
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

  async function flushPending(): Promise<MatrixSupportAutomationV2RunRecord[]> {
    const pendingGroups = buffer.flushAll();

    const records = await Promise.all(pendingGroups.map(async (bufferedMessages) => {
      try {
        return await processBufferedMessages(bufferedMessages);
      } catch (error) {
        logError({
          logger,
          eventName: "support.v2.turn.failed",
          metadata: {
            roomId: bufferedMessages.roomId,
            userId: bufferedMessages.userId,
            error: getErrorMessage(error)
          }
        });

        throw error;
      }
    }));

    return records;
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
  DEFAULT_MATRIX_BUFFER_MAX_WAIT_MS,
  DEFAULT_MATRIX_BUFFER_INACTIVITY_MS,
  DEFAULT_MATRIX_STARTUP_GRACE_MS,
  runMatrixSupportAutomationV2
};

export type {
  MatrixSupportAutomationV2Dependencies,
  MatrixSupportAutomationV2Handle,
  MatrixSupportAutomationV2RunRecord,
  RunMatrixSupportAutomationV2Params
};
