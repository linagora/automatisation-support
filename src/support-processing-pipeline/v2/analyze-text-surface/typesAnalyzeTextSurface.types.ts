import type {
  AnalyzeTextSurfaceInput,
  RecentInteractionContext,
  SurfaceCategory,
  TextSurfaceAnalysis,
  TextSurfaceStandardSubcategory,
  TurnAnalysisPlan
} from "../typesSupportProcessingPipelineV2.types";

import type {
  LLMMessage
} from "../../../llm/llm-client";

export type TextSurfaceUserLanguage = string;

export type BuildAnalyzeTextSurfacePromptInput = {
  latestUserMessageContent: string;
  turnAnalysisPlan: TurnAnalysisPlan;
  recentInteractionContext: RecentInteractionContext;
};

export type AnalyzeTextSurfacePrompt = {
  messages: LLMMessage[];
};

export type RequestTextSurfaceAnalysisInput = {
  prompt: AnalyzeTextSurfacePrompt;
};

export type RawTextSurfaceAnalysis = {
  status: "completed" | "failed";
  parsedResponse?: unknown;
  rawResponse?: string;
  error?: {
    message: string;
  };
};

export type RawTextSurfaceSegment = {
  verbatim?: unknown;
  category?: unknown;
  standardSubcategory?: unknown;
};

export type RawTextSurfaceResponse = {
  userLanguage?: unknown;
  segments?: unknown;
};

export type FormatTextSurfaceAnalysisOutputInput = {
  latestUserMessageContent: string;
  rawTextSurfaceAnalysis: RawTextSurfaceAnalysis;
};

export type TextSurfaceValidationResult =
  | {
      status: "valid";
      analysis: TextSurfaceAnalysis;
    }
  | {
      status: "invalid";
      reason: string;
    };

export type {
  AnalyzeTextSurfaceInput,
  RecentInteractionContext,
  SurfaceCategory,
  TextSurfaceAnalysis,
  TextSurfaceStandardSubcategory,
  TurnAnalysisPlan
};
