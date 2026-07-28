import { InMemoryMessageBuffer } from "../../support-automation/buffer/inMemoryMessageBuffer";
import { runSupportAutomationTurn } from "./runSupportAutomationTurn";
import { applyDeliveryResult } from "../persistence/applyDeliveryResult";
import { JsonMessageRepository } from "../repositories/json/jsonMessageRepository";
import { JsonTicketRepository } from "../repositories/json/jsonTicketRepository";
import { JsonUserRepository } from "../repositories/json/jsonUserRepository";
import { listenMatrixEvents } from "../../infrastructure/matrix/listenMatrixEvents";
import {
  logError,
  logInfo,
  logWarn
} from "../../infrastructure/matrix/matrixSupportAutomationLogger";
import { sendMatrixDeliveryMessages } from "../../infrastructure/matrix/sendMatrixMessages";

import type {
  BufferedMessages,
  MessagingEvent,
  MessagingTypingEvent
} from "../../support-automation/buffer/typesMessaging.types";
import type {
  SupportAutomationTurnResult
} from "./typesOrchestration.types";
import type {
  DeliveryResultPersistenceResult
} from "../persistence/applyDeliveryResult";
import type {
  SupportProcessingPipelineSteps
} from "../support-processing-pipeline/typesSupportProcessingPipeline.types";
import type {
  MatrixSupportAutomationLogger
} from "../../infrastructure/matrix/matrixSupportAutomationLogger";
import type {
  MatrixChannelConfig,
  MatrixDeliveryResult
} from "../../infrastructure/matrix/typesMatrixChannel.types";

const DEFAULT_MATRIX_BUFFER_INACTIVITY_MS = 2000;
const DEFAULT_MATRIX_BUFFER_MAX_WAIT_MS = 30000;
const DEFAULT_MATRIX_STARTUP_GRACE_MS = 5000;

type RunSupportAutomationTurnFunction = typeof runSupportAutomationTurn;
type ListenMatrixEventsFunction = typeof listenMatrixEvents;
type SendMatrixDeliveryMessagesFunction = typeof sendMatrixDeliveryMessages;
type ApplyDeliveryResultFunction = typeof applyDeliveryResult;

type MatrixSupportAutomationDependencies = {
  listenMatrixEvents?: ListenMatrixEventsFunction;
  sendMatrixDeliveryMessages?: SendMatrixDeliveryMessagesFunction;
  runSupportAutomationTurn?: RunSupportAutomationTurnFunction;
  applyDeliveryResult?: ApplyDeliveryResultFunction;
};

type MatrixSupportAutomationRunRecord = {
  supportAutomationTurnResult: SupportAutomationTurnResult;
  matrixDeliveryResults: MatrixDeliveryResult[];
  deliveryResultPersistenceResult?: DeliveryResultPersistenceResult;
};

type MatrixSupportAutomationHandle = {
  stop: () => Promise<void>;
  flushPending: () => Promise<MatrixSupportAutomationRunRecord[]>;
};

type RunMatrixSupportAutomationParams = {
  config: MatrixChannelConfig;
  inactivityTimeoutMs?: number;
  maxWaitMs?: number;
  ticketRepository?: JsonTicketRepository;
  userRepository?: JsonUserRepository;
  messageRepository?: JsonMessageRepository;
  steps?: SupportProcessingPipelineSteps;
  logger?: MatrixSupportAutomationLogger;
  dependencies?: MatrixSupportAutomationDependencies;
  dryRun?: boolean;
  ignoreMessagesBeforeStartup?: boolean;
  processHistoricalMessages?: boolean;
  startupGraceMs?: number;
  runnerStartedAt?: Date;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

  const oldestAcceptedMessageTime =
    params.runnerStartedAt.getTime() - params.startupGraceMs;

  return eventCreatedAt.getTime() < oldestAcceptedMessageTime;
}

