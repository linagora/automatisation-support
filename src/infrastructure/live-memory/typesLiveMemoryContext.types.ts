import type {
  SupportKnowledgeSummary,
  SupportAttemptedAction,
  SupportCaseDetail
} from "../../support-automation/support-processing-pipeline-v2-LEGACY/typesSupportProcessingPipelineV2.types";
import type {
  SupportCaseDetailFieldName
} from "../../archive/support-catalog-LEGACY";

export type LiveMemoryUserState = {
  status: "normal" | "watch" | "blocked";
  flags: string[];
};

export type LiveMemoryTopic = {
  /** Stable per-conversation id. First topic is 1, next create is max + 1. */
  topicId: number;
  title: string | null;
  broadCategoryHint: string | null;
  summary: string | null;
  caseDetails: SupportCaseDetail[];
  attemptedActions: SupportAttemptedAction[];
  supportKnowledgeSummary?: SupportKnowledgeSummary;
  unansweredRequestedFieldNames?: SupportCaseDetailFieldName[];
};

export type LiveMemoryContext = {
  topics: LiveMemoryTopic[];
  lastUserVerbatim: string | null;
  lastBotVerbatim: string | null;
  userState: LiveMemoryUserState;
};
