export type SupportTopicContextCaseDetailV2 = {
  key: string;
  value: string | number | boolean | null;
  evidence: string;
};

export type SupportTopicContextAttemptedActionV2 = {
  action: string;
  outcome: "success" | "failed" | "partial" | "unknown";
  evidence: string;
};

export type SupportTopicContextTopicV2 = {
  topicId: number;
  title: string | null;
  broadCategoryHint: string | null;
  summary: string | null;
  caseDetails: SupportTopicContextCaseDetailV2[];
  attemptedActions: SupportTopicContextAttemptedActionV2[];
  supportKnowledgeSummary: string | null;
};

export type SupportTopicContextV2 = {
  topics: SupportTopicContextTopicV2[];
};
