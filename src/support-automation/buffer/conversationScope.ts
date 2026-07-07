import type {
  BufferedMessages,
  MessagingChannel,
  MessagingEvent
} from "./typesMessaging.types";

export type ConversationScopeKey = {
  channel: MessagingChannel;
  roomId: string;
  threadId: string | null;
  userId: string;
};

function normalizeThreadId(threadId: string | null | undefined): string | null {
  if (typeof threadId !== "string") {
    return null;
  }

  const normalizedThreadId = threadId.trim();

  return normalizedThreadId === "" ? null : normalizedThreadId;
}

export function buildConversationScopeKey(params: {
  channel: MessagingChannel;
  roomId: string;
  threadId?: string | null;
  userId: string;
}): ConversationScopeKey {
  return {
    channel: params.channel,
    roomId: params.roomId,
    threadId: normalizeThreadId(params.threadId),
    userId: params.userId
  };
}

export function getMessageConversationScope(
  message: MessagingEvent
): ConversationScopeKey {
  return buildConversationScopeKey(message);
}

export function getBufferedMessagesConversationScope(
  bufferedMessages: BufferedMessages
): ConversationScopeKey {
  return buildConversationScopeKey({
    channel: bufferedMessages.channel,
    roomId: bufferedMessages.roomId,
    threadId:
      bufferedMessages.threadId ??
      bufferedMessages.messages[0]?.threadId,
    userId: bufferedMessages.userId
  });
}

export function serializeConversationScopeKey(
  scope: ConversationScopeKey
): string {
  return JSON.stringify([
    scope.channel,
    scope.roomId,
    scope.threadId,
    scope.userId
  ]);
}
