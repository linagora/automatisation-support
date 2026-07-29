import {callLLM} from "../../../infrastructure/llm/llm-client";
import {parseLLMResponse} from "../../../infrastructure/llm/parseLLMResponse";
import {supportTextFallbackReason} from "../../support-catalog-optimized/supportFallback.catalog";
import {buildAnalyzeSupportTextPrompt} from "./buildAnalyzeSupportTextPrompt";
import {validateAnalyzeSupportTextOutput} from "./validateAnalyzeSupportTextOutput";

import type {RecentInteractionContext} from "../typesPipelineContext";
import type {SupportTextFallbackReason} from "../../support-catalog-optimized/supportFallback.catalog";
import type {AnalyzeTextSurfaceSegment} from "../analyze-text-surface-optimized/runAnalyzeTextSurface";
import type {AnalyzeSupportTextPendingRequestedItems} from "./buildAnalyzeSupportTextPrompt";
import type {
  AttemptedAction,
  KeyedOtherEvidence,
  KeyedPrimitiveEvidence,
  SupportTextSegment,
  ValidatedSupportTextAnalysis
} from "./validateAnalyzeSupportTextOutput";

// Stage contract:
// Input: analyzed text-surface segments and recent interaction context.
// Output: atomic support facts extracted from the latest user message.
// Non-goals: no topic update, no topic matching, no diagnosis, no retrieval,
// no response drafting, no subject hint.
// Routing facts to topics is the responsibility of proposeTopicUpdates.

type AnalyzeSupportTextInput = {
  textSurfaceAnalysis: {
    segments: AnalyzeTextSurfaceSegment[];
  };
  recentInteractionContext: RecentInteractionContext;
  pendingRequestedItems?: AnalyzeSupportTextPendingRequestedItems;
};

type AnalyzeSupportTextCaseDetail = KeyedPrimitiveEvidence & {
  caseDetailId: string;
};

type AnalyzeSupportTextAttemptedAction = AttemptedAction & {
  attemptedActionId: string;
};

type AnalyzeSupportTextOther = KeyedOtherEvidence & {
  otherId: string;
};

type AnalyzeSupportTextAnalyzedOutput = {
  status: "analyzed";
  fallbackReason: null;
  summaryMessage: string | null;
  userLanguage: string;
  caseDetailsExtracted: AnalyzeSupportTextCaseDetail[];
  attemptedActionsExtracted: AnalyzeSupportTextAttemptedAction[];
  otherExtracted: AnalyzeSupportTextOther[];
};

type AnalyzeSupportTextFallbackOutput = {
  status: "fallback";
  fallbackReason: SupportTextFallbackReason;
  summaryMessage: null;
  userLanguage: "unknown";
  caseDetailsExtracted: [];
  attemptedActionsExtracted: [];
  otherExtracted: [];
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
      summaryMessage: null,
      userLanguage: "unknown",
      caseDetailsExtracted: [],
      attemptedActionsExtracted: [],
      otherExtracted: []
    };
  }

  const {messages, responseFormat} = buildAnalyzeSupportTextPrompt({
    supportSegments,
    recentInteractionContext: input.recentInteractionContext,
    pendingRequestedItems: input.pendingRequestedItems
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

    const validatedAnalysis = validateAnalyzeSupportTextOutput(
      parsedResponse,
      supportSegments
    );

    if (validatedAnalysis) {
      return buildAnalyzedOutput(validatedAnalysis);
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
    summaryMessage: null,
    userLanguage: "unknown",
    caseDetailsExtracted: [],
    attemptedActionsExtracted: [],
    otherExtracted: []
  };
}

function buildAnalyzedOutput(
  analysis: ValidatedSupportTextAnalysis
): AnalyzeSupportTextAnalyzedOutput {
  return {
    status: "analyzed",
    fallbackReason: null,
    summaryMessage: analysis.summaryMessage,
    userLanguage: analysis.userLanguage,
    caseDetailsExtracted: analysis.caseDetailsExtracted.map((caseDetail, index) => ({
      caseDetailId: `case_detail_${index + 1}`,
      ...caseDetail
    })),
    attemptedActionsExtracted: analysis.attemptedActionsExtracted.map((attemptedAction, index) => ({
      attemptedActionId: `attempted_action_${index + 1}`,
      ...attemptedAction
    })),
    otherExtracted: analysis.otherExtracted.map((other, index) => ({
      otherId: `other_${index + 1}`,
      ...other
    }))
  };
}

export {runAnalyzeSupportText};

export type {
  AnalyzeSupportTextAttemptedAction,
  AnalyzeSupportTextCaseDetail,
  AnalyzeSupportTextInput,
  AnalyzeSupportTextOther,
  AnalyzeSupportTextOutput
};