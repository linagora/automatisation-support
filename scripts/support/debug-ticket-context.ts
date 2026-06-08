import { JsonMessageRepository } from "../../src/repositories/json/jsonMessageRepository";
import { JsonTicketRepository } from "../../src/repositories/json/jsonTicketRepository";

import type {
  JsonStoredMessage,
  JsonTicket
} from "../../src/repositories/json/typesJsonRepositories.types";

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value || value.trim() === "") {
    throw new Error(`${name} is required`);
  }

  return value;
}

function summarizeTopic(
  topic: JsonTicket["supportTopicKnowledge"]["segments_topic"][number]
): Record<string, unknown> {
  return {
    id_topic: topic.id_topic,
    topic_category: topic.topic_category,
    topic_label: topic.topic_label,
    tool_or_product: topic.tool_or_product,
    topic_action: topic.topic_action,
    topic_object: topic.topic_object,
    topic_details: topic.topic_details,
    tested_actions: topic.tested_actions ?? [],
    user_goal: topic.user_goal,
    blocking_issue: topic.blocking_issue
  };
}

function summarizeMessage(message: JsonStoredMessage): Record<string, unknown> {
  return {
    messageId: message.messageId,
    direction: message.direction,
    ticketId: message.ticketId,
    createdAt: message.createdAt,
    content: message.content
  };
}

function chooseTicket(params: {
  tickets: JsonTicket[];
  debugUserId?: string;
}): JsonTicket | undefined {
  const activeTickets = params.tickets.filter((ticket) => {
    return ticket.status === "active";
  });

  if (params.debugUserId) {
    return activeTickets.find((ticket) => {
      return ticket.userId === params.debugUserId;
    });
  }

  return activeTickets[0];
}

async function main(): Promise<void> {
  const roomId = getRequiredEnv("MATRIX_ROOM_ID");
  const debugUserId = process.env.DEBUG_USER_ID;
  const ticketRepository = new JsonTicketRepository();
  const messageRepository = new JsonMessageRepository();
  const roomTickets = await ticketRepository.findByRoomId(roomId);
  const ticket = chooseTicket({
    tickets: roomTickets,
    ...(debugUserId ? { debugUserId } : {})
  });

  if (!ticket) {
    console.log(formatJson({
      roomId,
      ...(debugUserId ? { userId: debugUserId } : {}),
      ticketFound: false,
      activeTicketsInRoom: roomTickets.filter((candidate) => {
        return candidate.status === "active";
      }).length
    }));
    return;
  }

  const ticketMessages = await messageRepository.findByTicketId(ticket.ticketId);
  const latestMessages = ticketMessages
    .slice()
    .sort((first, second) => {
      return first.createdAt.localeCompare(second.createdAt);
    })
    .slice(-10);

  console.log(formatJson({
    roomId,
    userId: ticket.userId,
    ticketId: ticket.ticketId,
    topicCount: ticket.supportTopicKnowledge.segments_topic.length,
    topics: ticket.supportTopicKnowledge.segments_topic.map(summarizeTopic),
    conversationHistoryLength: ticket.conversationHistory.length,
    latestConversationHistoryEvents: ticket.conversationHistory.slice(-6),
    storedMessagesCount: ticketMessages.length,
    latestStoredMessages: latestMessages.map(summarizeMessage)
  }));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
