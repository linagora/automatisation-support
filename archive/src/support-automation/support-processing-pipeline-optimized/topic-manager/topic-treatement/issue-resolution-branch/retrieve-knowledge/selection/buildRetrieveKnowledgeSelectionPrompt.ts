import {outputJsonShapeForPrompt} from "./responseFormat";

import type {LLMMessage} from "../../../../../../infrastructure/llm/llm-client";
import type {RunRetrieveKnowledgeSelectionInput} from "./runRetrieveKnowledgeSelection--blockingStep";

function buildRetrieveKnowledgeSelectionPrompt(
  input: RunRetrieveKnowledgeSelectionInput
): {messages: LLMMessage[]} {
  return {
    messages: [
      {
        role: "system",
        content: `You are the blocking selection step of an internal support RAG pipeline.

You do not answer the support issue.
You decide whether the filtered RAG knowledge is clearly usable for the current topic.

Possible outcomes:
1. Clear selection:
   - the filtered candidates describe the same issue type, or several candidates can clearly help together;
   - set isClearSelected true;
   - return the selected filtered RAG knowledge;
   - clarificationQuestion must be null.

2. Clarification needed:
   - the filtered candidates point to meaningfully different issue types;
   - the user's latest message and previous context do not tell us which issue type applies;
   - set isClearSelected false;
   - selectedfilteredRagKnowledge must be null;
   - write one short English clarification question for the user.

Rules:
- Be conservative: when two different candidate groups would lead to different guidance, ask a clarification question.
- Do not ask a generic question if a specific distinction can be named.
- If a previous clarification question exists, use the latest user message to decide whether the ambiguity is now resolved.
- Return only JSON.`
      },
      {
        role: "user",
        content: JSON.stringify({
          summaryTopic: input.summaryTopic,
          filteredRagKnowledge: input.filteredRagKnowledge,
          previousSelection: input.previousSelection,
          currentUserMessage: input.currentUserMessage,
          previousConversationTurn: input.previousConversationTurn,
          outputShape: outputJsonShapeForPrompt
        }, null, 2)
      }
    ]
  };
}

function buildDeterministicRetrieveKnowledgeSelectionQuestion(
  input: RunRetrieveKnowledgeSelectionInput
): string {
  if (input.previousSelection.clarificationQuestion) {
    return input.previousSelection.clarificationQuestion;
  }

  return "I found a few similar cases, but they may point to different causes. Could you clarify which situation best matches what you are seeing?";
}

export {
  buildDeterministicRetrieveKnowledgeSelectionQuestion,
  buildRetrieveKnowledgeSelectionPrompt
};
