import type {
  SupportAttemptedAction,
  SupportCaseDetail
} from "../../support-processing-pipeline-v2/typesSupportProcessingPipelineV2.types";

export type LiveMemoryUserState = {
  status: "normal" | "watch" | "blocked";
  flags: string[];
};

export type LiveMemoryTopic = {
  topicId: string;
  title: string | null;
  broadCategoryHint: string | null;
  summary: string | null;
  caseDetails: SupportCaseDetail[];
  attemptedActions: SupportAttemptedAction[];
};

export type LiveMemoryContext = {
  topics: LiveMemoryTopic[];
  lastUserVerbatim: string | null;
  lastBotVerbatim: string | null;
  userState: LiveMemoryUserState;
};
