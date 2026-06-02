import {
  parseLLMResponse
} from "../../../../../llm/parseLLMResponse";

import type {
  LlmTrusterReviewOutput
} from "../runLlmTrusterReview";

function parseLlmTrusterReviewOutput(
  content: string
): LlmTrusterReviewOutput {
  const parsedResponse = parseLLMResponse(content);

  if (parsedResponse === null) {
    return {
      route: "failed",
      reason: "invalid_llm_truster_response"
    };
  }

  const route = parsedResponse?.route;

  if (route !== "continue" && route !== "stop") {
    return {
      route: "failed",
      reason: "invalid_llm_truster_response"
    };
  }

  const reason =
    typeof parsedResponse.reason === "string"
      ? parsedResponse.reason
      : undefined;

  return {
    route,
    ...(reason ? { reason } : {})
  };
}

export {
  parseLlmTrusterReviewOutput
};
