import type {
  MatchingResult
} from "../matching/typesMatching.types";
import type {
  DeliveryMessage
} from "../orchestration/typesOrchestration.types";
import type {
  ConversationHistory,
  SupportProcessingPipelineOutput
} from "../support-processing-pipeline/typesSupportProcessingPipeline.types";

function buildConversationHistoryId(prefix: string, messageIds: string[]): string {
  return `${prefix}_${messageIds.join("_") || "none"}`;
}

function buildConversationHistoryMessageId(messageIds: string[]): string {
  return messageIds.join(",");
}

function buildConversationHistoryEvents(params: {
  matchingResult: MatchingResult;
  supportProcessingOutput: SupportProcessingPipelineOutput;
  deliveryMessages: DeliveryMessage[];
  storedIncomingMessageIds: string[];
  storedOutgoingMessageIds: string[];
}): ConversationHistory {
  void params.deliveryMessages;

  const turnUnderstandingDelta =
    params.supportProcessingOutput.patches.analysisPatch.turnUnderstandingDelta;
  const responsePlan =
    params.supportProcessingOutput.patches.responsePatch.responsePlan;
  const generatedAt =
    params.supportProcessingOutput.patches.metadataPatch.generatedAt;
  const userMessageCreatedAt =
    params.matchingResult.messages.at(-1)?.createdAt ?? generatedAt;

  return [
    {
      id: buildConversationHistoryId(
        "history_user",
        params.storedIncomingMessageIds
      ),
      message_id: buildConversationHistoryMessageId(
        params.storedIncomingMessageIds
      ),
      created_at: userMessageCreatedAt,
      role: "user",
      turnUnderstandingDelta
    },
    {
      id: buildConversationHistoryId(
        "history_bot",
        params.storedOutgoingMessageIds
      ),
      message_id: buildConversationHistoryMessageId(
        params.storedOutgoingMessageIds
      ),
      created_at: generatedAt,
      role: "bot",
      responsePlan
    }
  ] as ConversationHistory;
}

export {
  buildConversationHistoryEvents
};
