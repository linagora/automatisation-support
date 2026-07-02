// src/archive/support-processing-pipeline/message-analysis/fullweight-message-analysis/requestFullWeightAnalysis.ts

/**
 * Full Weight Analysis Request
 *
 * This file handles the API call to the text model for analyzing
 * the latest user message with full support context.
 *
 * It receives the already-built fullWeightPrompt.
 *
 * It only:
 * - sends the systemPrompt and userPrompt to the LLM
 * - parses the LLM response
 * - returns a raw full-weight analysis result
 *
 * It does not validate the final analysis contract.
 * Final validation is handled by formatFullWeightMessageAnalysisOutput.
 */

import {
  callLLM
} from "../../../../infrastructure/llm/llm-client";

import {
  parseLLMResponse
} from "../../../../infrastructure/llm/parseLLMResponse";

import type {
  RequestFullWeightAnalysisInput,
  RawFullWeightMessageAnalysis
} from "./typesFullWeightMessageAnalysis.types";

import {
  fullWeightMessageAnalysisResponseFormat
} from "./fullWeightMessageAnalysis.schema";

function shouldDebugFullWeightAnalysis(): boolean {
  return process.env.SUPPORT_PROCESSING_DEBUG === "true";
}

function logDebugStep(title: string, value: unknown): void {
  if (!shouldDebugFullWeightAnalysis()) {
    return;
  }

  console.log(`\n--- DEBUG ${title} ---`);
  console.log(
    typeof value === "string"
      ? value
      : JSON.stringify(value, null, 2)
  );
}

async function requestFullWeightAnalysis(
  input: RequestFullWeightAnalysisInput
): Promise<RawFullWeightMessageAnalysis> {
  try {
    const result = await callLLM(
  [
    {
      role: "system",
      content: input.fullWeightPrompt.systemPrompt
    },
    {
      role: "user",
      content: input.fullWeightPrompt.userPrompt
    }
  ],
  {
    preset: "fullWeightMessageAnalysis",
    responseFormat: fullWeightMessageAnalysisResponseFormat
  }
);


    if (!result.success || !result.content) {
      logDebugStep("fullWeight raw LLM failure", {
        error: result.error,
        rawResponse: result.content
      });

      return {
        status: "failed",
        rawResponse: result.content,
        error: {
          message: result.error || "llm_call_failed"
        }
      };
    }

    logDebugStep("fullWeight raw LLM output", result.content);

    const parsedResponse = parseLLMResponse(result.content);

    logDebugStep("fullWeight parsed JSON", parsedResponse);

    return {
      status: "completed",
      parsedResponse,
      rawResponse: result.content
    };
  } catch (error) {
    return {
      status: "failed",
      error: {
        message:
          error instanceof Error
            ? `full_weight_analysis_error:${error.message}`
            : "full_weight_analysis_error:unknown_error"
      }
    };
  }
}

export {
  requestFullWeightAnalysis
};
