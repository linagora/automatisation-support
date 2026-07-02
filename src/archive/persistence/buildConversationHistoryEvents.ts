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

function buildShortSummary(values: (string | undefined)[]): string | undefined {
  const summary = values
    .filter((value): value is string => {
      return typeof value === "string" && value.trim() !== "";
    })
    .map((value) => value.trim())
    .join(" ")
    .replace(/\s+/g, " ");

  if (summary === "") {
    return undefined;
  }

  return summary.length <= 500
    ? summary
    : `${summary.slice(0, 497)}...`;
}

function buildConversationHistoryEvents(params: {
  matchingResult: MatchingResult;
  supportProcessingOutput: SupportProcessingPipelineOutput;
  deliveryMessages: DeliveryMessage[];
  storedIncomingMessageIds: string[];
  storedOutgoingMessageIds: string[];
}): ConversationHistory {
  const turnUnderstandingDelta =
    params.supportProcessingOutput.patches.analysisPatch.turnUnderstandingDelta;
  const responsePlan =
    params.supportProcessingOutput.patches.responsePatch.responsePlan;
  const generatedAt =
    params.supportProcessingOutput.patches.metadataPatch.generatedAt;
  const userMessageCreatedAt =
    params.matchingResult.messages.at(-1)?.createdAt ?? generatedAt;
  const userSummary = buildShortSummary(
    params.matchingResult.messages.map((message) => message.content)
  );
  const botSummary = buildShortSummary(
    params.deliveryMessages.map((message) => message.content)
  );

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
      ...(userSummary ? { summary: userSummary } : {}),
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
      ...(botSummary ? { summary: botSummary } : {}),
      responsePlan
    }
  ] as ConversationHistory;
}

export {
  buildConversationHistoryEvents
};
