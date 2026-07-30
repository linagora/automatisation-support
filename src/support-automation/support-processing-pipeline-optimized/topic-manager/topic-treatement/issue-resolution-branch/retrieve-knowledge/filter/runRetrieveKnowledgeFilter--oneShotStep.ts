import {callLLM} from "../../../../../../../infrastructure/llm/llm-client";
import {parseLLMResponse} from "../../../../../../../infrastructure/llm/parseLLMResponse";
import {buildRetrieveKnowledgeFilterPrompt} from "./buildRetrieveKnowledgeFilterPrompt";
import {retrieveKnowledgeFilterResponseFormat} from "./responseFormat";
import {validateRetrieveKnowledgeFilterOutput} from "./validateRetrieveKnowledgeFilterOutput";

import type {LiveMemoryTopicOptimized} from "../../../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";
import type {RawKnowledgeCandidate} from "../ranked-search/runRankedSearch--oneShotStep";

type RetrieveKnowledgeFilter = LiveMemoryTopicOptimized["sourceTopicManager"]["retrieveKnowledge"]["filter"];

export type RunRetrieveKnowledgeFilterInput = {
  summaryTopic: string;
  rawKnowledgeCandidates: RawKnowledgeCandidate[];
};

async function runRetrieveKnowledgeFilter(
  input: RunRetrieveKnowledgeFilterInput
): Promise<RetrieveKnowledgeFilter> {
  const fallback = buildFallbackFilter(input.rawKnowledgeCandidates);
  const {messages} = buildRetrieveKnowledgeFilterPrompt(input);
  const validRawKnowledgeIds = input.rawKnowledgeCandidates.map((candidate) => candidate.rawKnowledgeId);

  try {
    const result = await callLLM(messages, {
      stage: "retrieve_knowledge_filter",
      preset: "standard",
      temperature: 0,
      maxTokens: 900,
      responseFormat: retrieveKnowledgeFilterResponseFormat
    });

    if (!result.success || !result.content) {
      return fallback;
    }

    const parsed = parseLLMResponse(result.content);
    const validated = validateRetrieveKnowledgeFilterOutput(
      parsed,
      validRawKnowledgeIds
    );

    return validated ?? fallback;
  } catch {
    return fallback;
  }
}

function buildFallbackFilter(rawKnowledgeCandidates: RawKnowledgeCandidate[]): RetrieveKnowledgeFilter {
  return {
    isFiltered: true,
    keptRawKnowledgeIds: rawKnowledgeCandidates.map((candidate) => candidate.rawKnowledgeId),
    filterExplanation: "Fallback filter: kept all raw knowledge candidate IDs because the filter step could not produce a validated output."
  };
}

export {runRetrieveKnowledgeFilter};
