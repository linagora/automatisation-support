import type {
  MessagingChannel
} from "../../messaging/typesMessaging.types";

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

function buildLiveMemoryConversationKey(
  input: BuildLiveMemoryConversationKeyInput
): string {
  return [
    input.channel,
    input.roomId,
    input.threadId ?? "no_thread",
    input.userId
  ]
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
