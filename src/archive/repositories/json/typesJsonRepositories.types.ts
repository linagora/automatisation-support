import type {
  AccountInteractionTraits,
  AccountProfile,
  AccountTrustStatus,
  ConversationHistory,
  SupportTopicKnowledge
} from "../../support-processing-pipeline/typesSupportProcessingPipeline.types";
import type {
  MessagingChannel
} from "../../../support-automation/buffer/typesMessaging.types";

export type JsonTicket = {
  ticketId: string;
  channel?: MessagingChannel;
  roomId: string;
  threadId?: string | null;
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
  threadId?: string | null;
  userId: string;
  ticketId?: string;
  direction: "incoming" | "outgoing";
  content?: string;
  attachments?: unknown[];
  providerMessageId?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export type JsonKnowledgeItem = {
  knowledgeId: string;
  title: string;
  status: "active" | "draft" | "archived";
  source: {
    type: "github_issue" | "manual" | "documentation";
    repository?: string;
    issueId?: number;
    issueTitle?: string;
    issueUrl?: string;
    labels?: string[];
  };
  scope: {
    productOrService?: string[];
    broadCategoryHints?: string[];
    supportNeeds?: string[];
    topicKeywords?: string[];
    relatedFieldNames?: string[];
  };
  knownBehavior: string[];
  expectedBehavior: string[];
  acceptanceCriteria: string[];
  safeResponseStrategy: string[];
  questionsToAskFirst: string[];
  ifUserConfirmsNotificationsEnabled?: string;
  recommendedFirstAnswer?: string;
  doNotClaim: string[];
};
