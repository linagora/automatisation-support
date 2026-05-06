/**
 * Visual attachment analysis request
 *
 * This file handles the API call to an LLM vision model for analyzing
 * visual attachments (images and videos).
 *
 * It builds the appropriate prompts, calls the LLM API, and parses
 * the response into a structured format.
 */

import type {
  Attachment,
  VisualAttachmentAnalyzerOutput
} from "./runAttachmentDescriptionLLM";
import { buildVisionMessages } from "./visual-analysis-prompts";
import { callVisionLLM, parseLLMResponse } from "./llm-client";

interface RequestVisualAttachmentAnalysisInput {
  attachments: Attachment[];
  latestUserMessage?: string;
}

interface RequestVisualAttachmentAnalysisOutput {
  status: "analyzed" | "analysis_not_available";
  analysis: VisualAttachmentAnalyzerOutput | null;
  reason: string | null;
}

/**
 * Request visual attachment analysis from LLM
 * @param input - The input containing attachments and optional message
 * @returns The analysis result
 */
async function requestVisualAttachmentAnalysis(
  input: RequestVisualAttachmentAnalysisInput
): Promise<RequestVisualAttachmentAnalysisOutput> {
  const { attachments, latestUserMessage } = input;

  try {
    const messages = buildVisionMessages(attachments, latestUserMessage);

    const result = await callVisionLLM(messages);

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
  requestVisualAttachmentAnalysis
};

export type {
  RequestVisualAttachmentAnalysisInput,
  RequestVisualAttachmentAnalysisOutput
};