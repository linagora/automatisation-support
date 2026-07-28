import {callLLM} from "../../../../../../infrastructure/llm/llm-client";
import {parseLLMResponse} from "../../../../../../infrastructure/llm/parseLLMResponse";
import {buildDeterministicRetrieveKnowledgeSelectionQuestion, buildRetrieveKnowledgeSelectionPrompt} from "./buildRetrieveKnowledgeSelectionPrompt";
import {retrieveKnowledgeSelectionResponseFormat} from "./responseFormat";
import {validateRetrieveKnowledgeSelectionOutput} from "./validateRetrieveKnowledgeSelectionOutput";

import type {LiveMemoryTopicOptimized} from "../../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";

type RetrieveKnowledgeSelection = LiveMemoryTopicOptimized["sourceTopicManager"]["retrieveKnowledge"]["selection"];

export type RunRetrieveKnowledgeSelectionInput = {
  summaryTopic: string;
  filteredRagKnowledge: unknown;
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
  const fallbackQuestion = buildDeterministicRetrieveKnowledgeSelectionQuestion(input);
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
      return buildUnclearSelection(fallbackQuestion, "Fallback selection: the selection step could not produce a validated output.");
    }

    const parsed = parseLLMResponse(result.content);
    const validated = validateRetrieveKnowledgeSelectionOutput(parsed);

    return validated ?? buildUnclearSelection(fallbackQuestion, "Fallback selection: invalid selection output.");
  } catch {
    return buildUnclearSelection(fallbackQuestion, "Fallback selection: LLM call failed.");
  }
}

function buildUnclearSelection(
  clarificationQuestion: string,
  selectionExplanation: string
): RetrieveKnowledgeSelection {
  return {
    isClearSelected: false,
    clarificationQuestion,
    selectedfilteredRagKnowledge: null,
    selectionExplanation
  };
}

export {runRetrieveKnowledgeSelection};
