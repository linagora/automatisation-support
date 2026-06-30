import {
  buildLiveMemoryConversationKey
} from "../../persistence/live-memory-context/buildLiveMemoryConversationKey";
import {
  readLiveMemoryContext
} from "../../persistence/live-memory-context/liveMemoryContextStore";

import type {
  MessagingChannel
} from "../../messaging/typesMessaging.types";
import type {
  LiveMemoryContext
} from "../../persistence/live-memory-context/typesLiveMemoryContext.types";

async function loadLiveMemoryContextForScope(input: {
  channel: Extract<MessagingChannel, "matrix" | "twake_chat">;
  roomId: string;
  threadId: string | null;
  userId: string;
}): Promise<LiveMemoryContext | null> {
  return readLiveMemoryContext(buildLiveMemoryConversationKey(input));
}

export {
  loadLiveMemoryContextForScope
};