async function runMatrixSupportAutomation(
  params: RunMatrixSupportAutomationParams
): Promise<MatrixSupportAutomationHandle> {
  const logger = params.logger ?? console;
  const ticketRepository =
    params.ticketRepository ?? new JsonTicketRepository();
  const userRepository =
    params.userRepository ?? new JsonUserRepository();
  const messageRepository =
    params.messageRepository ?? new JsonMessageRepository();
  const runTurn =
    params.dependencies?.runSupportAutomationTurn ?? runSupportAutomationTurn;
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

  logInfo({
    logger,
    eventName: "matrix.runner.started",
    metadata: {
      dryRun,
      defaultRoomConfigured: params.config.defaultRoomId !== undefined,
      bufferInactivityMs: inactivityTimeoutMs,
      bufferMaxWaitMs: maxWaitMs,
      runnerStartedAt: runnerStartedAt.toISOString(),
      ignoreMessagesBeforeStartup,
      processHistoricalMessages,
      startupGraceMs,
      matrixStoragePath: params.config.storagePath,
      dataFiles: {
        tickets: "data/tickets.json",
        users: "data/users.json",
        messages: "data/messages.json"
      }
    }
  });

  logInfo({
    logger,
    eventName: "matrix.runner.mode",
    metadata: {
      mode:
        params.config.defaultRoomId !== undefined
          ? "single_room"
          : "all_joined_rooms",
      defaultRoomId: params.config.defaultRoomId
    }
  });

  async function processBufferedMessages(
    bufferedMessages: BufferedMessages
  ): Promise<MatrixSupportAutomationRunRecord> {
    logInfo({
      logger,
      eventName: "buffer.flushed",
      metadata: {
        roomId: bufferedMessages.roomId,
        userId: bufferedMessages.userId,
        messageCount: bufferedMessages.messages.length
      }
    });

    logInfo({
      logger,
      eventName: "support.turn.started",
      metadata: {
        roomId: bufferedMessages.roomId,
        userId: bufferedMessages.userId
      }
    });

    const supportAutomationTurnResult = await runTurn({
      bufferedMessages,
      ticketRepository,
      userRepository,
      messageRepository,
      steps: params.steps
    });

    if (supportAutomationTurnResult.matchingResult.ticket === undefined) {
      logWarn({
        logger,
        eventName: "support.turn.missing_ticket",
        metadata: {
          roomId: bufferedMessages.roomId,
          userId: bufferedMessages.userId
        }
      });
    }

    if (supportAutomationTurnResult.matchingResult.user === undefined) {
      logWarn({
        logger,
        eventName: "support.turn.missing_user",
        metadata: {
          roomId: bufferedMessages.roomId,
          userId: bufferedMessages.userId
        }
      });
    }

    logInfo({
      logger,
      eventName: "support.turn.completed",
      metadata: {
        roomId: bufferedMessages.roomId,
        userId: bufferedMessages.userId,
        deliveryMessageCount:
          supportAutomationTurnResult.deliveryMessages.length,
        persistenceResult: supportAutomationTurnResult.persistenceResult
      }
    });

    if (dryRun) {
      logInfo({
        logger,
        eventName: "matrix.delivery.dry_run",
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

    if (hasFailedDeliveries) {
      logWarn({
        logger,
        eventName: "matrix.delivery.partial_failed",
        metadata: {
          roomId: bufferedMessages.roomId,
          userId: bufferedMessages.userId,
          deliveryResults: matrixDeliveryResults
        }
      });
    } else {
      logInfo({
        logger,
        eventName: "matrix.delivery.completed",
        metadata: {
          roomId: bufferedMessages.roomId,
          userId: bufferedMessages.userId,
          deliveryResults: matrixDeliveryResults
        }
      });
    }

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
          eventName: "support.turn.failed",
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
      logInfo({
        logger,
        eventName: "matrix.message.received",
        metadata: {
          roomId: event.roomId,
          userId: event.userId,
          messageId: event.messageId
        }
      });

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
            createdAt: event.createdAt,
            runnerStartedAt: runnerStartedAt.toISOString()
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
          eventName: "matrix.message.ignored_duplicate",
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
    },
    onTyping: async (event: MessagingTypingEvent) => {
      logInfo({
        logger,
        eventName: "matrix.typing.received",
        metadata: {
          roomId: event.roomId,
          userId: event.userId,
          isTyping: event.isTyping
        }
      });

      buffer.updateTypingState(event);
    }
  });

  async function flushPending(): Promise<MatrixSupportAutomationRunRecord[]> {
    const pendingGroups = buffer.flushAll();

    return Promise.all(pendingGroups.map(async (bufferedMessages) => {
      try {
        return await processBufferedMessages(bufferedMessages);
      } catch (error) {
        logError({
          logger,
          eventName: "support.turn.failed",
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
  runMatrixSupportAutomation
};

export type {
  MatrixSupportAutomationDependencies,
  MatrixSupportAutomationHandle,
  MatrixSupportAutomationLogger,
  MatrixSupportAutomationRunRecord,
  RunMatrixSupportAutomationParams
};
