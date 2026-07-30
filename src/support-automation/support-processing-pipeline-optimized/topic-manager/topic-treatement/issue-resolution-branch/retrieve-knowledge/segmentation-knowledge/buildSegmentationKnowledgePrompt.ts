import {outputJsonShapeForPrompt} from "./responseFormat";

import type {LLMMessage} from "../../../../../../../infrastructure/llm/llm-client";
import type {RawKnowledgeCandidate} from "../ranked-search/runRankedSearch--oneShotStep";

export type SegmentationKnowledgePromptInput = {
  summaryTopic: string;
  rawKnowledgeCandidates: RawKnowledgeCandidate[];
  selectedRawKnowledgeIds: string[];
};

function buildSegmentationKnowledgePrompt(
  input: SegmentationKnowledgePromptInput
): {messages: LLMMessage[]} {
  return {
    messages: [
      {
        role: "system",
        content: `You segment selected raw knowledge for one support topic.

Use only candidates whose rawKnowledgeId is in selectedRawKnowledgeIds.
Return only segmentedKnowledge items for selected IDs.
Do not invent IDs, source spans, facts, or solutions.

Split faithful excerpts/paraphrases into:
- userFacingKnowledge: safe information usable with the user.
- supportFacingKnowledge: internal/support-only information.

Use candidate sourceHint when available.
Use sourceSpan only when explicitly available, otherwise null.
Omit selected candidates with no useful pieces.

Return only JSON matching the response schema.`
      },
      {
        role: "user",
        content: JSON.stringify({
          summaryTopic: input.summaryTopic,
          selectedRawKnowledgeIds: input.selectedRawKnowledgeIds,
          rawKnowledgeCandidates: input.rawKnowledgeCandidates,
          outputShape: outputJsonShapeForPrompt
        }, null, 2)
      }
    ]
  };
}

export {buildSegmentationKnowledgePrompt};
