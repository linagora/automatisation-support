import type {
  MatchingResult
} from "../matching/typesMatching.types";
import type {
  DeliveryMessage
} from "../orchestration/typesOrchestration.types";
import {
  applyTurnUnderstandingDeltaToTicket
} from "./applyTurnUnderstandingDeltaToTicket";
import {
  buildConversationHistoryEvents
} from "./buildConversationHistoryEvents";
import {
  buildCompactInteractionLogsFromTurn
} from "./buildCompactInteractionLogsFromTurn";
import type {
  JsonMessageRepository
} from "../repositories/json/jsonMessageRepository";
import type {
  JsonTicketRepository
} from "../repositories/json/jsonTicketRepository";
import type {
  JsonUserRepository
} from "../repositories/json/jsonUserRepository";
import type {
  JsonStoredMessage,
  JsonTicket
} from "../repositories/json/typesJsonRepositories.types";
import type {
  CompactInteractionLog,
  ConversationHistory,
  SupportProcessingPipelineOutput,
  TurnUnderstandingDelta
} from "../support-processing-pipeline/typesSupportProcessingPipeline.types";
import type {
  PersistenceResult
} from "./typesPersistence.types";

function resolvePatchTimestamp(
  supportProcessingOutput: SupportProcessingPipelineOutput,
  matchingResult: MatchingResult
): string {
  return (
    supportProcessingOutput.patches.metadataPatch.generatedAt ??
    matchingResult.messages.at(-1)?.createdAt ??
    new Date().toISOString()
  );
}

function mapIncomingMessage(params: {
  matchingResult: MatchingResult;
  messageIndex: number;
  ticketId?: string;
}): JsonStoredMessage {
  const message = params.matchingResult.messages[params.messageIndex];

  return {
    messageId: message.messageId,
    channel: message.channel,
    roomId: message.roomId,
    userId: message.userId,
    ...(params.ticketId ? { ticketId: params.ticketId } : {}),
    direction: "incoming",
    ...(message.content ? { content: message.content } : {}),
    ...(message.attachments ? { attachments: message.attachments } : {}),
    providerMessageId: message.messageId,
    createdAt: message.createdAt,
    metadata: {
      source: "support-automation-turn",
      ...(message.threadId ? { threadId: message.threadId } : {}),
      ...(message.replyToMessageId
        ? { replyToMessageId: message.replyToMessageId }
        : {})
    }
  };
}

function mapOutgoingMessage(params: {
  deliveryMessage: DeliveryMessage;
  ticketId?: string;
  createdAt: string;
}): JsonStoredMessage {
  return {
    messageId: params.deliveryMessage.localId,
    channel: params.deliveryMessage.channel,
    roomId: params.deliveryMessage.roomId,
    userId: params.deliveryMessage.userId,
    ...(params.ticketId ? { ticketId: params.ticketId } : {}),
    direction: "outgoing",
    content: params.deliveryMessage.content,
    providerMessageId: params.deliveryMessage.localId,
    createdAt: params.createdAt,
    metadata: {
      source: "support-automation-turn",
      ...params.deliveryMessage.metadata
    }
  };
}

function shouldCreateTicketFromDelta(
  turnUnderstandingDelta: TurnUnderstandingDelta
): boolean {
  return (
    turnUnderstandingDelta.segments_topic.length > 0 ||
    turnUnderstandingDelta.segments_lack_comprehension.length > 0 ||
    turnUnderstandingDelta.segments_suspicious.length > 0
  );
}

function sanitizeTicketIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function buildGeneratedTicketId(params: {
  matchingResult: MatchingResult;
  generatedAt: string;
}): string {
  return [
    "ticket",
    sanitizeTicketIdPart(params.matchingResult.roomId),
    sanitizeTicketIdPart(params.matchingResult.userId),
    sanitizeTicketIdPart(params.generatedAt)
  ].join("_");
}

function buildNewTicket(params: {
  matchingResult: MatchingResult;
  generatedAt: string;
}): JsonTicket {
  return {
    ticketId: buildGeneratedTicketId(params),
    roomId: params.matchingResult.roomId,
    userId: params.matchingResult.userId,
    status: "active",
    supportTopicKnowledge: {
      segments_topic: []
    },
    conversationHistory: [],
    metadata: {
      createdFrom: "support-processing-pipeline-patches",
      channel: params.matchingResult.channel
    },
    createdAt: params.generatedAt,
    updatedAt: params.generatedAt
  };
}

function buildConversationHistoryWithCompactContext(params: {
  existingConversationHistory: ConversationHistory;
  conversationHistoryEvents: ConversationHistory;
  compactInteractionLogs: CompactInteractionLog[];
}): ConversationHistory {
  const compactInteractionLogs = [
    ...(params.existingConversationHistory.compactInteractionLogs ?? []),
    ...params.compactInteractionLogs
  ].slice(-50);
  const contextLLM =
    compactInteractionLogs.length > 0
      ? compactInteractionLogs
          .slice(-20)
          .map((log) => log.line)
          .join("\n")
      : params.existingConversationHistory.contextLLM;

  return Object.assign(
    [
      ...params.existingConversationHistory,
      ...params.conversationHistoryEvents
    ],
    {
      ...(compactInteractionLogs.length > 0 ? { compactInteractionLogs } : {}),
      ...(contextLLM ? { contextLLM } : {})
    }
  ) as ConversationHistory;
}

