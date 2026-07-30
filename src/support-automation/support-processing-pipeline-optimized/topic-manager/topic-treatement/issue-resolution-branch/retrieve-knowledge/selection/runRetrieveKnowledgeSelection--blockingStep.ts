import {callLLM} from "../../../../../../../infrastructure/llm/llm-client";
import {parseLLMResponse} from "../../../../../../../infrastructure/llm/parseLLMResponse";
import {buildRetrieveKnowledgeSelectionPrompt} from "./buildRetrieveKnowledgeSelectionPrompt";
import {retrieveKnowledgeSelectionResponseFormat} from "./responseFormat";
import {validateRetrieveKnowledgeSelectionOutput} from "./validateRetrieveKnowledgeSelectionOutput";

import type {LiveMemoryTopicOptimized} from "../../../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";
import type {RawKnowledgeCandidate} from "../ranked-search/runRankedSearch--oneShotStep";

type RetrieveKnowledgeSelection = LiveMemoryTopicOptimized["sourceTopicManager"]["retrieveKnowledge"]["selection"];

export type RunRetrieveKnowledgeSelectionInput = {
  summaryTopic: string;
  rawKnowledgeCandidates: RawKnowledgeCandidate[];
  keptRawKnowledgeIds: string[];
  previousSelection: RetrieveKnowledgeSelection;
  currentUserMessage: {content: string; channel?: string};
  previousConversationTurn: {
    previousUserMessage: string | null;
    previousBotMessage: string | null;
  };
};

async function runRetrieveKnowledgeSelection(
  input: RunRetrieveKnowledgeSelectionInput
): Promise<RetrieveKnowledgeSelection> {
  const fallback = buildFallbackSelection(input);
  const {messages} = buildRetrieveKnowledgeSelectionPrompt(input);

  try {
    const result = await callLLM(messages, {
      stage: "retrieve_knowledge_selection",
      preset: "standard",
      temperature: 0,
      maxTokens: 900,
      responseFormat: retrieveKnowledgeSelectionResponseFormat
    });

    if (!result.success || !result.content) {
      return fallback;
    }

    const parsed = parseLLMResponse(result.content);
    const validated = validateRetrieveKnowledgeSelectionOutput(
      parsed,
      input.keptRawKnowledgeIds
    );

    return validated ?? fallback;
  } catch {
    return fallback;
  }
}

function buildFallbackSelection(input: RunRetrieveKnowledgeSelectionInput): RetrieveKnowledgeSelection {
  if (input.keptRawKnowledgeIds.length === 0) {
    return {
      isClearSelected: false,
      selectedRawKnowledgeIds: [],
      clarificationQuestion: "Could you clarify which part of the issue you want help with?",
      selectionExplanation: "Fallback selection: no filtered raw knowledge IDs were available."
    };
  }

  return {
    isClearSelected: true,
    selectedRawKnowledgeIds: input.keptRawKnowledgeIds,
    clarificationQuestion: null,
    selectionExplanation: "Fallback selection: kept all filtered raw knowledge IDs because the selection step could not produce a validated output."
  };
}

export {runRetrieveKnowledgeSelection};
