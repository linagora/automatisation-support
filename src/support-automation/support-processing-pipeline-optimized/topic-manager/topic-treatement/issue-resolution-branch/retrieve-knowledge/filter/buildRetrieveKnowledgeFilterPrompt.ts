import {outputJsonShapeForPrompt} from "./responseFormat";

import type {LLMMessage} from "../../../../../../../infrastructure/llm/llm-client";
import type {RawKnowledgeCandidate} from "../ranked-search/runRankedSearch--oneShotStep";

export type RetrieveKnowledgeFilterPromptInput = {
  summaryTopic: string;
  rawKnowledgeCandidates: RawKnowledgeCandidate[];
};

function buildRetrieveKnowledgeFilterPrompt(
  input: RetrieveKnowledgeFilterPromptInput
): {messages: LLMMessage[]} {
  return {
    messages: [
      {
        role: "system",
        content: `You are the first broad filter of an internal support RAG pipeline.

You do not answer the user.
You do not ask clarification questions.
Your job is only to select which raw knowledge candidates should be kept for later analysis.

Rules:
- Use the topic summary as the source of truth for what we are trying to solve.
- Return only existing rawKnowledgeIds.
- Do not rewrite the knowledge.
- Do not summarize the candidates.
- Do not create new knowledge objects.
- Do not invent IDs.
- Keep candidates that are clearly or plausibly relevant to the support topic.
- Drop candidates that are unrelated, too generic, or misleading.
- Do not keep a candidate only because it shares generic words with the topic. If the product/service differs, keep it only when there is a plausible transferable cause, action, diagnostic, workaround, resolution, or detail to ask.
- If none are relevant, return an empty keptRawKnowledgeIds array.
- Return only JSON.`
      },
      {
        role: "user",
        content: JSON.stringify({
          summaryTopic: input.summaryTopic,
          rawKnowledgeCandidates: input.rawKnowledgeCandidates,
          outputShape: outputJsonShapeForPrompt
        }, null, 2)
      }
    ]
  };
}

export {buildRetrieveKnowledgeFilterPrompt};
