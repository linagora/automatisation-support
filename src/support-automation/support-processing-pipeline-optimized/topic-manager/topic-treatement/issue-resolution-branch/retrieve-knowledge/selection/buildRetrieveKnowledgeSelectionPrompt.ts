import {outputJsonShapeForPrompt} from "./responseFormat";

import type {LLMMessage} from "../../../../../../../infrastructure/llm/llm-client";
import type {RawKnowledgeCandidate} from "../ranked-search/runRankedSearch--oneShotStep";

export type RetrieveKnowledgeSelectionPromptInput = {
  summaryTopic: string;
  rawKnowledgeCandidates: RawKnowledgeCandidate[];
  keptRawKnowledgeIds: string[];
  previousSelection: {
    isClearSelected: boolean;
    selectedRawKnowledgeIds: string[];
    clarificationQuestion: string | null;
    selectionExplanation: string | null;
  };
  currentUserMessage: {
    content: string;
    channel?: string;
  };
  previousConversationTurn: {
    previousUserMessage: string | null;
    previousBotMessage: string | null;
  };
};

function buildRetrieveKnowledgeSelectionPrompt(
  input: RetrieveKnowledgeSelectionPromptInput
): {messages: LLMMessage[]} {
  return {
    messages: [
      {
        role: "system",
        content: `You are the final selection step after a broad knowledge filter.

The broad filter already produced keptRawKnowledgeIds.
Your job is to decide which kept candidates are clearly useful enough for the next step, or whether a clarification question is needed.

Return only IDs.
Do not rewrite knowledge.
Do not summarize candidates.
Do not create new knowledge objects.
Do not invent IDs.
Use only IDs from keptRawKnowledgeIds.

Use rawKnowledgeCandidates only to understand what each ID contains.
If one or more kept candidates clearly match the support topic, set isClearSelected to true and return selectedRawKnowledgeIds.
If the kept candidates are ambiguous, mutually incompatible, or not enough to choose safely, set isClearSelected to false and ask one concise clarification question.
If the user answered a previous clarification question, use currentUserMessage and previousSelection to make the final selection when possible.

Final selection must be strict.

Do not select a candidate only because it shares generic words with the topic, such as notification, message, refresh, cache, sync, visibility, or mobile.

Check:
- product or service;
- feature or page;
- trigger action;
- observed result;
- whether the candidate contains a clearly transferable action, cause, diagnostic, workaround, resolution, or specific detail to ask.

If the product/service differs, select the candidate only when the candidate contains a clearly transferable cause, action, diagnostic, workaround, resolution, or specific detail.

If the candidate only describes a different product issue with lexical overlap, select no candidates.

If no candidate is sufficiently applicable, return:
{
  "isClearSelected": true,
  "selectedRawKnowledgeIds": [],
  "clarificationQuestion": null,
  "selectionExplanation": "No candidate is sufficiently applicable to the current support topic."
}

Use isClearSelected=false only when a user clarification could help choose between candidates.
Do not ask clarification just because no candidate is useful.

Return only JSON matching the response schema.`
      },
      {
        role: "user",
        content: JSON.stringify({
          summaryTopic: input.summaryTopic,
          rawKnowledgeCandidates: input.rawKnowledgeCandidates,
          keptRawKnowledgeIds: input.keptRawKnowledgeIds,
          previousSelection: input.previousSelection,
          currentUserMessage: input.currentUserMessage,
          previousConversationTurn: input.previousConversationTurn,
          outputShape: outputJsonShapeForPrompt
        }, null, 2)
      }
    ]
  };
}

export {
  buildRetrieveKnowledgeSelectionPrompt
};
