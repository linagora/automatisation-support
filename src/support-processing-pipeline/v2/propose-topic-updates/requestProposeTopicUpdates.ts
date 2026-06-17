import {
  callLLM
} from "../../../llm/llm-client";
import {
  parseLLMResponse
} from "../../../llm/parseLLMResponse";
import {
  proposeTopicUpdatesResponseFormat
} from "./proposeTopicUpdates.schema";

import type {
  RawProposeTopicUpdates,
  RequestProposeTopicUpdatesInput
} from "./typesProposeTopicUpdates.types";

async function requestProposeTopicUpdates(
  input: RequestProposeTopicUpdatesInput
): Promise<RawProposeTopicUpdates> {
  try {
    const result = await callLLM(input.prompt.messages, {
      preset: "fullWeightMessageAnalysis",
      temperature: 0,
      maxTokens: 2000,
      responseFormat: proposeTopicUpdatesResponseFormat
    });

    if (!result.success || !result.content) {
      return {
        status: "failed",
        rawResponse: result.content,
        error: {
          message: result.error || "llm_call_failed"
        }
      };
    }

    return {
      status: "completed",
      parsedResponse: parseLLMResponse(result.content),
      rawResponse: result.content
    };
  } catch (error) {
    return {
      status: "failed",
      error: {
        message:
          error instanceof Error
            ? `propose_topic_updates_error:${error.message}`
            : "propose_topic_updates_error:unknown_error"
      }
    };
  }
}

export {
  requestProposeTopicUpdates
};
