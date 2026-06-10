import type {
  MessagingAttachment,
  MessagingChannel,
  MessagingEvent
} from "../messaging/typesMessaging.types";
import type {
  MatchingResult
} from "../matching/typesMatching.types";
import type {
  AccountInteractionTraits,
  AccountProfile,
  AccountTrustStatus,
  ConversationHistory,
  LatestUserAttachment,
  LatestUserMessage,
  SupportProcessingPipelineInput,
  SupportTopicKnowledge
} from "../support-processing-pipeline/typesSupportProcessingPipeline.types";

function buildDefaultAccountTrustStatus(): AccountTrustStatus {
  return {
    status: "neutral",
    reasons: ["default_missing_user"]
  };
}

function buildDefaultAccountProfile(userId: string): AccountProfile {
  void userId;

  return {
    accountType: "individual",
    actualPlan: "free",
    paymentStatus: "unknown",
    planHistory: [],
    createdAt: "1970-01-01T00:00:00.000Z",
    daysSinceCreation: 0
  };
}

function buildDefaultAccountInteractionTraits(): AccountInteractionTraits {
  return {
    labels: [],
    lastUpdatedAt: "1970-01-01T00:00:00.000Z"
  };
}

function buildEmptySupportTopicKnowledge(): SupportTopicKnowledge {
  return {
    segments_topic: []
  };
}

function buildEmptyConversationHistory(): ConversationHistory {
  return [] as ConversationHistory;
}

function toLatestUserMessageChannel(
  channel: MessagingChannel
): LatestUserMessage["channel"] {
  if (channel === "matrix" || channel === "twake_chat") {
    return "twake_chat";
  }

  return "other";
}

function hasNonEmptyTextContent(message: MessagingEvent): boolean {
  return typeof message.content === "string" && message.content.trim() !== "";
}

function sortMessagesByCreatedAt(messages: MessagingEvent[]): MessagingEvent[] {
  return [...messages].sort((firstMessage, secondMessage) => {
    return firstMessage.createdAt.localeCompare(secondMessage.createdAt);
  });
}

function mergeMessageContents(messages: MessagingEvent[]): string {
  return messages
    .filter(hasNonEmptyTextContent)
    .map((message) => {
      return message.content?.trim() ?? "";
    })
    .join("\n\n");
}

function toLatestUserMessage(params: {
  messages: MessagingEvent[];
  latestMessage: MessagingEvent;
}): LatestUserMessage {
  // LatestUserMessage has no metadata/sourceMessageIds field today.
  // Keep the latest buffered message as the canonical source id/timestamp.
  return {
    id: params.latestMessage.messageId,
    content: mergeMessageContents(params.messages),
    channel: toLatestUserMessageChannel(params.latestMessage.channel),
    sentAt: params.latestMessage.createdAt
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

function toLatestUserAttachmentsFromMessage(
  message: MessagingEvent
): LatestUserAttachment[] {
  return (message.attachments ?? []).flatMap((attachment) => {
    if (!canConvertAttachment(attachment)) {
      // TODO: enrich MessagingAttachment metadata before supporting partial
      // attachment conversion in orchestration.
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

function buildLatestUserMessageFromBufferedMessages(
  messages: MessagingEvent[]
): LatestUserMessage {
  const sortedMessages = sortMessagesByCreatedAt(messages);
  const latestMessage = sortedMessages.at(-1);

  if (!latestMessage) {
    throw new Error("Cannot build SupportProcessingPipelineInput from empty messages");
  }

  return toLatestUserMessage({
    messages: sortedMessages,
    latestMessage
  });
}

function buildSupportProcessingInput(
  matchingResult: MatchingResult
): SupportProcessingPipelineInput {
  const sortedMessages = sortMessagesByCreatedAt(matchingResult.messages);

  return {
    latestUserMessage:
      buildLatestUserMessageFromBufferedMessages(sortedMessages),
    latestUserAttachments: toLatestUserAttachments(sortedMessages),
    accountTrustStatus:
      matchingResult.user?.accountTrustStatus ?? buildDefaultAccountTrustStatus(),
    accountProfile:
      matchingResult.user?.accountProfile ??
      buildDefaultAccountProfile(matchingResult.userId),
    accountInteractionTraits:
      matchingResult.user?.accountInteractionTraits ??
      buildDefaultAccountInteractionTraits(),
    supportTopicKnowledge:
      matchingResult.ticket?.supportTopicKnowledge ??
      buildEmptySupportTopicKnowledge(),
    conversationHistory:
      matchingResult.ticket?.conversationHistory ??
      buildEmptyConversationHistory()
  };
}

export {
  buildDefaultAccountInteractionTraits,
  buildDefaultAccountProfile,
  buildDefaultAccountTrustStatus,
  buildLatestUserMessageFromBufferedMessages,
  buildEmptyConversationHistory,
  buildEmptySupportTopicKnowledge,
  buildSupportProcessingInput
};
