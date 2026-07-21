import {callLLM} from "../../../infrastructure/llm/llm-client";
import {parseLLMResponse} from "../../../infrastructure/llm/parseLLMResponse";
import {topicUpdateFallbackReason} from "../../support-catalog-optimized/supportFallback.catalog";
import {buildProposeTopicUpdatesPrompt} from "./buildProposeTopicUpdatesPrompt";
import {validateProposeTopicUpdatesOutput} from "./validateProposeTopicUpdatesOutput";

import type {AnalyzeSupportTextUnderstanding} from "../../support-processing-pipeline-optimized/analyze-support-text-optimized/runAnalyzeSupportText";
import type {RecentInteractionContext} from "../../support-processing-pipeline-v2/typesSupportProcessingPipelineV2.types";
import type {TopicUpdateFallbackReason} from "../../support-catalog-optimized/supportFallback.catalog";
import type {
  ExistingSupportTopic,
  TopicUpdatePlan
} from "./validateProposeTopicUpdatesOutput";

// Stage contract:
// Input: existing topics, optimized support understandings, and recent interaction context.
// Output: validated topic update plans, or a structured fallback.
// Non-goals: no memory update, no patch building, no snapshot building, no persistence, no response drafting.
// Validation policy: strict JSON validation, strict topic/understanding linking, no hidden repair.

type ProposeTopicUpdatesInput = {
  existingTopics: ExistingSupportTopic[];
  understandings: AnalyzeSupportTextUnderstanding[];
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
  if (input.understandings.length === 0) {
    return {
      status: "analyzed",
      fallbackReason: null,
      topicUpdatePlans: []
    };
  }

  const {messages, responseFormat} = buildProposeTopicUpdatesPrompt({
    existingTopics: input.existingTopics,
    understandings: input.understandings,
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
      understandings: input.understandings
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

function buildFallbackOutput(reason: TopicUpdateFallbackReason): ProposeTopicUpdatesFallbackOutput {
  return {
    status: "fallback",
    fallbackReason: reason,
    topicUpdatePlans: []
  };
}

export {runProposeTopicUpdates};

export type {
  ProposeTopicUpdatesAnalyzedOutput,
  ProposeTopicUpdatesFallbackOutput,
  ProposeTopicUpdatesInput,
  ProposeTopicUpdatesOutput,
  TopicUpdatePlan
};
