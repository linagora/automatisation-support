/**
 * Image Analysis Request
 *
 * This file handles the API call to a vision model for analyzing
 * one image attachment.
 *
 * It receives the full attachmentAnalysis document and the attachmentIndex
 * of the image to analyze.
 *
 * It only produces a vision-level analysis.
 * It does not perform support-topic interpretation.
 */

import {
  buildImagePrompt
} from "./buildVisionPrompt";

import {
  callLLM
} from "../../../llm/llm-client";

import {
  parseLLMResponse
} from "../../../llm/parseLLMResponse";

import type {
  AttachmentAnalysisItem,
  ImageAnalysisInput,
  ImageAnalysisResult
} from "./typesAttachmentAnalysis.types";

type ParsedImageAnalysisResponse = {
  status?: unknown;
  reason?: unknown;
  llmDescription?: unknown;
  structuredObservations?: unknown;
  relationToPreviousAttachment?: unknown;
};

// Finds the attachmentAnalysis item targeted by attachmentIndex.
function getAttachmentAnalysisItem(
  input: ImageAnalysisInput
): AttachmentAnalysisItem | undefined {
  for (const attachmentAnalysisItem of input.attachmentAnalysis) {
    if (attachmentAnalysisItem.attachmentIndex === input.attachmentIndex) {
      return attachmentAnalysisItem;
    }
  }

  return undefined;
}

// Converts the parsed LLM response into the ImageAnalysisResult contract.
function buildImageAnalysisResultFromParsedResponse(
  parsedResponse: unknown
): ImageAnalysisResult {
  if (
    typeof parsedResponse !== "object" ||
    parsedResponse === null
  ) {
    return {
      status: "failed",
      reason: "invalid_llm_response_format",
      analysis: undefined
    };
  }

  const response = parsedResponse as ParsedImageAnalysisResponse;

  if (
    response.status !== undefined &&
    response.status !== "analyzed" &&
    response.status !== "suspicious"
  ) {
    return {
      status: "failed",
      reason: "invalid_image_analysis_status",
      analysis: undefined
    };
  }

  if (
    typeof response.llmDescription !== "string" ||
    response.llmDescription.trim().length === 0
  ) {
    return {
      status: "failed",
      reason: "missing_llm_description",
      analysis: undefined
    };
  }

  const analysis = {
    llmDescription: response.llmDescription,
    structuredObservations: response.structuredObservations,
    relationToPreviousAttachment:
      typeof response.relationToPreviousAttachment === "string"
        ? response.relationToPreviousAttachment
        : undefined
  };

  if (response.status === "suspicious") {
    return {
      status: "suspicious",
      reason:
        typeof response.reason === "string" &&
        response.reason.trim().length > 0
          ? response.reason
          : "suspicious_image_analysis",
      analysis
    };
  }

  return {
    status: "analyzed",
    reason: undefined,
    analysis
  };
}

async function requestImageAnalysis(
  input: ImageAnalysisInput
): Promise<ImageAnalysisResult> {
  const attachmentAnalysisItem = getAttachmentAnalysisItem(input);

  if (!attachmentAnalysisItem) {
    return {
      status: "failed",
      reason: `attachment_not_found:${input.attachmentIndex}`,
      analysis: undefined
    };
  }

  const imageLocation =
    attachmentAnalysisItem.url ||
    attachmentAnalysisItem.path;

  if (!imageLocation) {
    return {
      status: "failed",
      reason: `missing_image_location:${input.attachmentIndex}`,
      analysis: undefined
    };
  }

  try {
    const messages = buildImagePrompt({
      attachmentIndex: input.attachmentIndex,
      latestUserMessage: input.latestUserMessage,
      attachmentAnalysis: input.attachmentAnalysis,
      imageLocation
    });

    const result = await callLLM(messages, {
      preset: "imageAnalysis"
    });

    if (!result.success || !result.content) {
      return {
        status: "failed",
        reason: result.error || "llm_call_failed",
        analysis: undefined
      };
    }

    const parsedResponse = parseLLMResponse(result.content);

    return buildImageAnalysisResultFromParsedResponse(parsedResponse);
  } catch (error) {
    return {
      status: "failed",
      reason:
        error instanceof Error
          ? `image_analysis_error:${error.message}`
          : "image_analysis_error:unknown_error",
      analysis: undefined
    };
  }
}

export {
  requestImageAnalysis
};