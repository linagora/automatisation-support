import type {
  MessagingAttachment,
  MessagingEvent
} from "../../messaging/typesMessaging.types";
import type {
  MatrixTextEvent
} from "./typesMatrixChannel.types";

const SUPPORTED_MESSAGE_TYPES = new Set([
  "m.text",
  "m.image",
  "m.file"
]);

function isSupportedMatrixMessageEvent(event: unknown): event is MatrixTextEvent {
  if (typeof event !== "object" || event === null) {
    return false;
  }

  const candidate = event as MatrixTextEvent;

  return (
    candidate.type === "m.room.message" &&
    typeof candidate.content?.msgtype === "string" &&
    SUPPORTED_MESSAGE_TYPES.has(candidate.content.msgtype)
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

function toNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return value;
}

function getBody(event: MatrixTextEvent): string {
  return typeof event.content?.body === "string"
    ? event.content.body.trim()
    : "";
}

function getThreadId(event: MatrixTextEvent): string | undefined {
  const relation = event.content?.["m.relates_to"];

  if (
    relation?.rel_type === "m.thread" &&
    typeof relation.event_id === "string" &&
    relation.event_id.trim() !== ""
  ) {
    return relation.event_id;
  }

  return undefined;
}

function getReplyToMessageId(event: MatrixTextEvent): string | undefined {
  const eventId =
    event.content?.["m.relates_to"]?.["m.in_reply_to"]?.event_id;

  return typeof eventId === "string" && eventId.trim() !== ""
    ? eventId
    : undefined;
}

function buildMatrixAttachment(event: MatrixTextEvent): MessagingAttachment | undefined {
  const msgtype = event.content?.msgtype;
  const matrixMxcUrl =
    typeof event.content?.url === "string" ? event.content.url : undefined;

  if (msgtype !== "m.image" && msgtype !== "m.file") {
    return undefined;
  }

  if (!event.event_id || !matrixMxcUrl) {
    return undefined;
  }

  const body = getBody(event);
  const filename =
    typeof event.content?.filename === "string" &&
    event.content.filename.trim() !== ""
      ? event.content.filename.trim()
      : body;
  const mimeType =
    typeof event.content?.info?.mimetype === "string"
      ? event.content.info.mimetype
      : undefined;
  const sizeInBytes = toNumber(event.content?.info?.size);
  const width = toNumber(event.content?.info?.w);
  const height = toNumber(event.content?.info?.h);

  return {
    id: `${event.event_id}:attachment`,
    ...(filename ? { filename } : {}),
    ...(mimeType ? { mimeType } : {}),
    ...(sizeInBytes !== undefined
      ? {
          sizeInBytes,
          sizeBytes: sizeInBytes
        }
      : {}),
    matrixMxcUrl,
    url: matrixMxcUrl,
    kind: msgtype === "m.image" ? "image" : "other",
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    rawAttachment: event.content,
    rawEvent: event
  };
}

function mapMatrixEventToMessagingEvent(params: {
  roomId: string;
  event: unknown;
}): MessagingEvent | undefined {
  if (!isSupportedMatrixMessageEvent(params.event)) {
    return undefined;
  }

  const body = getBody(params.event);
  const attachment = buildMatrixAttachment(params.event);
  const attachments = attachment ? [attachment] : [];

  if (
    params.event.event_id === undefined ||
    params.event.sender === undefined ||
    (body === "" && attachments.length === 0)
  ) {
    return undefined;
  }

  if (attachments.length > 0) {
    console.log({
      eventName: "matrix.attachment.mapped",
      roomId: params.roomId,
      eventId: params.event.event_id,
      attachmentCount: attachments.length,
      msgtype: params.event.content?.msgtype
    });
  }

  return {
    channel: "matrix",
    roomId: params.roomId,
    userId: params.event.sender,
    messageId: params.event.event_id,
    ...(getThreadId(params.event)
      ? { threadId: getThreadId(params.event) }
      : {}),
    ...(getReplyToMessageId(params.event)
      ? { replyToMessageId: getReplyToMessageId(params.event) }
      : {}),
    ...(params.event.content?.msgtype === "m.text" && body !== ""
      ? { content: body }
      : {}),
    ...(attachments.length > 0 ? { attachments } : {}),
    createdAt: getCreatedAt(params.event),
    rawEvent: params.event
  };
}

export {
  mapMatrixEventToMessagingEvent
};
