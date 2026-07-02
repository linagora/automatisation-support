import {
  createMatrixClient
} from "./matrixClient";

import type {
  MatrixConfig,
  MatrixIncomingMessage
} from "./typesMatrix.types";

type ListenMatrixMessagesInput = {
  config: MatrixConfig;
  onMessage: (message: MatrixIncomingMessage) => Promise<void> | void;
};

type MatrixRoomMessageEvent = {
  event_id?: string;
  sender?: string;
  type?: string;
  origin_server_ts?: number;
  content?: {
    msgtype?: string;
    body?: unknown;
  };
};

function buildIncomingMessage(params: {
  roomId: string;
  event: MatrixRoomMessageEvent;
}): MatrixIncomingMessage | undefined {
  const body =
    typeof params.event.content?.body === "string"
      ? params.event.content.body.trim()
      : "";

  if (
    params.event.event_id === undefined ||
    params.event.sender === undefined ||
    body === ""
  ) {
    return undefined;
  }

  return {
    roomId: params.roomId,
    eventId: params.event.event_id,
    sender: params.event.sender,
    body,
    timestamp: params.event.origin_server_ts
  };
}

async function listenMatrixMessages(
  input: ListenMatrixMessagesInput
): Promise<void> {
  const client = createMatrixClient(input.config);
  const botUserId = await client.getUserId();

  client.on(
    "room.message",
    async (roomId: string, event: MatrixRoomMessageEvent) => {
      if (roomId !== input.config.roomId) {
        return;
      }

      if (event.sender === botUserId) {
        return;
      }

      if (event.type !== "m.room.message") {
        return;
      }

      if (event.content?.msgtype !== "m.text") {
        return;
      }

      const message = buildIncomingMessage({
        roomId,
        event
      });

      if (message === undefined) {
        return;
      }

      await input.onMessage(message);
    }
  );

  await client.start();
}

export {
  listenMatrixMessages
};

export type {
  ListenMatrixMessagesInput
};
