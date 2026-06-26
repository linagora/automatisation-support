import {
  callLLM
} from "../../../llm/llm-client";
import {
  parseLLMResponse
} from "../../../llm/parseLLMResponse";
import {
  composeSupportResponsePlanResponseFormat
} from "./composeSupportResponsePlan.schema";

import type {
  RawComposeSupportResponsePlan,
  RequestComposeSupportResponsePlanInput
} from "./typesComposeSupportResponsePlan.types";

async function requestComposeSupportResponsePlan(
  input: RequestComposeSupportResponsePlanInput
): Promise<RawComposeSupportResponsePlan> {
  try {
    const result = await callLLM(input.prompt.messages, {
      stage: "compose_support_response_plan",
      preset: "fullWeightMessageAnalysis",
      temperature: 0,
      maxTokens: 2500,
      responseFormat: composeSupportResponsePlanResponseFormat
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
        message: error instanceof Error
          ? `compose_support_response_plan_error:${error.message}`
          : "compose_support_response_plan_error:unknown_error"
      }
    };
  }
}

export {
  requestComposeSupportResponsePlan
};
