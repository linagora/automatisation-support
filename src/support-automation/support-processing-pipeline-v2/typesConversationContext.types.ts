export type ConversationHistoryEventBase = {
  id: string;
  message_id: string;
  created_at: string;
  summary?: string;
};

export type UserConversationHistoryEvent = ConversationHistoryEventBase & {
  role: "user";
  turnUnderstandingDelta: unknown;
  responsePlan?: never;
};

export type BotConversationHistoryEvent = ConversationHistoryEventBase & {
  role: "bot";
  responsePlan: unknown;
  turnUnderstandingDelta?: never;
};

export type SystemConversationHistoryEvent = ConversationHistoryEventBase & {
  role: "system";
  note: string;
  turnUnderstandingDelta?: never;
  responsePlan?: never;
};

export type ConversationHistoryEvent =
  | UserConversationHistoryEvent
  | BotConversationHistoryEvent
  | SystemConversationHistoryEvent;

export type CompactInteractionLog = {
  id: string;
  created_at: string;
  line: string;
  source_event_ids?: string[];
};

// TODO: remove legacy ConversationHistory from V2 input if confirmed unused.
export type ConversationHistory = ConversationHistoryEvent[] & {
  compactInteractionLogs?: CompactInteractionLog[];
  contextLLM?: string;
};
