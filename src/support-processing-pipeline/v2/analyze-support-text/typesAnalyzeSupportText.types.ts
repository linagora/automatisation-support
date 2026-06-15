import type {
  AnalyzeSupportTextInput,
  BroadCategoryHint,
  ContextDependency,
  ExtractableFieldDefinition,
  PrimaryUserExpectation,
  RecentInteractionContext,
  ContextualAnswer,
  SupportFact,
  SupportNeed,
  TestedAction,
  TextSurfaceAnalysis,
  TextUnderstanding,
  TextUncertainty
} from "../typesSupportProcessingPipelineV2.types";

import type {
  LLMMessage
} from "../../../llm/llm-client";

export type SupportTextSegment = TextSurfaceAnalysis["segments"][number] & {
  category: "support_relevant";
};

export type AnalyzeSupportTextPrompt = {
  messages: LLMMessage[];
};

export type BuildAnalyzeSupportTextPromptInput = {
  supportSegments: SupportTextSegment[];
  recentInteractionContext: RecentInteractionContext;
  extractableFieldCatalog: ExtractableFieldDefinition[];
};

export type RequestSupportTextAnalysisInput = {
  prompt: AnalyzeSupportTextPrompt;
};

export type RawSupportTextAnalysis = {
  status: "completed" | "failed";
  parsedResponse?: unknown;
  rawResponse?: string;
  error?: {
    message: string;
  };
};

export type RawSupportTextItem = {
  sourceSegmentId?: unknown;
  sourceVerbatims?: unknown;
  summary?: unknown;
  primaryUserExpectation?: unknown;
  explicitUserRequest?: unknown;
  supportNeeds?: unknown;
  broadCategoryHint?: unknown;
  contextDependency?: unknown;
  contextualAnswer?: unknown;
  facts?: unknown;
  testedActions?: unknown;
  uncertainties?: unknown;
};

export type RawExplicitUserRequest = {
  request?: unknown;
  evidence?: unknown;
};

export type RawContextualAnswer = {
  type?: unknown;
  value?: unknown;
  evidence?: unknown;
};

export type RawSupportFact = {
  type?: unknown;
  fieldName?: unknown;
  kind?: unknown;
  value?: unknown;
  evidence?: unknown;
  support?: unknown;
};

export type RawTextUncertainty = {
  reason?: unknown;
  detail?: unknown;
  evidence?: unknown;
};

export type RawTestedAction = {
  label?: unknown;
  outcome?: unknown;
  evidence?: unknown;
};

export type FormatSupportTextAnalysisOutputInput = {
  supportSegments: SupportTextSegment[];
  extractableFieldCatalog: ExtractableFieldDefinition[];
  rawSupportTextAnalysis: RawSupportTextAnalysis;
};

export type SupportTextValidationResult =
  | {
      status: "valid";
      textUnderstandings: TextUnderstanding[];
    }
  | {
      status: "invalid";
      reason: string;
      textUnderstandings: TextUnderstanding[];
    };

export type {
  AnalyzeSupportTextInput,
  BroadCategoryHint,
  ContextDependency,
  ExtractableFieldDefinition,
  PrimaryUserExpectation,
  RecentInteractionContext,
  ContextualAnswer,
  SupportFact,
  SupportNeed,
  TestedAction,
  TextSurfaceAnalysis,
  TextUnderstanding,
  TextUncertainty
};
