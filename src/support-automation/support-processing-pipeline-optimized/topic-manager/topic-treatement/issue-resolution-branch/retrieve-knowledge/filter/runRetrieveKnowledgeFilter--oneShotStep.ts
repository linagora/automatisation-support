import {callLLM} from "../../../../../../../infrastructure/llm/llm-client";
import {parseLLMResponse} from "../../../../../../../infrastructure/llm/parseLLMResponse";
import {buildRetrieveKnowledgeFilterPrompt} from "./buildRetrieveKnowledgeFilterPrompt";
import {retrieveKnowledgeFilterResponseFormat} from "./responseFormat";
import {validateRetrieveKnowledgeFilterOutput} from "./validateRetrieveKnowledgeFilterOutput";

import type {LiveMemoryTopicOptimized} from "../../../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";

type RetrieveKnowledgeFilter = LiveMemoryTopicOptimized["sourceTopicManager"]["retrieveKnowledge"]["filter"];

export type RunRetrieveKnowledgeFilterInput = {
  summaryTopic: string;
  rawRagKnowledge: unknown;
};

async function runRetrieveKnowledgeFilter(
  input: RunRetrieveKnowledgeFilterInput
): Promise<RetrieveKnowledgeFilter> {
  const fallback = buildFallbackFilter(input.rawRagKnowledge);
  const {messages} = buildRetrieveKnowledgeFilterPrompt(input);

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
    const validated = validateRetrieveKnowledgeFilterOutput(parsed);

    return validated ?? fallback;
  } catch {
    return fallback;
  }
}

function buildFallbackFilter(rawRagKnowledge: unknown): RetrieveKnowledgeFilter {
  return {
    isFiltered: true,
    filteredRagKnowledge: rawRagKnowledge,
    filterExplanation: "Fallback filter: kept the raw RAG knowledge because the filter step could not produce a validated output."
  };
}

export {runRetrieveKnowledgeFilter};
