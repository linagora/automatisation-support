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
      route: "continue",
      type: "acknowledgement"
    },
    detected: {
      topicsQualificationResult: hasTopic ? "not_evaluated" : "no_topic",
      solutionLikelihoodResult: "not_evaluated"
    },
    history: {
      checked: [
        "turn_understanding_delta_received",
        "topics_presence_checked",
        "forced_acknowledgement_mode"
      ],
      failed: []
    }
  } as SearchDecisionOutput;
}

export {
  runSearchDecision
};