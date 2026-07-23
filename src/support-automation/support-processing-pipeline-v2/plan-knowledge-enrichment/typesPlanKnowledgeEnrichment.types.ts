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
import type {
  StrictBroadIntentMode
} from "../../support-catalog-LEGACY";

export type KnowledgeEnrichmentRoute =
  | "none"
  | "catalog_only"
  | "rag_only"
  | "catalog_and_rag";

export type BroadIntentMode = StrictBroadIntentMode;

export type RagRetrievalMode = "answer" | "answer_and_soft_probe" | null;

export type BroadIntentDecision = {
  mode: BroadIntentMode;
  reason: string;
};

export type RagRetrievalDecision = {
  shouldRetrieve: boolean;
  mode: RagRetrievalMode;
  reason: string;
};

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
  broadIntent?: unknown;
  rag?: unknown;
};

export type KnowledgeEnrichmentDecision = {
  broadIntent: BroadIntentDecision;
  rag: RagRetrievalDecision;
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
