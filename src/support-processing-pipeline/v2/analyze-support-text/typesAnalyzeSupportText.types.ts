import type {
  AnalyzeSupportTextInput,
  AnalyzeSupportTextOutput,
  ExtractableFieldDefinition,
  RecentInteractionContext,
  SupportMessageKind,
  SupportMetadata,
  SupportResponseCue,
  TextSurfaceAnalysis,
  TextUnderstanding
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
  sourceSegmentIds?: unknown;
  messageKinds?: unknown;
  caseDetails?: unknown;
  attemptedActions?: unknown;
  supportMetadata?: unknown;
  summary?: unknown;
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
      supportResponseCues: SupportResponseCue[];
    }
  | {
      status: "invalid";
      reason: string;
      textUnderstandings: TextUnderstanding[];
      supportResponseCues: SupportResponseCue[];
    };

export type {
  AnalyzeSupportTextInput,
  AnalyzeSupportTextOutput,
  ExtractableFieldDefinition,
  RecentInteractionContext,
  SupportMessageKind,
  SupportMetadata,
  SupportResponseCue,
  TextSurfaceAnalysis,
  TextUnderstanding
};
