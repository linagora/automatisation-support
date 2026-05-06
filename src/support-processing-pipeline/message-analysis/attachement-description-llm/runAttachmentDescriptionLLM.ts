/**
 * LLM attachment description
 *
 * This file prepares visual attachments for analysis.
 *
 * It checks whether attachments are present, whether they are analyzable,
 * and calls a visual attachment analysis function.
 *
 * The real API call to an LLM vision model is implemented in
 * requestVisualAttachmentAnalysis.
 */

import {
  requestVisualAttachmentAnalysis
} from "./requestVisualAttachmentAnalysis";

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

interface RunAttachmentDescriptionLLMInput {
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

interface RunAttachmentDescriptionLLMOutput {
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

function hasUsableLocation(attachment: Attachment): boolean {
  return (
    typeof attachment.url === "string" ||
    typeof attachment.path === "string"
  );
}

function isAttachmentSizeAcceptable(attachment: Attachment): boolean {
  if (typeof attachment.sizeBytes !== "number") {
    return true;
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

async function runAttachmentDescriptionLLM(
  input: RunAttachmentDescriptionLLMInput
): Promise<RunAttachmentDescriptionLLMOutput> {
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

  const visualAttachmentAnalysis = await requestVisualAttachmentAnalysis({
    attachments: analyzableAttachments,
    latestUserMessage: input.latestUserMessage
  });

  return {
    status: visualAttachmentAnalysis.status,
    analyzableAttachments,
    ignoredAttachments,
    reason: visualAttachmentAnalysis.reason,
    analysis: visualAttachmentAnalysis.analysis
  };
}

export {
  runAttachmentDescriptionLLM,
  hasAttachments,
  isVisualAttachment,
  hasUsableLocation,
  isAttachmentSizeAcceptable,
  isAnalyzableAttachment,
  splitAttachmentsByAnalyzability
};

export type {
  Attachment,
  RunAttachmentDescriptionLLMInput,
  RunAttachmentDescriptionLLMOutput,
  VisualAttachmentAnalyzerInput,
  VisualAttachmentAnalyzerOutput
};