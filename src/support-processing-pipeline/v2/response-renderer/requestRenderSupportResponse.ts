import {
  callLLM
} from "../../../llm/llm-client";
import {
  parseLLMResponse
} from "../../../llm/parseLLMResponse";
import {
  renderSupportResponseResponseFormat
} from "./renderSupportResponse.schema";

import type {
  RawRenderSupportResponse,
  RequestRenderSupportResponseInput
} from "./typesRenderSupportResponse.types";

async function requestRenderSupportResponse(
  input: RequestRenderSupportResponseInput
): Promise<RawRenderSupportResponse> {
  try {
    const result = await callLLM(input.prompt.messages, {
      preset: "fullWeightMessageAnalysis",
      temperature: 0,
      maxTokens: 2500,
      responseFormat: renderSupportResponseResponseFormat
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
            ? `render_support_response_error:${error.message}`
            : "render_support_response_error:unknown_error"
      }
    };
  }
}

export {
  requestRenderSupportResponse
};
