import type {
  AccountInteractionTraits,
  AccountProfile,
  AccountTrustStatus,
  ConversationHistory,
  SupportTopicKnowledge
} from "../../support-processing-pipeline/typesSupportProcessingPipeline.types";
import type {
  MessagingChannel
} from "../../messaging/typesMessaging.types";

export type JsonTicket = {
  ticketId: string;
  roomId: string;
  userId: string;
  status: "active" | "inactive";
  supportTopicKnowledge: SupportTopicKnowledge;
  conversationHistory: ConversationHistory;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type JsonUser = {
  userId: string;
  accountTrustStatus: AccountTrustStatus;
  accountProfile: AccountProfile;
  accountInteractionTraits: AccountInteractionTraits;
  linkedTicketIds: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type JsonStoredMessage = {
  messageId: string;
  channel: MessagingChannel;
  roomId: string;
  userId: string;
  ticketId?: string;
  direction: "incoming" | "outgoing";
  content?: string;
  attachments?: unknown[];
  providerMessageId?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};
