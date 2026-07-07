import type {
  MessagingChannel
} from "../../support-automation/buffer/typesMessaging.types";

type BuildLiveMemoryConversationKeyInput = {
  channel: Extract<MessagingChannel, "matrix" | "twake_chat">;
  roomId: string;
  threadId: string | null;
  userId: string;
};

function sanitizeKeyPart(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Legacy helper kept for older callers. It intentionally mirrors
 * buildSupportTurnIdentityV2's conversationKey semantics.
 */
function buildLiveMemoryConversationKey(
  input: BuildLiveMemoryConversationKeyInput
): string {
  const parts = input.threadId
    ? [input.roomId, input.threadId]
    : [input.roomId, input.userId];

  return parts
    .map(sanitizeKeyPart)
    .filter((part) => part !== "")
    .join("_");
}

export {
  buildLiveMemoryConversationKey
};

export type {
  BuildLiveMemoryConversationKeyInput
};
