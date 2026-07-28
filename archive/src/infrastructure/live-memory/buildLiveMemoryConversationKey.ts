type BuildLiveMemoryConversationKeyInput = {
  channel: "matrix" | "twake_chat" | string;
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
  const parts = input.threadId
    ? [input.channel, input.roomId, input.threadId]
    : [input.channel, input.roomId, input.userId];

  const key = parts
    .map(sanitizeKeyPart)
    .filter((part) => part !== "")
    .join("_");

  return key || "conversation";
}

export {
  buildLiveMemoryConversationKey
};

export type {
  BuildLiveMemoryConversationKeyInput
};
