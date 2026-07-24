import {outputJsonShapeForPrompt} from "./responseFormat";

import type {LLMMessage} from "../../../../../../../infrastructure/llm/llm-client";

export type RetrieveKnowledgeFilterPromptInput = {
  summaryTopic: string;
  rawRagKnowledge: unknown;
};

function buildRetrieveKnowledgeFilterPrompt(
  input: RetrieveKnowledgeFilterPromptInput
): {messages: LLMMessage[]} {
  return {
    messages: [
      {
        role: "system",
        content: `You are the first filtering step of an internal support RAG pipeline.

You do not answer the user.
You do not ask clarification questions.
You do not decide whether the knowledge is clearly selected.
You only remove obviously irrelevant RAG candidates.

Rules:
- Use the topic summary as the source of truth for what we are trying to solve.
- Keep candidates that are clearly relevant.
- Keep candidates that are plausibly useful, even if imperfect.
- Remove candidates that are obviously unrelated, about another product area, another symptom, or another support intent.
- If the raw RAG knowledge is already concise and useful, keep it.
- If no candidate is useful, return an empty array.
- Return only JSON.`
      },
      {
        role: "user",
        content: JSON.stringify({
          summaryTopic: input.summaryTopic,
          rawRagKnowledge: input.rawRagKnowledge,
          outputShape: outputJsonShapeForPrompt
        }, null, 2)
      }
    ]
  };
}

export {buildRetrieveKnowledgeFilterPrompt};
