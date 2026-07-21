import {callLLM} from "../../../../infrastructure/llm/llm-client";
import {parseLLMResponse} from "../../../../infrastructure/llm/parseLLMResponse";
import {supportNeedAssessmentFallbackReason} from "../../../support-catalog-optimized/supportFallback.catalog";
import {buildAssessSupportNeedPrompt} from "./buildAssessSupportNeedPrompt";
import {responseFormat} from "./responseFormat";
import {validateAssessSupportNeedOutput} from "./validateAssessSupportNeedOutput";

import type {SupportNeedAssessmentFallbackReason} from "../../../support-catalog-optimized/supportFallback.catalog";
import type {AnalyzeSupportTextUnderstanding} from "../../analyze-support-text-optimized/runAnalyzeSupportText";
import type {RecentInteractionContext} from "../../../support-processing-pipeline-v2/typesSupportProcessingPipelineV2.types";
import type {SupportNeedAssessment} from "./validateAssessSupportNeedOutput";

type AssessSupportNeedInput = {
  topic: {
    title: string | null;
    supportDomain: string | null;
    summary: string;
    previousSupportNeedAssessment: SupportNeedAssessment | null;
    previousSupportKnowledgeSummary: string | null;
    sourceUnderstandings: AnalyzeSupportTextUnderstanding[];
  };
  recentInteractionContext: RecentInteractionContext;
};

type AssessSupportNeedAnalyzedOutput = {
  status: "analyzed";
  fallbackReason: null;
  supportNeedAssessment: SupportNeedAssessment;
};

type AssessSupportNeedFallbackOutput = {
  status: "fallback";
  fallbackReason: SupportNeedAssessmentFallbackReason;
  supportNeedAssessment: null;
};

type AssessSupportNeedOutput =
  | AssessSupportNeedAnalyzedOutput
  | AssessSupportNeedFallbackOutput;

async function runAssessSupportNeed(input: AssessSupportNeedInput): Promise<AssessSupportNeedOutput> {
  const {messages} = buildAssessSupportNeedPrompt(input);

  try {
    const result = await callLLM(messages, {
      stage: "support_need_assessment",
      preset: "standard",
      temperature: 0,
      maxTokens: 500,
      responseFormat
    });

    if (!result.success) {
      return buildFallbackOutput(supportNeedAssessmentFallbackReason.llmCallFailed);
    }

    if (!result.content || result.content.trim() === "") {
      return buildFallbackOutput(supportNeedAssessmentFallbackReason.missingLlmContent);
    }

    const parsedResponse = parseLLMResponse(result.content);

    if (!parsedResponse) {
      return buildFallbackOutput(supportNeedAssessmentFallbackReason.invalidLlmOutput);
    }

    const supportNeedAssessment = validateAssessSupportNeedOutput(parsedResponse);

    if (!supportNeedAssessment) {
      return buildFallbackOutput(supportNeedAssessmentFallbackReason.invalidLlmOutput);
    }

    return {
      status: "analyzed",
      fallbackReason: null,
      supportNeedAssessment
    };
  } catch {
    return buildFallbackOutput(supportNeedAssessmentFallbackReason.llmCallFailed);
  }
}

function buildFallbackOutput(
  reason: SupportNeedAssessmentFallbackReason
): AssessSupportNeedFallbackOutput {
  return {
    status: "fallback",
    fallbackReason: reason,
    supportNeedAssessment: null
  };
}

export {runAssessSupportNeed};

export type {
  AssessSupportNeedAnalyzedOutput,
  AssessSupportNeedFallbackOutput,
  AssessSupportNeedInput,
  AssessSupportNeedOutput
};
