import { createMatrixClient } from "./matrixClient";

import type {
  DeliveryMessage
} from "../../orchestration/typesOrchestration.types";
import type {
  MatrixChannelConfig,
  MatrixDeliveryResult
} from "./typesMatrixChannel.types";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown Matrix send error";
}

function resolveRoomId(params: {
  config: MatrixChannelConfig;
  message: DeliveryMessage;
}): string | undefined {
  const messageRoomId = params.message.roomId.trim();

  if (messageRoomId !== "") {
    return messageRoomId;
  }

  return params.config.defaultRoomId;
}

function getOrCreateResultForRoom(params: {
  resultsByRoomId: Map<string, MatrixDeliveryResult>;
  roomId: string;
}): MatrixDeliveryResult {
  const existingResult = params.resultsByRoomId.get(params.roomId);

  if (existingResult !== undefined) {
    return existingResult;
  }

  const result: MatrixDeliveryResult = {
    channel: "matrix",
    roomId: params.roomId,
    deliveredMessages: [],
    failedMessages: []
  };

  params.resultsByRoomId.set(params.roomId, result);

  return result;
}

async function sendMatrixDeliveryMessages(params: {
  config: MatrixChannelConfig;
  messages: DeliveryMessage[];
}): Promise<MatrixDeliveryResult[]> {
  const client = createMatrixClient(params.config);
  const resultsByRoomId = new Map<string, MatrixDeliveryResult>();

  for (const message of params.messages) {
    if (message.content.trim() === "") {
      continue;
    }

    const roomId = resolveRoomId({
      config: params.config,
      message
    });

    if (roomId === undefined) {
      const fallbackRoomId = "__missing_room__";
      const result = getOrCreateResultForRoom({
        resultsByRoomId,
        roomId: fallbackRoomId
      });

      result.failedMessages.push({
        localId: message.localId,
        content: message.content,
        error: "Missing Matrix roomId and no defaultRoomId configured"
      });
      continue;
    }

    const result = getOrCreateResultForRoom({
      resultsByRoomId,
      roomId
    });

    try {
      const providerMessageId = await client.sendText(roomId, message.content);

      result.deliveredMessages.push({
        localId: message.localId,
        ...(providerMessageId ? { providerMessageId } : {}),
        content: message.content,
        deliveredAt: new Date().toISOString()
      });
    } catch (error) {
      result.failedMessages.push({
        localId: message.localId,
        content: message.content,
        error: getErrorMessage(error)
      });
    }
  }

  return Array.from(resultsByRoomId.values());
}

export {
  sendMatrixDeliveryMessages
};
