import type {
  MessagingEvent
} from "../../messaging/typesMessaging.types";
import type {
  MatrixTextEvent
} from "./typesMatrixChannel.types";

function isMatrixTextEvent(event: unknown): event is MatrixTextEvent {
  if (typeof event !== "object" || event === null) {
    return false;
  }

  const candidate = event as MatrixTextEvent;

  return (
    candidate.type === "m.room.message" &&
    candidate.content?.msgtype === "m.text"
  );
}

function getCreatedAt(event: MatrixTextEvent): string {
  if (
    typeof event.origin_server_ts === "number" &&
    Number.isFinite(event.origin_server_ts)
  ) {
    return new Date(event.origin_server_ts).toISOString();
  }

  return new Date().toISOString();
}

function mapMatrixEventToMessagingEvent(params: {
  roomId: string;
  event: unknown;
}): MessagingEvent | undefined {
  if (!isMatrixTextEvent(params.event)) {
    return undefined;
  }

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
    channel: "matrix",
    roomId: params.roomId,
    userId: params.event.sender,
    messageId: params.event.event_id,
    content: body,
    createdAt: getCreatedAt(params.event),
    rawEvent: params.event
  };
}

export {
  mapMatrixEventToMessagingEvent
};
