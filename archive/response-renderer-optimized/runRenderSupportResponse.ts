import {callLLM} from "../../../infrastructure/llm/llm-client";
import {parseLLMResponse} from "../../../infrastructure/llm/parseLLMResponse";
import {buildRenderSupportResponsePrompt} from "./buildRenderSupportResponsePrompt";
import {
  buildDeterministicRenderedSupportResponse,
  validateRenderSupportResponseOutput
} from "./validateRenderSupportResponseOutput";

import type {ComposedSupportResponsePlan} from "./buildRenderSupportResponsePrompt";

type RenderSupportResponseFallbackReason =
  | "empty_render_input"
  | "llm_call_failed"
  | "missing_llm_content"
  | "invalid_llm_output";

type RenderSupportResponseInput = {
  composedSupportResponsePlan: ComposedSupportResponsePlan;
  targetLanguage?: string;
  channel?: string;
};

type RenderSupportResponseRenderedOutput = {
  status: "rendered";
  fallbackReason: null;
  finalResponseText: string;
};

type RenderSupportResponseFallbackOutput = {
  status: "fallback";
  fallbackReason: RenderSupportResponseFallbackReason;
  finalResponseText: string;
};

type RenderSupportResponseOutput =
  | RenderSupportResponseRenderedOutput
  | RenderSupportResponseFallbackOutput;

// LLM brick contract:
// Input: one composed support response plan.
// Output: one final customer-facing response text.
// Non-goals: no support reasoning, no retrieval, no new diagnosis, no new action.
// Fallback policy: return the first safe composed say, or a generic clarification message.
async function runRenderSupportResponse(
  input: RenderSupportResponseInput
): Promise<RenderSupportResponseOutput> {
  if (!hasRenderableContent(input)) {
    return buildFallbackOutput(input, "empty_render_input");
  }

  const {messages, responseFormat} = buildRenderSupportResponsePrompt(input);

  try {
    const result = await callLLM(messages, {
      stage: "render_support_response",
      preset: "fullWeightMessageAnalysis",
      temperature: 0,
      maxTokens: 1800,
      responseFormat
    });

    if (!result.success) {
      return buildFallbackOutput(input, "llm_call_failed");
    }

    if (!result.content || result.content.trim() === "") {
      return buildFallbackOutput(input, "missing_llm_content");
    }

    const parsedResponse = parseLLMResponse(result.content);

    if (!parsedResponse) {
      return buildFallbackOutput(input, "invalid_llm_output");
    }

    const validatedOutput = validateRenderSupportResponseOutput(parsedResponse, input);

    if (!validatedOutput) {
      return buildFallbackOutput(input, "invalid_llm_output");
    }

    return {
      status: "rendered",
      fallbackReason: null,
      finalResponseText: validatedOutput.finalResponseText
    };
  } catch {
    return buildFallbackOutput(input, "llm_call_failed");
  }
}

function hasRenderableContent(input: RenderSupportResponseInput): boolean {
  return input.composedSupportResponsePlan.say.some((item) => {
    return typeof item === "string" && item.trim() !== "";
  });
}

function buildFallbackOutput(
  input: RenderSupportResponseInput,
  reason: RenderSupportResponseFallbackReason
): RenderSupportResponseFallbackOutput {
  const rendered = buildDeterministicRenderedSupportResponse(input);

  return {
    status: "fallback",
    fallbackReason: reason,
    finalResponseText: rendered.finalResponseText
  };
}

const renderSupportResponse = runRenderSupportResponse;

export {
  renderSupportResponse,
  runRenderSupportResponse
};

export type {
  ComposedSupportResponsePlan,
  RenderSupportResponseFallbackReason,
  RenderSupportResponseInput,
  RenderSupportResponseOutput
};
