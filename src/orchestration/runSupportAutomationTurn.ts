import { matchBufferedMessages } from "../matching/matchBufferedMessages";
import { applySupportPatches } from "../persistence/applySupportPatches";
import { JsonMessageRepository } from "../repositories/json/jsonMessageRepository";
import { JsonTicketRepository } from "../repositories/json/jsonTicketRepository";
import { JsonUserRepository } from "../repositories/json/jsonUserRepository";
import { runSupportProcessingPipeline } from "../support-processing-pipeline/runSupportProcessingPipeline";
import { buildSupportProcessingInput } from "./buildSupportProcessingInput";
import { mapUserResponseToDelivery } from "./mapUserResponseToDelivery";

import type {
  BufferedMessages
} from "../messaging/typesMessaging.types";
import type {
  SupportProcessingPipelineInput,
  SupportProcessingPipelineSteps
} from "../support-processing-pipeline/typesSupportProcessingPipeline.types";
import type {
  SupportAutomationTurnResult
} from "./typesOrchestration.types";

type SupportInputContextSummary = {
  roomId: string;
  userId: string;
  ticketId?: string;
  hasTicket: boolean;
  supportTopicCount: number;
  supportTopicSummaries: {
    id_topic: number;
    matched_historical_topic: "not_stored";
    topic_category?: string;
    type?: string;
    summary?: string;
    has_topic_details: boolean;
    has_user_goal: boolean;
    has_blocking_issue: boolean;
  }[];
  conversationHistoryLength: number;
  attachmentsCount: number;
  latestUserMessagePreview: string;
};

function truncateForLog(value: string, maxLength = 160): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function buildTopicSummary(
  topic: SupportProcessingPipelineInput["supportTopicKnowledge"]["segments_topic"][number]
): SupportInputContextSummary["supportTopicSummaries"][number] {
  const summaryParts = [
    topic.topic_label,
    topic.tool_or_product,
    topic.topic_action,
    topic.topic_object
  ].filter((value): value is string => {
    return typeof value === "string" && value.trim() !== "";
  });

  return {
    id_topic: topic.id_topic,
    matched_historical_topic: "not_stored",
    ...(topic.topic_category
      ? {
          topic_category: topic.topic_category,
          type: topic.topic_category
        }
      : {}),
    ...(summaryParts.length > 0
      ? { summary: truncateForLog(summaryParts.join(" : "), 120) }
      : {}),
    has_topic_details: Object.keys(topic.topic_details ?? {}).length > 0,
    has_user_goal: typeof topic.user_goal === "string" &&
      topic.user_goal.trim() !== "",
    has_blocking_issue: typeof topic.blocking_issue === "string" &&
      topic.blocking_issue.trim() !== ""
  };
}

function buildSupportInputContextSummary(params: {
  roomId: string;
  userId: string;
  ticketId?: string;
  supportProcessingInput: SupportProcessingPipelineInput;
}): SupportInputContextSummary {
  const supportTopics =
    params.supportProcessingInput.supportTopicKnowledge.segments_topic;

  return {
    roomId: params.roomId,
    userId: params.userId,
    ...(params.ticketId ? { ticketId: params.ticketId } : {}),
    hasTicket: params.ticketId !== undefined,
    supportTopicCount: supportTopics.length,
    supportTopicSummaries: supportTopics.map(buildTopicSummary),
    conversationHistoryLength:
      params.supportProcessingInput.conversationHistory.length,
    attachmentsCount: params.supportProcessingInput.latestUserAttachments.length,
    latestUserMessagePreview: truncateForLog(
      params.supportProcessingInput.latestUserMessage.content
    )
  };
}

async function runSupportAutomationTurn(params: {
  bufferedMessages: BufferedMessages;
  ticketRepository: JsonTicketRepository;
  userRepository: JsonUserRepository;
  messageRepository: JsonMessageRepository;
  steps?: SupportProcessingPipelineSteps;
}): Promise<SupportAutomationTurnResult> {
  const matchingResult = await matchBufferedMessages({
    bufferedMessages: params.bufferedMessages,
    ticketRepository: params.ticketRepository,
    userRepository: params.userRepository
  });

  const supportProcessingInput = buildSupportProcessingInput(matchingResult);
  console.log({
    eventName: "support.input.context_summary",
    context_summary: buildSupportInputContextSummary({
      roomId: matchingResult.roomId,
      userId: matchingResult.userId,
      ...(matchingResult.ticket?.ticketId
        ? { ticketId: matchingResult.ticket.ticketId }
        : {}),
      supportProcessingInput
    })
  });
  console.log({
    eventName: "support.input.attachments_count",
    attachments_count: supportProcessingInput.latestUserAttachments.length
  });
  const supportProcessingOutput = await runSupportProcessingPipeline(
    supportProcessingInput,
    params.steps
  );
  const deliveryMessages = mapUserResponseToDelivery({
    userResponse: supportProcessingOutput.userResponse,
    matchingResult
  });
  const persistenceResult = await applySupportPatches({
    matchingResult,
    supportProcessingOutput,
    deliveryMessages,
    ticketRepository: params.ticketRepository,
    userRepository: params.userRepository,
    messageRepository: params.messageRepository
  });

  return {
    matchingResult,
    supportProcessingInput,
    supportProcessingOutput,
    deliveryMessages,
    persistenceResult
  };
}

export {
  buildSupportInputContextSummary,
  runSupportAutomationTurn
};
