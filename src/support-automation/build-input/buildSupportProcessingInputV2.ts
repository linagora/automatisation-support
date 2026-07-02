import {
  buildDefaultAccountInteractionTraits,
  buildDefaultAccountProfile,
  buildDefaultAccountTrustStatus,
  buildLatestUserMessageFromBufferedMessages
} from "../../archive/orchestration/buildSupportProcessingInput";
import {
  convertLiveMemoryContextToSupportTopicContextV2
} from "./convertLiveMemoryContextToSupportTopicContextV2";

import type {
  BufferedMessages,
  MessagingAttachment,
  MessagingEvent
} from "../buffer/typesMessaging.types";
import type {
  LiveMemoryContext
} from "../../infrastructure/live-memory/typesLiveMemoryContext.types";
import type {
  SupportTurnIdentityV2
} from "./buildSupportTurnIdentityV2";
import type {
  LatestUserAttachment,
  SupportProcessingPipelineV2Input
} from "../support-processing-pipeline-v2/typesSupportProcessingPipelineV2.types";
import type {
  ConversationHistory
} from "../support-processing-pipeline-v2/typesConversationContext.types";
import type {
  SupportTopicContextV2
} from "../support-processing-pipeline-v2/topic-context/typesSupportTopicContextV2.types";

const MAX_RECENT_SUMMARY_LENGTH = 500;
const EMPTY_PREVIOUS_USER_MESSAGE_SUMMARY =
  "No relevant previous user message.";
const EMPTY_PREVIOUS_BOT_RESPONSE_SUMMARY =
  "No relevant previous bot response.";

type BuildSupportProcessingInputV2Options = {
  liveMemoryContext?: LiveMemoryContext | null;
};

type BuildSupportProcessingInputV2Params = {
  bufferedMessages: BufferedMessages;
  turnIdentity: SupportTurnIdentityV2;
  liveMemoryContext?: LiveMemoryContext | null;
};

function truncateSummary(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= MAX_RECENT_SUMMARY_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_RECENT_SUMMARY_LENGTH - 3)}...`;
}

function buildEmptyRecentInteractionContext():
  SupportProcessingPipelineV2Input["recentInteractionContext"] {
  return {
    previousUserMessageSummary: EMPTY_PREVIOUS_USER_MESSAGE_SUMMARY,
    previousBotResponseSummary: EMPTY_PREVIOUS_BOT_RESPONSE_SUMMARY,
    previousBotQuestionFieldNames: []
  };
}

function buildEmptySupportTopicContextV2(): SupportTopicContextV2 {
  return {
    topics: []
  };
}

function buildEmptyConversationHistoryV2(): ConversationHistory {
  return [] as ConversationHistory;
}

function buildRecentInteractionContextFromLiveMemoryContext(
  liveMemoryContext: LiveMemoryContext
): SupportProcessingPipelineV2Input["recentInteractionContext"] {
  return {
    previousUserMessageSummary: liveMemoryContext.lastUserVerbatim
      ? truncateSummary(liveMemoryContext.lastUserVerbatim)
      : EMPTY_PREVIOUS_USER_MESSAGE_SUMMARY,
    previousBotResponseSummary: liveMemoryContext.lastBotVerbatim
      ? truncateSummary(liveMemoryContext.lastBotVerbatim)
      : EMPTY_PREVIOUS_BOT_RESPONSE_SUMMARY,
    previousBotQuestionFieldNames: []
  };
}

function canConvertAttachment(
  attachment: MessagingAttachment
): attachment is MessagingAttachment & {
  filename: string;
} {
  const sizeInBytes = attachment.sizeInBytes ?? attachment.sizeBytes;

  return (
    typeof attachment.filename === "string" &&
    attachment.filename.trim() !== "" &&
    typeof sizeInBytes === "number" &&
    Number.isFinite(sizeInBytes)
  );
}

function toLatestUserMessageChannel(
  channel: MessagingEvent["channel"]
): SupportProcessingPipelineV2Input["latestUserMessage"]["channel"] {
  if (channel === "matrix" || channel === "twake_chat") {
    return "twake_chat";
  }

  return "other";
}

function toLatestUserAttachmentsFromMessage(
  message: MessagingEvent
): LatestUserAttachment[] {
  return (message.attachments ?? []).flatMap((attachment) => {
    if (!canConvertAttachment(attachment)) {
      return [];
    }

    const sizeInBytes = attachment.sizeInBytes ?? attachment.sizeBytes;

    if (sizeInBytes === undefined) {
      return [];
    }

    return [
      {
        id: attachment.id,
        filename: attachment.filename,
        name: attachment.filename,
        sizeInBytes,
        sizeBytes: sizeInBytes,
        ...(attachment.accessUrl ? { accessUrl: attachment.accessUrl } : {}),
        ...(attachment.url ? { url: attachment.url } : {}),
        ...(attachment.path ? { path: attachment.path } : {}),
        ...(attachment.mimeType ? { mimeType: attachment.mimeType } : {}),
        ...(attachment.kind ? { type: attachment.kind } : {}),
        channel: toLatestUserMessageChannel(message.channel),
        sentAt: message.createdAt
      }
    ];
  });
}

function toLatestUserAttachments(
  messages: MessagingEvent[]
): LatestUserAttachment[] {
  return messages.flatMap(toLatestUserAttachmentsFromMessage);
}

function buildSupportProcessingInputV2(
  params: BuildSupportProcessingInputV2Params,
  options: BuildSupportProcessingInputV2Options = {}
): SupportProcessingPipelineV2Input {
  const liveMemoryContext =
    params.liveMemoryContext ?? options.liveMemoryContext ?? null;

  return {
    latestUserMessage: buildLatestUserMessageFromBufferedMessages(
      params.bufferedMessages.messages
    ),
    latestUserAttachments: toLatestUserAttachments(params.bufferedMessages.messages),
    accountTrustStatus: buildDefaultAccountTrustStatus(),
    accountProfile: buildDefaultAccountProfile(params.turnIdentity.userId),
    accountInteractionTraits: buildDefaultAccountInteractionTraits(),
    supportTopicKnowledge: liveMemoryContext
      ? convertLiveMemoryContextToSupportTopicContextV2(liveMemoryContext)
      : buildEmptySupportTopicContextV2(),
    conversationHistory: buildEmptyConversationHistoryV2(),
    conversationScope: {
      channel: params.turnIdentity.channel,
      roomId: params.turnIdentity.roomId,
      threadId: params.turnIdentity.threadId,
      userId: params.turnIdentity.userId
    },
    recentInteractionContext: liveMemoryContext
      ? buildRecentInteractionContextFromLiveMemoryContext(liveMemoryContext)
      : buildEmptyRecentInteractionContext()
  };
}

export {
  buildEmptyConversationHistoryV2,
  buildEmptyRecentInteractionContext,
  buildEmptySupportTopicContextV2,
  buildRecentInteractionContextFromLiveMemoryContext,
  buildSupportProcessingInputV2
};

export type {
  BuildSupportProcessingInputV2Params,
  BuildSupportProcessingInputV2Options
};
