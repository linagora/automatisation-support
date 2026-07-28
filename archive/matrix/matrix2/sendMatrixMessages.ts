import {
  createMatrixClient
} from "./matrixClient";

import type {
  MatrixIncomingMessage,
  MatrixLatestUserMessage,
  MatrixMessageToSend,
  MatrixUserResponse,
  SendMatrixMessagesInput
} from "./typesMatrix.types";

function mapUserResponseToMatrixMessages(
  userResponse: MatrixUserResponse
): MatrixMessageToSend[] {
  return userResponse.messages.map((message) => {
    return {
      type: message.type,
      content: message.content
    };
  });
}

function mapMatrixIncomingMessageToLatestUserMessage(
  incomingMessage: MatrixIncomingMessage
): MatrixLatestUserMessage {
  return {
    id: incomingMessage.eventId,
    content: incomingMessage.body,
    channel: "other",
    sentAt:
      incomingMessage.timestamp !== undefined
        ? new Date(incomingMessage.timestamp).toISOString()
        : new Date().toISOString()
  };
}

async function sendMatrixMessages(
  input: SendMatrixMessagesInput
): Promise<void> {
  const client = createMatrixClient(input.config);
  const messagesToSend = input.messages.filter((message) => {
    return message.content.trim() !== "";
  });

  // The bot account must already be joined or invited with permission to send
  // messages in the target room.
  for (const message of messagesToSend) {
    try {
      await client.sendText(input.config.roomId, message.content);
    } catch (error) {
      const details =
        error instanceof Error ? error.message : "Unknown Matrix send error";

      throw new Error(
        `Failed to send Matrix message of type "${message.type}" to room "${input.config.roomId}": ${details}`
      );
    }
  }
}

/*
 * Future pipeline wiring:
 *
 * const supportProcessingOutput = await runSupportProcessingPipeline(input);
 *
 * await sendMatrixMessages({
 *   config,
 *   messages: mapUserResponseToMatrixMessages(
 *     supportProcessingOutput.userResponse
 *   )
 * });
 */

export {
  mapMatrixIncomingMessageToLatestUserMessage,
  mapUserResponseToMatrixMessages,
  sendMatrixMessages
};
