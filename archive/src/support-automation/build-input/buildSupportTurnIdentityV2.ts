import type {
  BufferedMessages
} from "../buffer/typesMessaging.types";

export type SupportTurnIdentityV2 = {
  channel: "matrix";
  conversationKey: string;
  roomId: string;
  threadId: string | null;
  userId: string;
};

function normalizeThreadId(threadId: string | null | undefined): string | null {
  if (typeof threadId !== "string") {
    return null;
  }

  const normalized = threadId.trim();

  return normalized === "" ? null : normalized;
}

function sanitizeConversationKeyPart(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildConversationKey(params: {
  roomId: string;
  threadId: string | null;
  userId: string;
}): string {
  const keyParts = params.threadId
    ? [params.roomId, params.threadId]
    : [params.roomId, params.userId];

  return keyParts
    .map(sanitizeConversationKeyPart)
    .filter((part) => part !== "")
    .join("_");
}

function buildSupportTurnIdentityV2(
  bufferedMessages: BufferedMessages
): SupportTurnIdentityV2 {
  if (bufferedMessages.channel !== "matrix") {
    throw new Error("Support V2 turn identity only supports Matrix buffered messages");
  }

  const threadId = normalizeThreadId(
    bufferedMessages.threadId ??
      bufferedMessages.messages[0]?.threadId
  );

  return {
    channel: "matrix",
    conversationKey: buildConversationKey({
      roomId: bufferedMessages.roomId,
      threadId,
      userId: bufferedMessages.userId
    }),
    roomId: bufferedMessages.roomId,
    threadId,
    userId: bufferedMessages.userId
  };
}

export {
  buildSupportTurnIdentityV2
};
