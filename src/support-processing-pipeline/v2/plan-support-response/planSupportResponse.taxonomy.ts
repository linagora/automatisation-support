const RESPONSE_STRATEGY_VALUES = [
  "single_response",
  "multi_part_response",
  "multiple_messages",
  "human_review_needed"
] as const;

const RESPONSE_MODE_VALUES = [
  "answer_support_request",
  "ask_clarifying_questions",
  "confirm_information_received",
  "provide_next_steps",
  "acknowledge_and_wait",
  "handover_or_escalation",
  "mixed"
] as const;

const PLANNED_MESSAGE_ROLE_VALUES = [
  "support_answer",
  "clarification_request",
  "standard_acknowledgement",
  "handover_response",
  "follow_up",
  "safety_or_boundary"
] as const;

const KNOWLEDGE_STATUS_VALUES = [
  "no_knowledge_needed",
  "knowledge_missing",
  "knowledge_available",
  "rag_not_enabled"
] as const;

const QUESTION_PRIORITY_VALUES = [
  "high",
  "medium",
  "low"
] as const;

export {
  KNOWLEDGE_STATUS_VALUES,
  PLANNED_MESSAGE_ROLE_VALUES,
  QUESTION_PRIORITY_VALUES,
  RESPONSE_MODE_VALUES,
  RESPONSE_STRATEGY_VALUES
};