async function applySupportPatches(params: {
  matchingResult: MatchingResult;
  supportProcessingOutput: SupportProcessingPipelineOutput;
  deliveryMessages: DeliveryMessage[];
  ticketRepository: JsonTicketRepository;
  userRepository: JsonUserRepository;
  messageRepository: JsonMessageRepository;
}): Promise<PersistenceResult> {
  const warnings: string[] = [];
  const storedIncomingMessageIds: string[] = [];
  const storedOutgoingMessageIds: string[] = [];
  const patchTimestamp = resolvePatchTimestamp(
    params.supportProcessingOutput,
    params.matchingResult
  );
  const turnUnderstandingDelta =
    params.supportProcessingOutput.patches.analysisPatch.turnUnderstandingDelta;
  let targetTicket = params.matchingResult.ticket;
  let ticketCreated = false;

  if (
    targetTicket === undefined &&
    shouldCreateTicketFromDelta(turnUnderstandingDelta)
  ) {
    targetTicket = buildNewTicket({
      matchingResult: params.matchingResult,
      generatedAt: patchTimestamp
    });
    ticketCreated = true;
  }

  if (targetTicket === undefined) {
    warnings.push("no useful ticket knowledge; ticket not created");
  }

  const targetTicketId = targetTicket?.ticketId;

  for (const [messageIndex] of params.matchingResult.messages.entries()) {
    const storedMessage = await params.messageRepository.append(
      mapIncomingMessage({
        matchingResult: params.matchingResult,
        messageIndex,
        ...(targetTicketId ? { ticketId: targetTicketId } : {})
      })
    );

    storedIncomingMessageIds.push(storedMessage.messageId);
  }

  for (const deliveryMessage of params.deliveryMessages) {
    const storedMessage = await params.messageRepository.append(
      mapOutgoingMessage({
        deliveryMessage,
        ...(targetTicketId ? { ticketId: targetTicketId } : {}),
        createdAt: patchTimestamp
      })
    );

    storedOutgoingMessageIds.push(storedMessage.messageId);
  }

  let updatedTicketId: string | undefined;
  let updatedUserId: string | undefined;

  if (targetTicket) {
    const conversationHistoryEvents = buildConversationHistoryEvents({
      matchingResult: params.matchingResult,
      supportProcessingOutput: params.supportProcessingOutput,
      deliveryMessages: params.deliveryMessages,
      storedIncomingMessageIds,
      storedOutgoingMessageIds
    });
    const compactInteractionLogs = buildCompactInteractionLogsFromTurn({
      turnUnderstandingDelta,
      responsePlan:
        params.supportProcessingOutput.patches.responsePatch.responsePlan,
      generatedAt: patchTimestamp,
      sourceEventIds: conversationHistoryEvents.map((event) => {
        return event.id;
      })
    });
    const ticketWithTopicKnowledge = applyTurnUnderstandingDeltaToTicket({
      ticket: targetTicket,
      turnUnderstandingDelta,
      generatedAt: patchTimestamp
    });

    await params.ticketRepository.upsert({
      ...ticketWithTopicKnowledge,
      conversationHistory: buildConversationHistoryWithCompactContext({
        existingConversationHistory: ticketWithTopicKnowledge.conversationHistory,
        conversationHistoryEvents,
        compactInteractionLogs
      }) as JsonTicket["conversationHistory"],
      metadata: {
        ...ticketWithTopicKnowledge.metadata,
        lastSupportProcessingPatches: params.supportProcessingOutput.patches,
        lastSecurityGateSummary:
          params.supportProcessingOutput.patches.securityPatch
            .securityGateSummary,
        lastResponsePlan:
          params.supportProcessingOutput.patches.responsePatch.responsePlan,
        lastPatchGeneratedAt: patchTimestamp
      },
      updatedAt: patchTimestamp
    });
    updatedTicketId = targetTicket.ticketId;
  }

  if (params.matchingResult.user) {
    const user = params.matchingResult.user;

    await params.userRepository.upsert({
      ...user,
      metadata: {
        ...user.metadata,
        lastSupportProcessingMetadataPatch:
          params.supportProcessingOutput.patches.metadataPatch
      },
      updatedAt: patchTimestamp
    });
    updatedUserId = user.userId;
  } else {
    warnings.push("user patch skipped because no matched user");
  }

  const hasPersistedPatch =
    targetTicket !== undefined || params.matchingResult.user !== undefined;

  return {
    ...(updatedTicketId ? { updatedTicketId } : {}),
    ...(updatedUserId ? { updatedUserId } : {}),
    ...(ticketCreated ? { ticketCreated } : {}),
    storedIncomingMessageIds,
    storedOutgoingMessageIds,
    patchStatus: hasPersistedPatch ? "applied" : "skipped",
    warnings
  };
}

export {
  applySupportPatches
};
