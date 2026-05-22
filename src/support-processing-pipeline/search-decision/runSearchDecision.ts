/**
 * Search Decision
 *
 * Temporary deterministic implementation.
 *
 * Purpose:
 * Decide whether the pipeline should search for external / documented solutions.
 *
 * Current behavior:
 * Always continues the pipeline without searching.
 */

import type {
  SearchDecisionInput,
  SearchDecisionOutput
} from "../typesSupportProcessingPipeline.types";

async function runSearchDecision(
  input: SearchDecisionInput
): Promise<SearchDecisionOutput> {
  const hasTopic =
    Array.isArray(input.turnUnderstandingDelta.segments_topic) &&
    input.turnUnderstandingDelta.segments_topic.length > 0;

  return {
    decision: {
      route: "continue"
    },
    shouldSearchSolution: false,
    detected: {
      topicsQualificationResult: hasTopic ? "not_evaluated" : "no_topic",
      solutionLikelihoodResult: "not_evaluated"
    },
    history: {
      checked: [
        "turn_understanding_delta_received",
        "topics_presence_checked",
        "forced_no_search_mode"
      ],
      failed: []
    }
  } as SearchDecisionOutput;
}

export {
  runSearchDecision
};