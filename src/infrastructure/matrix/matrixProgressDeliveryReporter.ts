import {
  logError,
  logInfo
} from "./matrixSupportAutomationLogger";
import {createMatrixClient} from "./matrixClient";

import type {
  MatrixChannelConfig,
  MatrixDeliveryResult
} from "./typesMatrixChannel.types";
import type {
  MatrixSupportAutomationLogger
} from "./matrixSupportAutomationLogger";
import type {
  DeliveryMessage
} from "../../support-automation/delivery/typesDelivery.types";
import type {
  SupportAutomationProgressContext,
  SupportAutomationProgressReporter
} from "../../support-automation/runSupportAutomation";
import type {
  SupportProcessingProgressEvent
} from "../../support-automation/progress/typesSupportProgress.types";

type MatrixProgressDeliveryReporterOptions = {
  config: MatrixChannelConfig;
  logger?: MatrixSupportAutomationLogger;
  enabled?: boolean;
  typingTimeoutMs?: number;
};

type MatrixProgressState = {
  statusEventId: string;
};

const DEFAULT_TYPING_TIMEOUT_MS = 30_000;
const START_PROCESSING_MESSAGE = "Start processing...";

function createMatrixProgressDeliveryReporter(
  options: MatrixProgressDeliveryReporterOptions
): SupportAutomationProgressReporter {
  const enabled = options.enabled ?? true;
  const typingTimeoutMs = options.typingTimeoutMs ?? DEFAULT_TYPING_TIMEOUT_MS;
  const logger = options.logger ?? console;
  const progressStatesByTurnId = new Map<string, MatrixProgressState>();

  if (!enabled) {
    return {};
  }

  async function setTyping(
    context: SupportAutomationProgressContext,
    isTyping: boolean
  ): Promise<void> {
    try {
      const client = await createMatrixClient(options.config);

      if (!client.setTyping) {
        logError({
          logger,
          eventName: "support_automation.typing.unsupported",
          metadata: {
            roomId: context.roomId,
            userId: context.userId,
            turnId: context.turnId
          }
        });

        return;
      }

      await client.setTyping(
        context.roomId,
        isTyping,
        isTyping ? typingTimeoutMs : 0
      );

      logInfo({
        logger,
        eventName: isTyping
          ? "support_automation.typing.started"
          : "support_automation.typing.stopped",
        metadata: {
          roomId: context.roomId,
          userId: context.userId,
          turnId: context.turnId,
          typingTimeoutMs: isTyping ? typingTimeoutMs : 0
        }
      });
    } catch (error) {
      logError({
        logger,
        eventName: "support_automation.typing.failed",
        metadata: {
          roomId: context.roomId,
          userId: context.userId,
          turnId: context.turnId,
          isTyping,
          error: getErrorMessage(error)
        }
      });
    }
  }

  async function sendStartProcessingMessage(
    context: SupportAutomationProgressContext
  ): Promise<void> {
    try {
      const client = await createMatrixClient(options.config);

      if (!client.sendMessage) {
        logError({
          logger,
          eventName: "support_automation.progress_message.send_unsupported",
          metadata: {
            roomId: context.roomId,
            userId: context.userId,
            turnId: context.turnId
          }
        });

        return;
      }

      const statusEventId = await client.sendMessage(context.roomId, {
        msgtype: "m.text",
        body: START_PROCESSING_MESSAGE
      });

      progressStatesByTurnId.set(context.turnId, {
        statusEventId
      });

      logInfo({
        logger,
        eventName: "support_automation.progress_message.started",
        metadata: {
          roomId: context.roomId,
          userId: context.userId,
          turnId: context.turnId,
          statusEventId
        }
      });
    } catch (error) {
      logError({
        logger,
        eventName: "support_automation.progress_message.start_failed",
        metadata: {
          roomId: context.roomId,
          userId: context.userId,
          turnId: context.turnId,
          error: getErrorMessage(error)
        }
      });
    }
  }

  async function deliverFinalMessages(
    context: SupportAutomationProgressContext,
    messages: DeliveryMessage[]
  ): Promise<MatrixDeliveryResult[] | null> {
    const state = progressStatesByTurnId.get(context.turnId);

    if (!state) {
      logInfo({
        logger,
        eventName: "support_automation.progress_message.final_edit_skipped_no_status",
        metadata: {
          roomId: context.roomId,
          userId: context.userId,
          turnId: context.turnId
        }
      });

      return null;
    }

    if (messages.length !== 1) {
      logInfo({
        logger,
        eventName: "support_automation.progress_message.final_edit_skipped_message_count",
        metadata: {
          roomId: context.roomId,
          userId: context.userId,
          turnId: context.turnId,
          messageCount: messages.length
        }
      });

      return null;
    }

    const [message] = messages;
    const finalContent = message.content.trim();

    if (finalContent === "") {
      return null;
    }

    const replacementEventId = await replaceProgressMessage({
      context,
      body: finalContent,
      eventName: "support_automation.progress_message.replaced_with_final_response"
    });

    if (!replacementEventId) {
      return null;
    }

    return buildEditedDeliveryResults({
      message,
      replacementEventId
    });
  }

  async function updateProgressMessage(
    context: SupportAutomationProgressContext,
    event: SupportProcessingProgressEvent
  ): Promise<void> {
    const body = formatProgressEvent(event);

    await replaceProgressMessage({
      context,
      body,
      eventName: "support_automation.progress_message.updated",
      progressCode: event.code
    });
  }

  async function replaceProgressMessage(params: {
    context: SupportAutomationProgressContext;
    body: string;
    eventName: string;
    progressCode?: string;
  }): Promise<string | null> {
    const state = progressStatesByTurnId.get(params.context.turnId);

    if (!state) {
      logInfo({
        logger,
        eventName: "support_automation.progress_message.update_skipped_no_status",
        metadata: {
          roomId: params.context.roomId,
          userId: params.context.userId,
          turnId: params.context.turnId,
          ...(params.progressCode ? {progressCode: params.progressCode} : {})
        }
      });

      return null;
    }

    try {
      const client = await createMatrixClient(options.config);

      if (!client.sendMessage) {
        logError({
          logger,
          eventName: "support_automation.progress_message.update_unsupported",
          metadata: {
            roomId: params.context.roomId,
            userId: params.context.userId,
            turnId: params.context.turnId,
            ...(params.progressCode ? {progressCode: params.progressCode} : {})
          }
        });

        return null;
      }

      const replacementEventId = await client.sendMessage(params.context.roomId, {
        msgtype: "m.text",
        body: `* ${params.body}`,
        "m.new_content": {
          msgtype: "m.text",
          body: params.body
        },
        "m.relates_to": {
          rel_type: "m.replace",
          event_id: state.statusEventId
        }
      });

      logInfo({
        logger,
        eventName: params.eventName,
        metadata: {
          roomId: params.context.roomId,
          userId: params.context.userId,
          turnId: params.context.turnId,
          originalEventId: state.statusEventId,
          replacementEventId,
          ...(params.progressCode ? {progressCode: params.progressCode} : {})
        }
      });

      return replacementEventId;
    } catch (error) {
      logError({
        logger,
        eventName: "support_automation.progress_message.update_failed",
        metadata: {
          roomId: params.context.roomId,
          userId: params.context.userId,
          turnId: params.context.turnId,
          ...(params.progressCode ? {progressCode: params.progressCode} : {}),
          error: getErrorMessage(error)
        }
      });

      return null;
    }
  }

  return {
    startTurn: async (context) => {
      await setTyping(context, true);
      await sendStartProcessingMessage(context);
    },

    update: async (context, event) => {
      await updateProgressMessage(context, event);
    },

    deliverFinalMessages,

    finishTurn: async (context) => {
      await setTyping(context, false);
      progressStatesByTurnId.delete(context.turnId);
    },

    failTurn: async (context) => {
      await setTyping(context, false);
      progressStatesByTurnId.delete(context.turnId);
    }
  };
}

function formatProgressEvent(event: SupportProcessingProgressEvent): string {
  const details = event.details ?? [];

  if (details.length === 0) {
    return event.title;
  }

  return [
    event.title,
    "",
    ...details.map((detail) => `- ${detail}`)
  ].join("\n");
}

function buildEditedDeliveryResults(params: {
  message: DeliveryMessage;
  replacementEventId: string;
}): MatrixDeliveryResult[] {
  return [
    {
      deliveredMessages: [
        {
          ...params.message,
          eventId: params.replacementEventId,
          content: params.message.content
        }
      ],
      failedMessages: []
    } as unknown as MatrixDeliveryResult
  ];
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export {
  createMatrixProgressDeliveryReporter
};
