import type {
  ComposeSupportResponsePlanInput,
  ComposedSupportResponsePlan
} from "../typesSupportProcessingPipelineV2.types";
import type {
  LLMMessage
} from "../../../llm/llm-client";

export type ComposeSupportResponsePlanPrompt = {
  messages: LLMMessage[];
};

export type BuildComposeSupportResponsePlanPromptInput =
  ComposeSupportResponsePlanInput;

export type RequestComposeSupportResponsePlanInput = {
  prompt: ComposeSupportResponsePlanPrompt;
};

export type RawComposeSupportResponsePlan = {
  status: "completed" | "failed";
  parsedResponse?: unknown;
  rawResponse?: string;
  error?: {
    message: string;
  };
};

export type FormatComposeSupportResponsePlanOutputInput = {
  input: ComposeSupportResponsePlanInput;
  rawComposeSupportResponsePlan: RawComposeSupportResponsePlan;
};

export type FormatComposeSupportResponsePlanOutput = {
  composedSupportResponsePlan: ComposedSupportResponsePlan;
  validation: {
    status: "valid" | "fallback";
    reason?: string;
  };
};

export type {
  ComposeSupportResponsePlanInput,
  ComposedSupportResponsePlan
};
