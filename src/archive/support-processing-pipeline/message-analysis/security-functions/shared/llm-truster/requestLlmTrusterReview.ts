import {
  callLLM
} from "../../../../../../infrastructure/llm/llm-client";

import {
  buildLlmTrusterReviewMessages
} from "./buildLlmTrusterReviewPrompt";
import {
  parseLlmTrusterReviewOutput
} from "./parseLlmTrusterReviewOutput";

import type {
  LlmTrusterReviewInput,
  LlmTrusterReviewOutput
} from "../runLlmTrusterReview";

async function requestLlmTrusterReview(
  input: LlmTrusterReviewInput
): Promise<LlmTrusterReviewOutput> {
  try {
    const result = await callLLM(
      buildLlmTrusterReviewMessages(input),
      {
        preset: "llmTrusterReview",
        temperature: 0,
        maxTokens: 200,
        responseFormat: {
          type: "json_object"
        }
      }
    );

    if (!result.success || !result.content) {
      return {
        route: "failed",
        reason: "llm_truster_request_failed"
      };
    }

    return parseLlmTrusterReviewOutput(result.content);
  } catch {
    return {
      route: "failed",
      reason: "llm_truster_request_failed"
    };
  }
}

export {
  requestLlmTrusterReview
};
