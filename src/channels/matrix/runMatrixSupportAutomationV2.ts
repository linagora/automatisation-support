import { InMemoryMessageBuffer } from "../../messaging/buffer/inMemoryMessageBuffer";
import {
  runSupportAutomationTurnV2
} from "../../orchestration/runSupportAutomationTurnV2";
import { applyDeliveryResult } from "../../persistence/applyDeliveryResult";
import { JsonMessageRepository } from "../../repositories/json/jsonMessageRepository";
import { JsonTicketRepository } from "../../repositories/json/jsonTicketRepository";
import { JsonUserRepository } from "../../repositories/json/jsonUserRepository";
import { listenMatrixEvents } from "./listenMatrixEvents";
import {
  createMatrixSupportProgressReporter
} from "./matrixSupportProgressReporter";
import {
  logError,
  logInfo,
  logWarn
} from "./matrixSupportAutomationLogger";
import { sendMatrixDeliveryMessages } from "./sendMatrixMessages";

import type {
  BufferedMessages,
  MessagingEvent,
  MessagingTypingEvent
} from "../../messaging/typesMessaging.types";
import type {
  SupportAutomationTurnV2Result
} from "../../orchestration/runSupportAutomationTurnV2";
import type {
  DeliveryResultPersistenceResult
} from "../../persistence/applyDeliveryResult";
import type {
  SupportProcessingPipelineV2Steps
} from "../../support-processing-pipeline/v2/typesSupportProcessingPipelineV2.types";
import type {
  MatrixSupportAutomationLogger
} from "./matrixSupportAutomationLogger";
import type {
  SupportProgressReporter
} from "../../orchestration/supportProgressReporter";
import type {
  MatrixSupportProgressReporterConfig
} from "./matrixSupportProgressReporter";
import type {
  MatrixChannelConfig,
  MatrixDeliveryResult
} from "./typesMatrixChannel.types";

const DEFAULT_MATRIX_BUFFER_INACTIVITY_MS = 2000;
const DEFAULT_MATRIX_BUFFER_MAX_WAIT_MS = 30000;
const DEFAULT_MATRIX_STARTUP_GRACE_MS = 5000;

type RunSupportAutomationTurnV2Function = typeof runSupportAutomationTurnV2;
type ListenMatrixEventsFunction = typeof listenMatrixEvents;
type SendMatrixDeliveryMessagesFunction = typeof sendMatrixDeliveryMessages;
type ApplyDeliveryResultFunction = typeof applyDeliveryResult;

type MatrixSupportAutomationV2Dependencies = {
  listenMatrixEvents?: ListenMatrixEventsFunction;
  sendMatrixDeliveryMessages?: SendMatrixDeliveryMessagesFunction;
  runSupportAutomationTurnV2?: RunSupportAutomationTurnV2Function;
  applyDeliveryResult?: ApplyDeliveryResultFunction;
};

type MatrixSupportAutomationV2RunRecord = {
  supportAutomationTurnResult: SupportAutomationTurnV2Result;
  matrixDeliveryResults: MatrixDeliveryResult[];
  deliveryResultPersistenceResult?: DeliveryResultPersistenceResult;
};

type MatrixSupportAutomationV2Handle = {
  stop: () => Promise<void>;
  flushPending: () => Promise<MatrixSupportAutomationV2RunRecord[]>;
};

type RunMatrixSupportAutomationV2Params = {
  config: MatrixChannelConfig;
  inactivityTimeoutMs?: number;
  maxWaitMs?: number;
  ticketRepository?: JsonTicketRepository;
  userRepository?: JsonUserRepository;
  messageRepository?: JsonMessageRepository;
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

function buildBufferKey(params: {
  roomId: string;
  userId: string;
}): string {
  return `${params.roomId}\u0000${params.userId}`;
}

function buildTurnId(bufferedMessages: BufferedMessages): string {
  return bufferedMessages.messages[0]?.messageId ??
    `${bufferedMessages.roomId}:${bufferedMessages.userId}:${Date.now()}`;
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
  const ticketRepository =
    params.ticketRepository ?? new JsonTicketRepository();
  const userRepository =
    params.userRepository ?? new JsonUserRepository();
  const messageRepository =
    params.messageRepository ?? new JsonMessageRepository();
  const runTurn =
    params.dependencies?.runSupportAutomationTurnV2 ?? runSupportAutomationTurnV2;
  const listenEvents =
    params.dependencies?.listenMatrixEvents ?? listenMatrixEvents;
  const sendDelivery =
    params.dependencies?.sendMatrixDeliveryMessages ??
    sendMatrixDeliveryMessages;
  const persistDeliveryResult =
    params.dependencies?.applyDeliveryResult ?? applyDeliveryResult;
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

  async function processBufferedMessages(
    bufferedMessages: BufferedMessages
  ): Promise<MatrixSupportAutomationV2RunRecord> {
    const bufferKey = buildBufferKey(bufferedMessages);
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
        ticketRepository,
        userRepository,
        messageRepository,
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
        persistenceResult: supportAutomationTurnResult.persistenceResult
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

    const deliveryResultPersistenceResult = await persistDeliveryResult({
      matrixDeliveryResults,
      messageRepository
    });

    return {
      supportAutomationTurnResult,
      matrixDeliveryResults,
      deliveryResultPersistenceResult
    };
  }

  const buffer = new InMemoryMessageBuffer({
    inactivityTimeoutMs,
    maxWaitMs,
    onDebugEvent: (event) => {
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
      try {
        await processBufferedMessages(bufferedMessages);
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
      }
    }
  });

  const listenerHandle = await listenEvents({
    config: params.config,
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

      const existingMessage = await messageRepository.findByMessageId(
        event.messageId
      );

      if (existingMessage !== undefined) {
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

      const bufferKey = buildBufferKey({
        roomId: event.roomId,
        userId: event.userId
      });

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

    return Promise.all(pendingGroups.map(async (bufferedMessages) => {
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
  }

  return {
    flushPending,
    stop: async () => {
      await listenerHandle.stop();
      await flushPending();
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
