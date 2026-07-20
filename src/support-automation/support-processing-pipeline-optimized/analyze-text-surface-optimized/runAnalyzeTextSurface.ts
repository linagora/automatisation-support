import {callLLM} from "../../../infrastructure/llm/llm-client";
import {parseLLMResponse} from "../../../infrastructure/llm/parseLLMResponse";
import {textSurfaceFallbackReason} from "../../support-catalog-optimized/supportFallback.catalog";
import {buildAnalyzeTextSurfacePrompt} from "./buildAnalyzeTextSurfacePrompt";
import {validateAnalyzeTextSurfaceOutput} from "./validateAnalyzeTextSurfaceOutput";

import type {
  RecentInteractionContext,
  TurnAnalysisPlan
} from "../typesSupportProcessingPipelineV2.types";
import type {TextSurfaceFallbackReason} from "../../support-catalog-optimized/supportFallback.catalog";
import type {
  AnalyzeTextSurfaceSegment
} from "./validateAnalyzeTextSurfaceOutput";

// Stage contract:
// Input: latest user text, recent interaction context, and security matched pattern ids.
// Output: analyzed surface routing segments, or a structured fallback status with reason.
// Non-goals: no support fact extraction, no topic update, no diagnosis, no retrieval, no response drafting.
// Validation policy: strict on output shape and selected catalog values; no LLM output repair or hidden derivation.

type AnalyzeTextSurfaceInput = {
  latestUserMessage: {content: string};
  turnAnalysisPlan: TurnAnalysisPlan;
  recentInteractionContext: RecentInteractionContext;
};

type AnalyzeTextSurfaceAnalyzedOutput = {
  status: "analyzed";
  fallbackReason: null;
  userLanguage: string;
  segments: AnalyzeTextSurfaceSegment[];
};

type AnalyzeTextSurfaceFallbackOutput = {
  status: "fallback";
  fallbackReason: TextSurfaceFallbackReason;
  userLanguage: "unknown";
  segments: [];
};

type AnalyzeTextSurfaceOutput =
  | AnalyzeTextSurfaceAnalyzedOutput
  | AnalyzeTextSurfaceFallbackOutput;

// Runs the text-surface analysis brick.
// It builds the LLM prompt, calls the LLM, parses the JSON response, validates it,
// and returns either an analyzed output or a structured fallback.
async function runAnalyzeTextSurface(input: AnalyzeTextSurfaceInput): Promise<AnalyzeTextSurfaceOutput> {
  if (input.latestUserMessage.content.trim() === "") {
    return buildFallbackOutput(textSurfaceFallbackReason.emptyMessage);
  }

  const {messages, responseFormat} = buildAnalyzeTextSurfacePrompt({
    latestUserMessageContent: input.latestUserMessage.content,
    turnAnalysisPlan: input.turnAnalysisPlan,
    recentInteractionContext: input.recentInteractionContext
  });

  try {
    // LLM call policy:
    // - stage: label for logs/traces/provider config; not business logic.
    // - preset: infrastructure model/client preset for this text-analysis task.
    // - temperature: deterministic routing.
    // - maxTokens: hard cap for the JSON response.
    // - responseFormat: JSON schema contract built by the prompt builder.
    const result = await callLLM(messages, {
      stage: "text_surface_analysis",
      preset: "standard",
      temperature: 0,
      maxTokens: 500,
      responseFormat
    });

    if (!result.success) {
      return buildFallbackOutput(textSurfaceFallbackReason.llmCallFailed);
    }

    if (!result.content || result.content.trim() === "") {
      return buildFallbackOutput(textSurfaceFallbackReason.missingLlmContent);
    }

    const parsedResponse = parseLLMResponse(result.content);

    if (!parsedResponse) {
      return buildFallbackOutput(textSurfaceFallbackReason.invalidLlmOutput);
    }

    const validatedOutput = validateAnalyzeTextSurfaceOutput(parsedResponse);

    if (validatedOutput) {
      return {
        status: "analyzed",
        fallbackReason: null,
        userLanguage: validatedOutput.userLanguage,
        segments: validatedOutput.segments
      };
    }

    return buildFallbackOutput(textSurfaceFallbackReason.invalidLlmOutput);
  } catch {
    // This brick does not repair failed or invalid LLM output.
    return buildFallbackOutput(textSurfaceFallbackReason.llmCallFailed);
  }
}

// Builds the fallback output used when the brick cannot produce a valid analysis.
// Fallbacks do not create artificial segments; the reason is carried explicitly.
function buildFallbackOutput(reason: TextSurfaceFallbackReason): AnalyzeTextSurfaceFallbackOutput {
  return {
    status: "fallback",
    fallbackReason: reason,
    userLanguage: "unknown",
    segments: []
  };
}

export {runAnalyzeTextSurface};

export type {
  AnalyzeTextSurfaceInput,
  AnalyzeTextSurfaceOutput,
  AnalyzeTextSurfaceSegment
};