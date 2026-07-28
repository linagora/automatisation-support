import {callLLM} from "../../../infrastructure/llm/llm-client";
import {parseLLMResponse} from "../../../infrastructure/llm/parseLLMResponse";
import {supportNeedAssessmentFallbackReason} from "../../../support-catalog-optimized/supportFallback.catalog";
import {buildAssessSupportNeedPrompt} from "./buildAssessSupportNeedPrompt";
import {responseFormat} from "./responseFormat";
import {validateAssessSupportNeedOutput} from "./validateAssessSupportNeedOutput";

import type {SupportNeedAssessmentFallbackReason} from "../../../support-catalog-optimized/supportFallback.catalog";
import type {AnalyzeSupportTextUnderstanding} from "../../analyze-support-text-optimized/runAnalyzeSupportText";
import type {TopicUpdatePlan} from "../../propose-topic-updates-optimized/runProposeTopicUpdates";
import type {LiveMemoryTopicOptimized} from "../../../infrastructure/live-memory/liveMemoryContextOptimized.template";
import type {SupportNeedAssessment} from "./validateAssessSupportNeedOutput";

type CurrentUserMessage = {
  content: string;
  channel?: string;
};

type PreviousConversationTurn = {
  previousUserMessage: string | null;
  previousBotMessage: string | null;
};

type RunSupportNeedResolutionInput = {
  topicUpdatePlan: TopicUpdatePlan;
  currentTopic: LiveMemoryTopicOptimized | null;
  sourceUnderstandings: AnalyzeSupportTextUnderstanding[];
  currentUserMessage: CurrentUserMessage;
  previousConversationTurn: PreviousConversationTurn;
};

type AssessSupportNeedInput = {
  topic: {
    title: string | null;
    summaryTopic: string | null;
    supportDomain: {
      value: string | null;
      reason: string | null;
    };
    previousSupportNeedResolution:
      | LiveMemoryTopicOptimized["sourceTopicManager"]["supportNeedResolution"]
      | null;
    sourceUnderstandings: AnalyzeSupportTextUnderstanding[];
  };
  currentUserMessage: CurrentUserMessage;
  previousConversationTurn: PreviousConversationTurn;
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

type RunSupportNeedResolutionProcessedOutput = {
  status: "processed";
  fallbackReason: null;
  supportNeedResolution: LiveMemoryTopicOptimized["sourceTopicManager"]["supportNeedResolution"];
  internalOutputs: {
    assessSupportNeedOutput: AssessSupportNeedOutput;
  };
};

type RunSupportNeedResolutionFallbackOutput = {
  status: "fallback";
  fallbackReason: unknown;
  supportNeedResolution: null;
  internalOutputs: {
    assessSupportNeedOutput: AssessSupportNeedOutput | null;
  };
};

type RunSupportNeedResolutionOutput =
  | RunSupportNeedResolutionProcessedOutput
  | RunSupportNeedResolutionFallbackOutput;

async function runSupportNeedResolution(
  input: RunSupportNeedResolutionInput
): Promise<RunSupportNeedResolutionOutput> {
  const assessSupportNeedInput = buildAssessSupportNeedInput(input);
  const assessSupportNeedOutput = await assessSupportNeedWithLlm(assessSupportNeedInput);

  if (assessSupportNeedOutput.status === "fallback") {
    return {
      status: "fallback",
      fallbackReason: assessSupportNeedOutput,
      supportNeedResolution: null,
      internalOutputs: {
        assessSupportNeedOutput
      }
    };
  }

  return {
    status: "processed",
    fallbackReason: null,
    supportNeedResolution: {
      supportNeed: {
        value: assessSupportNeedOutput.supportNeedAssessment.supportNeed,
        reason: buildSupportNeedReason(assessSupportNeedOutput.supportNeedAssessment)
      }
    },
    internalOutputs: {
      assessSupportNeedOutput
    }
  };
}

function buildAssessSupportNeedInput(
  input: RunSupportNeedResolutionInput
): AssessSupportNeedInput {
  return {
    topic: {
      title: input.topicUpdatePlan.title,
      summaryTopic: input.topicUpdatePlan.summaryTopic,
      supportDomain: input.topicUpdatePlan.supportDomain,
      previousSupportNeedResolution:
        input.currentTopic?.sourceTopicManager.supportNeedResolution ?? null,
      sourceUnderstandings: input.sourceUnderstandings
    },
    currentUserMessage: input.currentUserMessage,
    previousConversationTurn: input.previousConversationTurn
  };
}

async function assessSupportNeedWithLlm(
  input: AssessSupportNeedInput
): Promise<AssessSupportNeedOutput> {
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
      return buildAssessSupportNeedFallbackOutput(supportNeedAssessmentFallbackReason.llmCallFailed);
    }

    if (!result.content || result.content.trim() === "") {
      return buildAssessSupportNeedFallbackOutput(supportNeedAssessmentFallbackReason.missingLlmContent);
    }

    const parsedResponse = parseLLMResponse(result.content);

    if (!parsedResponse) {
      return buildAssessSupportNeedFallbackOutput(supportNeedAssessmentFallbackReason.invalidLlmOutput);
    }

    const supportNeedAssessment = validateAssessSupportNeedOutput(parsedResponse);

    if (!supportNeedAssessment) {
      return buildAssessSupportNeedFallbackOutput(supportNeedAssessmentFallbackReason.invalidLlmOutput);
    }

    return {
      status: "analyzed",
      fallbackReason: null,
      supportNeedAssessment
    };
  } catch {
    return buildAssessSupportNeedFallbackOutput(supportNeedAssessmentFallbackReason.llmCallFailed);
  }
}

function buildAssessSupportNeedFallbackOutput(
  reason: SupportNeedAssessmentFallbackReason
): AssessSupportNeedFallbackOutput {
  return {
    status: "fallback",
    fallbackReason: reason,
    supportNeedAssessment: null
  };
}

function buildSupportNeedReason(assessment: SupportNeedAssessment): string | null {
  if (assessment.supportNeed === "unclear" && assessment.unclearReason) {
    return `${assessment.reason} Unclear reason: ${assessment.unclearReason}.`;
  }

  return assessment.reason;
}

export {runSupportNeedResolution};

export type {
  AssessSupportNeedAnalyzedOutput,
  AssessSupportNeedFallbackOutput,
  AssessSupportNeedInput,
  AssessSupportNeedOutput,
  RunSupportNeedResolutionInput,
  RunSupportNeedResolutionOutput
};
