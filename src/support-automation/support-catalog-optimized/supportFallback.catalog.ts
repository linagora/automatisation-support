const commonLlmFallbackReason = {
  llmCallFailed: "llm_call_failed",
  missingLlmContent: "missing_llm_content",
  invalidLlmOutput: "invalid_llm_output"
} as const;

const textSurfaceFallbackReason = {
  emptyMessage: "empty_message",
  invalidSegmentCoverage: "invalid_segment_coverage",
  ...commonLlmFallbackReason
} as const;

const supportTextFallbackReason = {
  llmCallFailed: "llm_call_failed",
  missingLlmContent: "missing_llm_content",
  invalidLlmOutput: "invalid_llm_output"
} as const;

const topicUpdateFallbackReason = {
  llmCallFailed: "llm_call_failed",
  missingLlmContent: "missing_llm_content",
  invalidLlmOutput: "invalid_llm_output"
} as const;

const supportNeedAssessmentFallbackReason = {
  llmCallFailed: "llm_call_failed",
  missingLlmContent: "missing_llm_content",
  invalidLlmOutput: "invalid_llm_output"
} as const;

const knowledgeEnrichmentFallbackReason = {
  llmCallFailed: "llm_call_failed",
  missingLlmContent: "missing_llm_content",
  invalidLlmOutput: "invalid_llm_output"
} as const;

type CommonLlmFallbackReason =
  typeof commonLlmFallbackReason[keyof typeof commonLlmFallbackReason];

type TextSurfaceFallbackReason =
  typeof textSurfaceFallbackReason[keyof typeof textSurfaceFallbackReason];

type SupportTextFallbackReason =
  typeof supportTextFallbackReason[keyof typeof supportTextFallbackReason];

type TopicUpdateFallbackReason =
  typeof topicUpdateFallbackReason[keyof typeof topicUpdateFallbackReason];

type SupportNeedAssessmentFallbackReason =
  typeof supportNeedAssessmentFallbackReason[keyof typeof supportNeedAssessmentFallbackReason];

type KnowledgeEnrichmentFallbackReason =
  typeof knowledgeEnrichmentFallbackReason[keyof typeof knowledgeEnrichmentFallbackReason];

export {
  commonLlmFallbackReason,
  knowledgeEnrichmentFallbackReason,
  supportNeedAssessmentFallbackReason,
  supportTextFallbackReason,
  topicUpdateFallbackReason,
  textSurfaceFallbackReason
};

export type {
  CommonLlmFallbackReason,
  KnowledgeEnrichmentFallbackReason,
  SupportNeedAssessmentFallbackReason,
  SupportTextFallbackReason,
  TopicUpdateFallbackReason,
  TextSurfaceFallbackReason
};
