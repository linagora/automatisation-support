import * as path from "path";

import { JsonFileStore } from "./jsonFileStore";

import type {
  JsonTicket
} from "./typesJsonRepositories.types";
import type {
  CompactInteractionLog,
  ConversationHistory
} from "../../support-processing-pipeline/typesSupportProcessingPipeline.types";

type ConversationHistoryMetadata = {
  conversationHistoryCompactInteractionLogs?: CompactInteractionLog[];
  conversationHistoryContextLLM?: string;
};

function hasCompactInteractionLogs(
  value: unknown
): value is CompactInteractionLog[] {
  return (
    Array.isArray(value) &&
    value.every((item) => {
      return (
        typeof item === "object" &&
        item !== null &&
        typeof (item as { id?: unknown }).id === "string" &&
        typeof (item as { created_at?: unknown }).created_at === "string" &&
        typeof (item as { line?: unknown }).line === "string"
      );
    })
  );
}

class JsonTicketRepository {
  private readonly store: JsonFileStore<JsonTicket>;

  constructor(filePath = path.resolve("data/tickets.json")) {
    this.store = new JsonFileStore<JsonTicket>(filePath);
  }

  async findActiveByRoomAndUser(
    roomId: string,
    userId: string
  ): Promise<JsonTicket | undefined> {
    const tickets = await this.store.readAll();
    const ticket = tickets.find((candidate) => {
      return (
        candidate.roomId === roomId &&
        candidate.userId === userId &&
        candidate.status === "active"
      );
    });

    return ticket ? this.hydrateConversationHistory(ticket) : undefined;
  }

  async findById(ticketId: string): Promise<JsonTicket | undefined> {
    const tickets = await this.store.readAll();
    const ticket = tickets.find((candidate) => {
      return (
        candidate.ticketId === ticketId
      );
    });

    return ticket ? this.hydrateConversationHistory(ticket) : undefined;
  }

  async findByRoomId(roomId: string): Promise<JsonTicket[]> {
    const tickets = await this.store.readAll();

    return tickets
      .filter((ticket) => {
        return ticket.roomId === roomId;
      })
      .map((ticket) => {
        return this.hydrateConversationHistory(ticket);
      });
  }

  async upsert(ticket: JsonTicket): Promise<JsonTicket> {
    const serializableTicket = this.toSerializableTicket(ticket);
    const tickets = await this.store.readAll();
    const existingTicketIndex = tickets.findIndex((candidate) => {
      return candidate.ticketId === serializableTicket.ticketId;
    });

    if (existingTicketIndex === -1) {
      await this.store.writeAll([...tickets, serializableTicket]);
      return ticket;
    }

    const updatedTickets = [...tickets];
    updatedTickets[existingTicketIndex] = serializableTicket;
    await this.store.writeAll(updatedTickets);

    return ticket;
  }

  async list(): Promise<JsonTicket[]> {
    const tickets = await this.store.readAll();

    return tickets.map((ticket) => {
      return this.hydrateConversationHistory(ticket);
    });
  }

  private hydrateConversationHistory(ticket: JsonTicket): JsonTicket {
    const metadata = ticket.metadata as ConversationHistoryMetadata | undefined;
    const compactInteractionLogs =
      ticket.conversationHistory.compactInteractionLogs ??
      metadata?.conversationHistoryCompactInteractionLogs;
    const contextLLM =
      ticket.conversationHistory.contextLLM ??
      metadata?.conversationHistoryContextLLM;

    if (!compactInteractionLogs && !contextLLM) {
      return ticket;
    }

    return {
      ...ticket,
      conversationHistory: Object.assign(
        [...ticket.conversationHistory],
        {
          ...(compactInteractionLogs ? { compactInteractionLogs } : {}),
          ...(contextLLM ? { contextLLM } : {})
        }
      ) as ConversationHistory
    };
  }

  private toSerializableTicket(ticket: JsonTicket): JsonTicket {
    const metadata = ticket.metadata as ConversationHistoryMetadata | undefined;
    const compactInteractionLogs =
      ticket.conversationHistory.compactInteractionLogs ??
      metadata?.conversationHistoryCompactInteractionLogs;
    const contextLLM =
      ticket.conversationHistory.contextLLM ??
      metadata?.conversationHistoryContextLLM;
    const conversationHistoryMetadata = {
      ...(hasCompactInteractionLogs(compactInteractionLogs)
        ? { conversationHistoryCompactInteractionLogs: compactInteractionLogs }
        : {}),
      ...(typeof contextLLM === "string" && contextLLM.trim() !== ""
        ? { conversationHistoryContextLLM: contextLLM }
        : {})
    };
    const serializedMetadata = {
      ...ticket.metadata,
      ...conversationHistoryMetadata
    };
    const shouldSerializeMetadata =
      Object.keys(serializedMetadata).length > 0;

    return {
      ...ticket,
      ...(shouldSerializeMetadata ? { metadata: serializedMetadata } : {})
    };
  }
}

export {
  JsonTicketRepository
};
