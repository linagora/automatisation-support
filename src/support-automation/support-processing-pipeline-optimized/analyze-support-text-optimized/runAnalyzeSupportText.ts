import {callLLM} from "../../../infrastructure/llm/llm-client";
import {parseLLMResponse} from "../../../infrastructure/llm/parseLLMResponse";
import {supportTextFallbackReason} from "../../support-catalog-optimized/supportFallback.catalog";
import {buildAnalyzeSupportTextPrompt} from "./buildAnalyzeSupportTextPrompt";
import {validateAnalyzeSupportTextOutput} from "./validateAnalyzeSupportTextOutput";

import type {RecentInteractionContext} from "../../support-processing-pipeline-v2/typesSupportProcessingPipelineV2.types";
import type {SupportTextFallbackReason} from "../../support-catalog-optimized/supportFallback.catalog";
import type {AnalyzeTextSurfaceSegment} from "../analyze-text-surface-optimized/runAnalyzeTextSurface";
import type {
  SupportTextSegment,
  ValidatedSupportTextUnderstanding
} from "./validateAnalyzeSupportTextOutput";

// Stage contract:
// Input: analyzed text-surface segments and recent interaction context.
// Output: local support understandings, or a structured fallback.
// Non-goals: no topic update, no diagnosis, no retrieval, no response drafting.
// Validation policy: strict JSON validation, exact evidence grounding, no hidden repair.

type AnalyzeSupportTextInput = {
  textSurfaceAnalysis: {
    segments: AnalyzeTextSurfaceSegment[];
  };
  recentInteractionContext: RecentInteractionContext;
};

type AnalyzeSupportTextUnderstanding = ValidatedSupportTextUnderstanding & {
  understandingId: string;
};

type AnalyzeSupportTextAnalyzedOutput = {
  status: "analyzed";
  fallbackReason: null;
  understandings: AnalyzeSupportTextUnderstanding[];
};

type AnalyzeSupportTextFallbackOutput = {
  status: "fallback";
  fallbackReason: SupportTextFallbackReason;
  understandings: [];
};

type AnalyzeSupportTextOutput =
  | AnalyzeSupportTextAnalyzedOutput
  | AnalyzeSupportTextFallbackOutput;

async function runAnalyzeSupportText(input: AnalyzeSupportTextInput): Promise<AnalyzeSupportTextOutput> {
  const supportSegments = selectSupportSegments(input);

  if (supportSegments.length === 0) {
    return {
      status: "analyzed",
      fallbackReason: null,
      understandings: []
    };
  }

  const {messages, responseFormat} = buildAnalyzeSupportTextPrompt({
    supportSegments,
    recentInteractionContext: input.recentInteractionContext
  });

  try {
    const result = await callLLM(messages, {
      stage: "support_text_analysis",
      preset: "fullWeightMessageAnalysis",
      temperature: 0,
      maxTokens: 2000,
      responseFormat
    });

    if (!result.success) {
      return buildFallbackOutput(supportTextFallbackReason.llmCallFailed);
    }

    if (!result.content || result.content.trim() === "") {
      return buildFallbackOutput(supportTextFallbackReason.missingLlmContent);
    }

    const parsedResponse = parseLLMResponse(result.content);

    if (!parsedResponse) {
      return buildFallbackOutput(supportTextFallbackReason.invalidLlmOutput);
    }

    const validatedUnderstandings = validateAnalyzeSupportTextOutput(parsedResponse, supportSegments);

    if (validatedUnderstandings) {
      return buildAnalyzedOutput(validatedUnderstandings);
    }

    return buildFallbackOutput(supportTextFallbackReason.invalidLlmOutput);
  } catch {
    return buildFallbackOutput(supportTextFallbackReason.llmCallFailed);
  }
}

function selectSupportSegments(input: AnalyzeSupportTextInput): SupportTextSegment[] {
  return input.textSurfaceAnalysis.segments
    .filter((segment) => segment.category === "support_relevant")
    .map(({segmentId, verbatim}) => ({segmentId, verbatim}));
}

function buildFallbackOutput(reason: SupportTextFallbackReason): AnalyzeSupportTextFallbackOutput {
  return {
    status: "fallback",
    fallbackReason: reason,
    understandings: []
  };
}

function buildAnalyzedOutput(
  understandings: ValidatedSupportTextUnderstanding[]
): AnalyzeSupportTextAnalyzedOutput {
  return {
    status: "analyzed",
    fallbackReason: null,
    understandings: understandings.map((understanding, index) => ({
      understandingId: `text_understanding_${index + 1}`,
      ...understanding
    }))
  };
}

export {runAnalyzeSupportText};

export type {
  AnalyzeSupportTextInput,
  AnalyzeSupportTextOutput,
  AnalyzeSupportTextUnderstanding
};
