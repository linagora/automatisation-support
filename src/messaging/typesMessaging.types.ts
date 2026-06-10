export type MessagingChannel = "matrix" | "twake_chat";

export type MessagingAttachment = {
  id: string;
  filename?: string;
  mimeType?: string;
  sizeInBytes?: number;
  sizeBytes?: number;
  accessUrl?: string;
  url?: string;
  path?: string;
  width?: number;
  height?: number;
  matrixMxcUrl?: string;
  kind?: "image" | "video" | "audio" | "other";
  rawAttachment?: unknown;
  rawEvent?: unknown;
};

export type MessagingEvent = {
  channel: MessagingChannel;
  roomId: string;
  userId: string;
  messageId: string;
  content?: string;
  createdAt: string;
  attachments?: MessagingAttachment[];
  threadId?: string;
  replyToMessageId?: string;
  rawEvent?: unknown;
};

export type MessagingTypingEvent = {
  channel: "matrix" | "twake_chat";
  roomId: string;
  userId: string;
  isTyping: boolean;
  updatedAt: string;
  rawEvent?: unknown;
};

export type MessagingInputEvent =
  | { kind: "message"; message: MessagingEvent }
  | { kind: "typing"; typing: MessagingTypingEvent };

export type BufferedMessages = {
  channel: MessagingChannel;
  roomId: string;
  userId: string;
  messages: MessagingEvent[];
  firstMessageAt: string;
  lastMessageAt: string;
  flushedAt: string;
};
