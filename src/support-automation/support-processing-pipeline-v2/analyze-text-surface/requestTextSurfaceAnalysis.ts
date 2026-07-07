import {
  callLLM
} from "../../../infrastructure/llm/llm-client";
import {
  parseLLMResponse
} from "../../../infrastructure/llm/parseLLMResponse";
import {
  textSurfaceAnalysisResponseFormat
} from "./textSurfaceAnalysis.schema";

import type {
  RawTextSurfaceAnalysis,
  RequestTextSurfaceAnalysisInput
} from "./typesAnalyzeTextSurface.types";

async function requestTextSurfaceAnalysis(
  input: RequestTextSurfaceAnalysisInput
): Promise<RawTextSurfaceAnalysis> {
  try {
    const result = await callLLM(input.prompt.messages, {
      stage: "text_surface_analysis",
      preset: "quickDecision",
      temperature: 0,
      maxTokens: 500,
      responseFormat: textSurfaceAnalysisResponseFormat
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
            ? `text_surface_analysis_error:${error.message}`
            : "text_surface_analysis_error:unknown_error"
      }
    };
  }
}

export {
  requestTextSurfaceAnalysis
};
