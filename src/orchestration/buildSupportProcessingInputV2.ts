import {
  buildSupportProcessingInput
} from "./buildSupportProcessingInput";
import {
  buildConversationScopeKey
} from "../messaging/conversationScope";

import type {
  MatchingResult
} from "../matching/typesMatching.types";
import type {
  SupportProcessingPipelineV2Input
} from "../support-processing-pipeline/v2/typesSupportProcessingPipelineV2.types";
import type {
  ConversationHistory
} from "../support-processing-pipeline/typesSupportProcessingPipeline.types";

const MAX_RECENT_SUMMARY_LENGTH = 500;

type ResponsePlanWithV2Metadata = {
  metadata?: {
    v2ResponsePlan?: unknown;
  };
};

function truncateSummary(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= MAX_RECENT_SUMMARY_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_RECENT_SUMMARY_LENGTH - 3)}...`;
}

function findLatestEventByRole(
  conversationHistory: ConversationHistory,
  role: "user" | "bot"
): ConversationHistory[number] | undefined {
  return [...conversationHistory].reverse().find((event) => {
    return event.role === role;
  });
}

function buildSummaryFromCompactLogs(params: {
  conversationHistory: ConversationHistory;
  eventId: string;
  role: "user" | "bot";
}): string | undefined {
  const prefix = params.role === "user" ? "User(" : "Bot(";
  const lines = (params.conversationHistory.compactInteractionLogs ?? [])
    .filter((log) => {
      return (
        log.line.startsWith(prefix) &&
        log.source_event_ids?.includes(params.eventId) === true
      );
    })
    .slice(-4)
    .map((log) => log.line);

  return lines.length > 0 ? truncateSummary(lines.join(" ")) : undefined;
}

function buildUserEventFallbackSummary(
  event: Extract<ConversationHistory[number], { role: "user" }>
): string | undefined {
  const topicSummaries = event.turnUnderstandingDelta.segments_topic.flatMap(
    (topic) => {
      const verbatim = topic.segment_verbatims?.find((value) => {
        return value.trim() !== "";
      });

      return verbatim
        ? [verbatim]
        : [topic.topic_label, topic.user_goal].filter(
            (value): value is string => {
              return typeof value === "string" && value.trim() !== "";
            }
          );
    }
  );

  return topicSummaries.length > 0
    ? truncateSummary(topicSummaries.slice(-2).join(" "))
    : undefined;
}

function buildRecentEventSummary(params: {
  conversationHistory: ConversationHistory;
  role: "user" | "bot";
}): string | undefined {
  const event = findLatestEventByRole(
    params.conversationHistory,
    params.role
  );

  if (!event) {
    return undefined;
  }

  if (event.summary?.trim()) {
    return truncateSummary(event.summary);
  }

  const compactSummary = buildSummaryFromCompactLogs({
    conversationHistory: params.conversationHistory,
    eventId: event.id,
    role: params.role
  });

  if (compactSummary) {
    return compactSummary;
  }

  return event.role === "user"
    ? buildUserEventFallbackSummary(event)
    : undefined;
}

function buildRecentInteractionContext(
  matchingResult: MatchingResult
): SupportProcessingPipelineV2Input["recentInteractionContext"] {
  const conversationHistory = matchingResult.ticket?.conversationHistory;
  const previousBotEvent = conversationHistory
    ? findLatestEventByRole(conversationHistory, "bot")
    : undefined;
  const previousUserMessageSummary = conversationHistory
    ? buildRecentEventSummary({
        conversationHistory,
        role: "user"
      })
    : undefined;
  const previousBotResponseSummary = conversationHistory
    ? buildRecentEventSummary({
        conversationHistory,
        role: "bot"
      })
    : undefined;
  const previousBotQuestionFieldNames =
    previousBotEvent?.role === "bot"
      ? (
          (
            previousBotEvent.responsePlan as ResponsePlanWithV2Metadata
          ).metadata?.v2ResponsePlan as
            | {
                questionDecision?: {
                  fieldNames?: unknown;
                };
              }
            | undefined
        )?.questionDecision?.fieldNames
      : undefined;
  const normalizedPreviousBotQuestionFieldNames =
    Array.isArray(previousBotQuestionFieldNames)
      ? previousBotQuestionFieldNames.filter(
          (fieldName): fieldName is string => {
            return typeof fieldName === "string" && fieldName.trim() !== "";
          }
        )
      : [];

  return {
    previousUserMessageSummary:
      previousUserMessageSummary ?? "No previous user message summary.",
    previousBotResponseSummary:
      previousBotResponseSummary ?? "No previous bot response summary.",
    ...(normalizedPreviousBotQuestionFieldNames.length > 0
      ? {
          previousBotQuestionFieldNames:
            normalizedPreviousBotQuestionFieldNames
        }
      : {})
  };
}

function buildSupportProcessingInputV2(
  matchingResult: MatchingResult
): SupportProcessingPipelineV2Input {
  const v1Input = buildSupportProcessingInput(matchingResult);

  return {
    ...v1Input,
    conversationScope: buildConversationScopeKey({
      channel: matchingResult.channel,
      roomId: matchingResult.roomId,
      threadId: matchingResult.threadId,
      userId: matchingResult.userId
    }),
    recentInteractionContext: buildRecentInteractionContext(matchingResult)
  };
}

export {
  buildRecentInteractionContext,
  buildSupportProcessingInputV2
};
