import {
  buildLiveMemoryConversationKey
} from "./buildLiveMemoryConversationKey";
import {
  buildLiveMemoryContextFromTurn
} from "./buildLiveMemoryContextFromTurn";
import {
  readLiveMemoryContext,
  writeLiveMemoryContext
} from "./liveMemoryContextStore";

import type {
  MatrixDeliveryResult
} from "../../channels/matrix/typesMatrixChannel.types";
import type {
  SupportAutomationTurnV2Result
} from "../../orchestration/runSupportAutomationTurnV2";
import type {
  LiveMemoryContext
} from "./typesLiveMemoryContext.types";

async function upsertLiveMemoryContext(input: {
  identity: {
    channel: "matrix" | "twake_chat";
    roomId: string;
    threadId: string | null;
    userId: string;
  };
  supportAutomationTurnResult: SupportAutomationTurnV2Result;
  matrixDeliveryResults: MatrixDeliveryResult[];
}): Promise<LiveMemoryContext> {
  const conversationKey = buildLiveMemoryConversationKey(input.identity);
  const previousContext = await readLiveMemoryContext(conversationKey);
  const context = buildLiveMemoryContextFromTurn({
    previousContext,
    supportAutomationTurnResult: input.supportAutomationTurnResult,
    matrixDeliveryResults: input.matrixDeliveryResults
  });

  await writeLiveMemoryContext(conversationKey, context);

  return context;
}

export {
  upsertLiveMemoryContext
};
