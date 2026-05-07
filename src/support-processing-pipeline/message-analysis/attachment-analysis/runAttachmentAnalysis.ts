/**
 * Attachment Analysis Orchestrator
 *
 * This file prepares visual attachments for analysis.
 *
 * It checks whether attachments are present, whether they are analyzable,
 * and calls the appropriate analysis function based on attachment type (image or video).
 *
 * The real API calls to an LLM vision model are implemented in
 * requestImageAnalysis and requestVideoAnalysis.
 */

import {
  requestImageAnalysis
} from "./requestImageAnalysis";

import {
  requestVideoAnalysis
} from "./requestVideoAnalysis";

type UnknownObject = Record<string, unknown>;

interface Attachment {
  name?: string;
  type?: string;
  mimeType?: string;
  sizeBytes?: number;
  url?: string;
  path?: string;
  [key: string]: unknown;
}

interface RunAttachmentAnalysisInput {
  attachments?: Attachment[];
  latestUserMessage?: string;
  inputClean?: UnknownObject;
}

interface VisualAttachmentAnalyzerInput {
  attachments: Attachment[];
  latestUserMessage?: string;
}

interface VisualAttachmentAnalyzerOutput {
  extractedInformations: UnknownObject;
}

interface RunAttachmentAnalysisOutput {
  status: "not_present" | "not_analyzable" | "analyzed" | "analysis_not_available";
  analyzableAttachments: Attachment[];
  ignoredAttachments: Attachment[];
  reason: string | null;
  analysis: VisualAttachmentAnalyzerOutput | null;
}

function hasAttachments(attachments?: Attachment[]): boolean {
  return Array.isArray(attachments) && attachments.length > 0;
}

function getAttachmentName(attachment: Attachment): string {
  return typeof attachment.name === "string" ? attachment.name.toLowerCase() : "";
}

function getAttachmentMimeType(attachment: Attachment): string {
  return typeof attachment.mimeType === "string" ? attachment.mimeType.toLowerCase() : "";
}

function isVisualAttachment(attachment: Attachment): boolean {
  const name = getAttachmentName(attachment);
  const mimeType = getAttachmentMimeType(attachment);

  const visualExtensions = [
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
    ".mp4",
    ".mov",
    ".avi"
  ];

  const hasVisualMimeType =
    mimeType.startsWith("image/") ||
    mimeType.startsWith("video/");

  const hasVisualExtension = visualExtensions.some(function (extension) {
    return name.endsWith(extension);
  });

  return hasVisualMimeType || hasVisualExtension;
}

function isImageAttachment(attachment: Attachment): boolean {
  const name = getAttachmentName(attachment);
  const mimeType = getAttachmentMimeType(attachment);

  const imageExtensions = [
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif"
  ];

  const hasImageMimeType = mimeType.startsWith("image/");
  const hasImageExtension = imageExtensions.some(function (extension) {
    return name.endsWith(extension);
  });

  return hasImageMimeType || hasImageExtension;
}

function isVideoAttachment(attachment: Attachment): boolean {
  const name = getAttachmentName(attachment);
  const mimeType = getAttachmentMimeType(attachment);

  const videoExtensions = [
    ".mp4",
    ".mov",
    ".avi"
  ];

  const hasVideoMimeType = mimeType.startsWith("video/");
  const hasVideoExtension = videoExtensions.some(function (extension) {
    return name.endsWith(extension);
  });

  return hasVideoMimeType || hasVideoExtension;
}

function hasUsableLocation(attachment: Attachment): boolean {
  return (
    typeof attachment.url === "string" ||
    typeof attachment.path === "string"
  );
}

function isAttachmentSizeAcceptable(attachment: Attachment): boolean {
  if (typeof attachment.sizeBytes !== "number") {
    return false;
  }

  const maxSizeBytes = 25 * 1024 * 1024;

  return attachment.sizeBytes <= maxSizeBytes;
}

function isAnalyzableAttachment(attachment: Attachment): boolean {
  return (
    isVisualAttachment(attachment) &&
    hasUsableLocation(attachment) &&
    isAttachmentSizeAcceptable(attachment)
  );
}

function splitAttachmentsByAnalyzability(attachments: Attachment[]) {
  const analyzableAttachments: Attachment[] = [];
  const ignoredAttachments: Attachment[] = [];

  for (const attachment of attachments) {
    if (isAnalyzableAttachment(attachment)) {
      analyzableAttachments.push(attachment);
    } else {
      ignoredAttachments.push(attachment);
    }
  }

  return {
    analyzableAttachments,
    ignoredAttachments
  };
}

async function runAttachmentAnalysis(
  input: RunAttachmentAnalysisInput
): Promise<RunAttachmentAnalysisOutput> {
  const attachments = input.attachments || [];

  if (!hasAttachments(attachments)) {
    return {
      status: "not_present",
      analyzableAttachments: [],
      ignoredAttachments: [],
      reason: "no_attachment_provided",
      analysis: null
    };
  }

  const {
    analyzableAttachments,
    ignoredAttachments
  } = splitAttachmentsByAnalyzability(attachments);

  if (analyzableAttachments.length === 0) {
    return {
      status: "not_analyzable",
      analyzableAttachments: [],
      ignoredAttachments,
      reason: "no_analyzable_visual_attachment",
      analysis: null
    };
  }

  // Determine the type of attachments and call the appropriate analysis function
  const hasVideo = analyzableAttachments.some(isVideoAttachment);
  const hasImage = analyzableAttachments.some(isImageAttachment);

  let visualAttachmentAnalysis;

  if (hasVideo) {
    // If there are videos, use video analysis (even if mixed with images)
    visualAttachmentAnalysis = await requestVideoAnalysis({
      attachments: analyzableAttachments,
      latestUserMessage: input.latestUserMessage
    });
  } else if (hasImage) {
    // Only images, use image analysis
    visualAttachmentAnalysis = await requestImageAnalysis({
      attachments: analyzableAttachments,
      latestUserMessage: input.latestUserMessage
    });
  } else {
    // Unknown visual type, fallback to image analysis
    visualAttachmentAnalysis = await requestImageAnalysis({
      attachments: analyzableAttachments,
      latestUserMessage: input.latestUserMessage
    });
  }

  return {
    status: visualAttachmentAnalysis.status,
    analyzableAttachments,
    ignoredAttachments,
    reason: visualAttachmentAnalysis.reason,
    analysis: visualAttachmentAnalysis.analysis
  };
}

export {
  runAttachmentAnalysis,
  hasAttachments,
  isVisualAttachment,
  isImageAttachment,
  isVideoAttachment,
  hasUsableLocation,
  isAttachmentSizeAcceptable,
  isAnalyzableAttachment,
  splitAttachmentsByAnalyzability
};

export type {
  Attachment,
  RunAttachmentAnalysisInput,
  RunAttachmentAnalysisOutput,
  VisualAttachmentAnalyzerInput,
  VisualAttachmentAnalyzerOutput
};
