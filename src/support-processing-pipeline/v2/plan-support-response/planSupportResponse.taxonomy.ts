const KNOWLEDGE_MODE_VALUES = [
  "knowledge_available",
  "knowledge_missing",
  "rag_not_enabled"
] as const;

const ALLOWED_RESPONSE_MOVE_VALUES = [
  "acknowledge",
  "ask_missing_fields",
  "answer_with_knowledge",
  "standard_acknowledgement",
  "handover_acknowledgement",
  "safety_or_boundary"
] as const;

export {
  ALLOWED_RESPONSE_MOVE_VALUES,
  KNOWLEDGE_MODE_VALUES
};
