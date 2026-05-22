/**
 * Solution Retrieval
 *
 * Temporary deterministic implementation.
 *
 * Purpose:
 * Retrieve possible solutions for the detected support topics.
 *
 * Current behavior:
 * Returns no solution.
 */

import type {
  SolutionRetrievalInput,
  SolutionRetrievalOutput
} from "../typesSupportProcessingPipeline.types";

async function runSolutionRetrieval(
  input: SolutionRetrievalInput
): Promise<SolutionRetrievalOutput> {
  const topicCount =
    Array.isArray(input.turnUnderstandingDelta.segments_topic)
      ? input.turnUnderstandingDelta.segments_topic.length
      : 0;

  return [
    {
      status: "not_found",
      source: "temporary_no_retrieval_mode",
      message:
        "No solution retrieval has been performed yet. No reliable solution was found for the provided topic context.",
      llmMessage:
        topicCount > 0
          ? "No relevant documented solution was found for the provided support topic."
          : "No topic was provided, so no solution retrieval was performed."
    }
  ] as SolutionRetrievalOutput;
}

export {
  runSolutionRetrieval
};