import type {
  PlanKnowledgeEnrichmentInput,
  SupportKnowledgeSummary,
  SupportAttemptedAction,
  SupportCaseDetail,
  TextUnderstanding
} from "../typesSupportProcessingPipelineV2.types";

import type {
  LLMMessage
} from "../../../infrastructure/llm/llm-client";

export type KnowledgeEnrichmentRoute =
  | "none"
  | "catalog_only"
  | "rag_only"
  | "catalog_and_rag";

export type PlanKnowledgeEnrichmentPrompt = {
  messages: LLMMessage[];
};

export type BuildPlanKnowledgeEnrichmentPromptInput = {
  input: PlanKnowledgeEnrichmentInput;
};

export type RequestKnowledgeEnrichmentPlanInput = {
  prompt: PlanKnowledgeEnrichmentPrompt;
};

export type RawKnowledgeEnrichmentPlan = {
  status: "completed" | "failed";
  parsedResponse?: unknown;
  rawResponse?: string;
  error?: {
    message: string;
  };
};

export type RawKnowledgeEnrichmentResponse = {
  route?: unknown;
  reason?: unknown;
};

export type KnowledgeEnrichmentDecision = {
  route: KnowledgeEnrichmentRoute;
  reason: string;
};

export type FormatKnowledgeEnrichmentPlanOutputInput = {
  rawKnowledgeEnrichmentPlan: RawKnowledgeEnrichmentPlan;
};

export type KnowledgeEnrichmentValidationResult =
  | {
      status: "valid";
      decision: KnowledgeEnrichmentDecision;
    }
  | {
      status: "invalid";
      reason: string;
    };

export type KnowledgeEnrichmentTaskTextUnderstanding = Pick<
  TextUnderstanding,
  | "summary"
  | "messageKinds"
  | "caseDetails"
  | "attemptedActions"
  | "supportMetadata"
  | "sourceVerbatims"
  | "broadCategoryHint"
>;

export type KnowledgeEnrichmentTask = {
  latestUserMessageContent?: string;
  targetLanguage?: string;
  recentInteractionContext?: unknown;
  topic: {
    topicId: number | null;
    title?: string | null;
    summary: string;
    broadCategoryHint?: string | null;
    supportKnowledgeSummary?: SupportKnowledgeSummary | null;
    sourceVerbatims: string[];
    caseDetails: SupportCaseDetail[];
    attemptedActions: SupportAttemptedAction[];
    relatedTextUnderstandings: KnowledgeEnrichmentTaskTextUnderstanding[];
  };
};
