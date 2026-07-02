import {
  buildLiveMemoryContextFromTurn
} from "./buildLiveMemoryContextFromTurn";
import {
  readLiveMemoryContext,
  writeLiveMemoryContext
} from "../../infrastructure/live-memory/liveMemoryContextStore";

import type {
  MatrixDeliveryResult
} from "../../infrastructure/matrix/typesMatrixChannel.types";
import type {
  SupportAutomationTurnV2Result
} from "../../support-automation/runSupportAutomationPipelineV2";
import type {
  LiveMemoryContext
} from "../../infrastructure/live-memory/typesLiveMemoryContext.types";

/**
 * Legacy compatibility helper.
 *
 * Do not use for Matrix V2 runtime. Matrix V2 should apply
 * supportProcessingOutput.persistenceEffects.liveMemoryUpdate through
 * applyLiveMemoryUpdate, using supportAutomationTurnResult.turnIdentity.conversationKey.
 */
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
  const conversationKey = input.supportAutomationTurnResult.turnIdentity.conversationKey;
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
