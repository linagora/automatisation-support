import {callLLM} from "../../../infrastructure/llm/llm-client";
import {parseLLMResponse} from "../../../infrastructure/llm/parseLLMResponse";
import {topicUpdateFallbackReason} from "../../support-catalog-optimized/supportFallback.catalog";
import {buildProposeTopicUpdatesPrompt} from "./buildProposeTopicUpdatesPrompt";
import {validateProposeTopicUpdatesOutput} from "./validateProposeTopicUpdatesOutput";

import type {
  AnalyzeSupportTextAttemptedAction,
  AnalyzeSupportTextCaseDetail,
  AnalyzeSupportTextOther
} from "../analyze-support-text-optimized/runAnalyzeSupportText";
import type {LiveMemoryTopicOptimized} from "../../../infrastructure/live-memory/liveMemoryContextOptimized.template";
import type {RecentInteractionContext} from "../typesPipelineContext";
import type {TopicUpdateFallbackReason} from "../../support-catalog-optimized/supportFallback.catalog";
import type {TopicUpdatePlan} from "./validateProposeTopicUpdatesOutput";

// Stage contract:
// Input: atomic support facts extracted from the latest message.
// Output: topic update plans that route fact ids to existing or new topics.
// Non-goals: no memory update, no patch building, no persistence, no response drafting.

type CurrentUserMessage = {
  content: string;
  channel?: string;
};

type ProposeTopicUpdatesInput = {
  existingTopics: LiveMemoryTopicOptimized[];
  currentUserMessage: CurrentUserMessage;
  summaryMessage: string | null;
  caseDetailsExtracted: AnalyzeSupportTextCaseDetail[];
  attemptedActionsExtracted: AnalyzeSupportTextAttemptedAction[];
  otherExtracted: AnalyzeSupportTextOther[];
  recentInteractionContext: RecentInteractionContext;
};

type ProposeTopicUpdatesAnalyzedOutput = {
  status: "analyzed";
  fallbackReason: null;
  topicUpdatePlans: TopicUpdatePlan[];
};

type ProposeTopicUpdatesFallbackOutput = {
  status: "fallback";
  fallbackReason: TopicUpdateFallbackReason;
  topicUpdatePlans: [];
};

type ProposeTopicUpdatesOutput =
  | ProposeTopicUpdatesAnalyzedOutput
  | ProposeTopicUpdatesFallbackOutput;

async function runProposeTopicUpdates(input: ProposeTopicUpdatesInput): Promise<ProposeTopicUpdatesOutput> {
  if (!hasExtractedFacts(input)) {
    return {
      status: "analyzed",
      fallbackReason: null,
      topicUpdatePlans: []
    };
  }

  const {messages, responseFormat} = buildProposeTopicUpdatesPrompt({
    existingTopics: input.existingTopics,
    currentUserMessage: input.currentUserMessage,
    summaryMessage: input.summaryMessage,
    caseDetailsExtracted: input.caseDetailsExtracted,
    attemptedActionsExtracted: input.attemptedActionsExtracted,
    otherExtracted: input.otherExtracted,
    recentInteractionContext: input.recentInteractionContext
  });

  try {
    const result = await callLLM(messages, {
      stage: "topic_update_proposal",
      preset: "fullWeightMessageAnalysis",
      temperature: 0,
      maxTokens: 2000,
      responseFormat
    });

    if (!result.success) {
      return buildFallbackOutput(topicUpdateFallbackReason.llmCallFailed);
    }

    if (!result.content || result.content.trim() === "") {
      return buildFallbackOutput(topicUpdateFallbackReason.missingLlmContent);
    }

    const parsedResponse = parseLLMResponse(result.content);

    if (!parsedResponse) {
      return buildFallbackOutput(topicUpdateFallbackReason.invalidLlmOutput);
    }

    const topicUpdatePlans = validateProposeTopicUpdatesOutput(parsedResponse, {
      existingTopics: input.existingTopics,
      caseDetailsExtracted: input.caseDetailsExtracted,
      attemptedActionsExtracted: input.attemptedActionsExtracted,
      otherExtracted: input.otherExtracted
    });

    if (!topicUpdatePlans) {
      return buildFallbackOutput(topicUpdateFallbackReason.invalidLlmOutput);
    }

    return {
      status: "analyzed",
      fallbackReason: null,
      topicUpdatePlans
    };
  } catch {
    return buildFallbackOutput(topicUpdateFallbackReason.llmCallFailed);
  }
}

function hasExtractedFacts(input: ProposeTopicUpdatesInput): boolean {
  return (
    input.caseDetailsExtracted.length > 0 ||
    input.attemptedActionsExtracted.length > 0 ||
    input.otherExtracted.length > 0
  );
}

function buildFallbackOutput(reason: TopicUpdateFallbackReason): ProposeTopicUpdatesFallbackOutput {
  return {
    status: "fallback",
    fallbackReason: reason,
    topicUpdatePlans: []
  };
}

export {runProposeTopicUpdates};

export type {
  CurrentUserMessage,
  ProposeTopicUpdatesAnalyzedOutput,
  ProposeTopicUpdatesFallbackOutput,
  ProposeTopicUpdatesInput,
  ProposeTopicUpdatesOutput,
  TopicUpdatePlan
};