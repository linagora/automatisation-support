/**
 * Image Analysis Request
 *
 * This file handles the API call to an LLM vision model for analyzing
 * image attachments.
 *
 * It builds the appropriate prompts, calls the LLM API with the imageAnalysis preset,
 * and parses the response into a structured format.
 */

import type {
  Attachment,
  VisualAttachmentAnalyzerOutput
} from "./runAttachmentAnalysis";
import { buildImagePrompt } from "./buildVisualPrompt";
import { callLLM } from "../../../llm/llm-client";
import { parseLLMResponse } from "../../../llm/parseLLMResponse";

interface RequestImageAnalysisInput {
  attachments: Attachment[];
  latestUserMessage?: string;
}

interface RequestImageAnalysisOutput {
  status: "analyzed" | "analysis_not_available";
  analysis: VisualAttachmentAnalyzerOutput | null;
  reason: string | null;
}

/**
 * Request image analysis from LLM
 * @param input - The input containing image attachments and optional message
 * @returns The analysis result
 */
async function requestImageAnalysis(
  input: RequestImageAnalysisInput
): Promise<RequestImageAnalysisOutput> {
  const { attachments, latestUserMessage } = input;

  try {
    const messages = buildImagePrompt(attachments, latestUserMessage);

    const result = await callLLM(messages, { preset: "imageAnalysis" });

    if (!result.success || !result.content) {
      return {
        status: "analysis_not_available",
        analysis: null,
        reason: result.error || "llm_call_failed"
      };
    }

    const parsedResponse = parseLLMResponse(result.content);

    if (!parsedResponse) {
      return {
        status: "analysis_not_available",
        analysis: null,
        reason: "failed_to_parse_llm_response"
      };
    }

    return {
      status: "analyzed",
      analysis: {
        extractedInformations: parsedResponse
      },
      reason: null
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "unknown_error";

    return {
      status: "analysis_not_available",
      analysis: null,
      reason: `analysis_error: ${errorMessage}`
    };
  }
}

export {
  requestImageAnalysis
};

export type {
  RequestImageAnalysisInput,
  RequestImageAnalysisOutput
};
