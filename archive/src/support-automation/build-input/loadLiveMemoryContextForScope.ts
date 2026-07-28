import {
  buildLiveMemoryConversationKey
} from "../../infrastructure/live-memory/buildLiveMemoryConversationKey";
import {
  readLiveMemoryContext
} from "../../infrastructure/live-memory/liveMemoryContextStore";

import type {
  MessagingChannel
} from "../buffer/typesMessaging.types";
import type {
  LiveMemoryContext
} from "../../infrastructure/live-memory/typesLiveMemoryContext.types";

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
