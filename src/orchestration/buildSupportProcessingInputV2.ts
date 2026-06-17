import {
  buildSupportProcessingInput
} from "./buildSupportProcessingInput";

import type {
  MatchingResult
} from "../matching/typesMatching.types";
import type {
  SupportProcessingPipelineV2Input
} from "../support-processing-pipeline/v2/typesSupportProcessingPipelineV2.types";

function buildRecentInteractionContext(
  matchingResult: MatchingResult
): SupportProcessingPipelineV2Input["recentInteractionContext"] {
  const compactContext =
    matchingResult.ticket?.conversationHistory.contextLLM?.trim();

  return {
    previousUserMessageSummary: compactContext || "No previous user message summary.",
    previousBotResponseSummary: compactContext || "No previous bot response summary."
  };
}

function buildSupportProcessingInputV2(
  matchingResult: MatchingResult
): SupportProcessingPipelineV2Input {
  const v1Input = buildSupportProcessingInput(matchingResult);

  return {
    ...v1Input,
    recentInteractionContext: buildRecentInteractionContext(matchingResult)
  };
}

export {
  buildSupportProcessingInputV2
};
