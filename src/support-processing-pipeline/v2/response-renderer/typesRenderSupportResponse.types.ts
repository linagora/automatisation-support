import type {
  ComposedSupportResponsePlan,
  RenderSupportResponseInput
} from "../typesSupportProcessingPipelineV2.types";
import type {
  LLMMessage
} from "../../../llm/llm-client";

export type RenderSupportResponsePrompt = {
  messages: LLMMessage[];
};

export type BuildRenderSupportResponsePromptInput = {
  composedSupportResponsePlan: ComposedSupportResponsePlan;
  targetLanguage?: string;
  channel?: string;
};

export type RequestRenderSupportResponseInput = {
  prompt: RenderSupportResponsePrompt;
};

export type RawRenderSupportResponse = {
  status: "completed" | "failed";
  parsedResponse?: unknown;
  rawResponse?: string;
  error?: {
    message: string;
  };
};

export type RawRenderedSupportResponse = {
  finalResponseText?: unknown;
};

export type RenderedSupportResponse = {
  finalResponseText: string;
};

export type FormatRenderSupportResponseOutputInput = {
  input: RenderSupportResponseInput;
  rawRenderSupportResponse: RawRenderSupportResponse;
};

export type FormatRenderSupportResponseOutput = {
  renderedResponse: RenderedSupportResponse;
  validation: {
    status: "valid" | "fallback";
    reason?: string;
  };
};

export type {
  ComposedSupportResponsePlan,
  RenderSupportResponseInput
};
