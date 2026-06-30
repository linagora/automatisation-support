import {
  callLLM
} from "../../llm/llm-client";
import {
  parseLLMResponse
} from "../../llm/parseLLMResponse";
import {
  planSupportResponseResponseFormat
} from "./planSupportResponse.schema";

import type {
  RawPlanSupportResponse,
  RequestPlanSupportResponseInput
} from "./typesPlanSupportResponse.types";

async function requestPlanSupportResponse(
  input: RequestPlanSupportResponseInput
): Promise<RawPlanSupportResponse> {
  try {
    const result = await callLLM(input.prompt.messages, {
      stage: "response_plan",
      preset: "fullWeightMessageAnalysis",
      temperature: 0,
      maxTokens: 3500,
      responseFormat: planSupportResponseResponseFormat
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
            ? `plan_support_response_error:${error.message}`
            : "plan_support_response_error:unknown_error"
      }
    };
  }
}

export {
  requestPlanSupportResponse
};
