import {
  callLLM
} from "../../../infrastructure/llm/llm-client";
import {
  parseLLMResponse
} from "../../../infrastructure/llm/parseLLMResponse";
import {
  supportTextAnalysisResponseFormat
} from "./supportTextAnalysis.schema";

import type {
  RawSupportTextAnalysis,
  RequestSupportTextAnalysisInput
} from "./typesAnalyzeSupportText.types";

async function requestSupportTextAnalysis(
  input: RequestSupportTextAnalysisInput
): Promise<RawSupportTextAnalysis> {
  try {
    const result = await callLLM(input.prompt.messages, {
      stage: "support_text_analysis",
      preset: "fullWeightMessageAnalysis",
      temperature: 0,
      maxTokens: 2000,
      responseFormat: supportTextAnalysisResponseFormat
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
            ? `support_text_analysis_error:${error.message}`
            : "support_text_analysis_error:unknown_error"
      }
    };
  }
}

export {
  requestSupportTextAnalysis
};
