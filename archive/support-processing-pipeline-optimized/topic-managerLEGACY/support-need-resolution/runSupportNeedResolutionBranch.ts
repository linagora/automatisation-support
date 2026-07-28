import {callLLM} from "../../../../infrastructure/llm/llm-client";
import {parseLLMResponse} from "../../../../infrastructure/llm/parseLLMResponse";
import {supportNeedAssessmentFallbackReason} from "../../../support-catalog-optimized/supportFallback.catalog";
import {buildAssessSupportNeedPrompt} from "./buildAssessSupportNeedPrompt";
import {responseFormat} from "./responseFormat";
import {validateAssessSupportNeedOutput} from "./validateAssessSupportNeedOutput";

import type {SupportNeedAssessmentFallbackReason} from "../../../support-catalog-optimized/supportFallback.catalog";
import type {SupportNeedResolution, SupportUnderstanding, TopicBranchInput, PreviousConversationTurn} from "../runTopicBranch";
import type {SupportNeedAssessment} from "./validateAssessSupportNeedOutput";

type AssessSupportNeedInput = {
  topic: {
    title: string | null;
    supportDomain: string | null;
    summary: string;
    previousSupportNeedAssessment: SupportNeedAssessment | null;
    previousSupportKnowledgeSummary: string | null;
    sourceUnderstandings: SupportUnderstanding[];
  };
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

type SupportNeedResolutionBranchOutput =
  | {
      status: "processed";
      fallbackReason: null;
      supportNeedResolution: SupportNeedResolution;
      internalOutputs: {
        assessSupportNeedOutput: AssessSupportNeedOutput;
      };
    }
  | {
      status: "fallback";
      fallbackReason: unknown;
      supportNeedResolution: null;
      internalOutputs: {
        assessSupportNeedOutput: AssessSupportNeedOutput | null;
      };
    };

async function runSupportNeedResolutionBranch(input: {
  topicBranchInput: TopicBranchInput;
}): Promise<SupportNeedResolutionBranchOutput> {
  const supportDomain = resolveSupportDomain(input.topicBranchInput);
  const assessSupportNeedInput = buildAssessSupportNeedInput(input.topicBranchInput, supportDomain);
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
      supportNeed: assessSupportNeedOutput.supportNeedAssessment.supportNeed,
      unclearReason: assessSupportNeedOutput.supportNeedAssessment.unclearReason,
      supportDomain,
      supportNeedIsClear: assessSupportNeedOutput.supportNeedAssessment.supportNeed !== "unclear",
      supportDomainIsClear: supportDomain !== null && supportDomain !== "other" && supportDomain !== "unknown",
      reason: assessSupportNeedOutput.supportNeedAssessment.reason
    },
    internalOutputs: {
      assessSupportNeedOutput
    }
  };
}

function buildAssessSupportNeedInput(
  topicBranchInput: TopicBranchInput,
  supportDomain: string | null
): AssessSupportNeedInput {
  return {
    topic: {
      title: topicBranchInput.topicUpdatePlan.topicIdentity.title,
      supportDomain,
      summary: resolveTopicSummary(topicBranchInput),
      previousSupportNeedAssessment: readPreviousSupportNeedAssessment(topicBranchInput),
      previousSupportKnowledgeSummary: readPreviousSupportKnowledgeSummary(topicBranchInput),
      sourceUnderstandings: topicBranchInput.sourceUnderstandings
    },
    previousConversationTurn: topicBranchInput.previousConversationTurn
  };
}

async function assessSupportNeedWithLlm(input: AssessSupportNeedInput): Promise<AssessSupportNeedOutput> {
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

function resolveSupportDomain(topicBranchInput: TopicBranchInput): string | null {
  return topicBranchInput.topicUpdatePlan.topicIdentity.supportDomain ??
    topicBranchInput.sourceUnderstandings.find((understanding) => understanding.supportDomain)?.supportDomain ??
    null;
}

function resolveTopicSummary(topicBranchInput: TopicBranchInput): string {
  return (
    topicBranchInput.topicUpdatePlan.topicIdentity.summary ??
    topicBranchInput.sourceUnderstandings.map((understanding) => understanding.summary).filter(Boolean).join(" ")
  ) || "Support topic";
}

function readPreviousSupportNeedAssessment(topicBranchInput: TopicBranchInput): SupportNeedAssessment | null {
  const value = topicBranchInput.currentTopic?.supportNeedResolution;

  return isSupportNeedAssessment(value) ? value : null;
}

function readPreviousSupportKnowledgeSummary(topicBranchInput: TopicBranchInput): string | null {
  const value = topicBranchInput.currentTopic?.supportKnowledgeSummary;

  if (typeof value === "string" && value.trim() !== "") return value;

  if (isRecord(value) && typeof value.summary === "string" && value.summary.trim() !== "") {
    return value.summary;
  }

  return null;
}

function isSupportNeedAssessment(value: unknown): value is SupportNeedAssessment {
  return isRecord(value) &&
    typeof value.supportNeed === "string" &&
    (value.unclearReason === null || typeof value.unclearReason === "string") &&
    typeof value.reason === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export {runSupportNeedResolutionBranch};
export type {
  AssessSupportNeedAnalyzedOutput,
  AssessSupportNeedFallbackOutput,
  AssessSupportNeedInput,
  AssessSupportNeedOutput,
  SupportNeedResolutionBranchOutput
};
