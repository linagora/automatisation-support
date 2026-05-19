/**
 * Local readiness decision for one attachment.
 *
 * This function checks whether the attachment can be sent to a vision analysis
 * function. It does not call any LLM.
 */

import type {
  AttachmentAnalysisItem,
  AttachmentReadinessCheckName,
  AttachmentReadinessDecision,
  AttachmentReadinessDecisionInput
} from "./typesAttachmentAnalysis.types";

const MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024;

const IMAGE_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif"
];

const VIDEO_EXTENSIONS = [
  "mp4",
  "mov",
  "avi",
  "webm"
];

function getExtension(filename: string | undefined): string | undefined {
  if (!filename) {
    return undefined;
  }

  const extension = filename.split(".").pop();

  return extension ? extension.toLowerCase() : undefined;
}

function formatFromMimeType(
  mimeType: string | undefined
): "image" | "video" | "other" {
  if (!mimeType) {
    return "other";
  }

  const normalizedMimeType = mimeType.toLowerCase();

  if (normalizedMimeType.startsWith("image/")) {
    return "image";
  }

  if (normalizedMimeType.startsWith("video/")) {
    return "video";
  }

  return "other";
}

function formatFromExtension(
  filename: string | undefined
): "image" | "video" | "other" {
  const extension = getExtension(filename);

  if (!extension) {
    return "other";
  }

  if (IMAGE_EXTENSIONS.includes(extension)) {
    return "image";
  }

  if (VIDEO_EXTENSIONS.includes(extension)) {
    return "video";
  }

  return "other";
}

function detectAttachmentFormat(
  attachment: AttachmentAnalysisItem
): "image" | "video" | "other" {
  const mimeFormat = formatFromMimeType(attachment.mimeType);

  if (mimeFormat !== "other") {
    return mimeFormat;
  }

  return formatFromExtension(attachment.filename);
}

function safe_filename(
  filename: string | undefined
): boolean {
  if (filename === undefined) {
    return true;
  }

  return (
    filename.length > 0 &&
    !filename.includes("\0") &&
    !filename.includes("/") &&
    !filename.includes("\\") &&
    !filename.includes("..")
  );
}

function accepted_format(
  detectedFormat: "image" | "video" | "other"
): boolean {
  return detectedFormat === "image" || detectedFormat === "video";
}

function consistent_mime_extension(
  attachment: AttachmentAnalysisItem
): boolean {
  const mimeFormat = formatFromMimeType(attachment.mimeType);
  const extensionFormat = formatFromExtension(attachment.filename);

  if (mimeFormat === "other" || extensionFormat === "other") {
    return true;
  }

  return mimeFormat === extensionFormat;
}

function usable_location(
  attachment: AttachmentAnalysisItem
): boolean {
  return (
    typeof attachment.url === "string" && attachment.url.length > 0
  ) || (
    typeof attachment.path === "string" && attachment.path.length > 0
  );
}

function safe_url(
  url: string | undefined
): boolean {
  if (url === undefined) {
    return false;
  }

  if (url.startsWith("data:image/")) {
    return true;
  }

  try {
    const parsedUrl = new URL(url);

    return (
      parsedUrl.protocol === "http:" ||
      parsedUrl.protocol === "https:"
    );
  } catch {
    return false;
  }
}

function safe_path(
  path: string | undefined
): boolean {
  if (path === undefined) {
    return false;
  }

  return (
    path.length > 0 &&
    !path.includes("\0") &&
    !path.includes("..")
  );
}

function safe_location(
  attachment: AttachmentAnalysisItem
): boolean {
  return (
    safe_url(attachment.url) ||
    safe_path(attachment.path)
  );
}

function present_size(
  sizeBytes: number | undefined
): boolean {
  return typeof sizeBytes === "number";
}

function positive_size(
  sizeBytes: number | undefined
): boolean {
  return typeof sizeBytes === "number" && sizeBytes > 0;
}

function size_under_limit(
  sizeBytes: number | undefined
): boolean {
  return (
    typeof sizeBytes === "number" &&
    sizeBytes <= MAX_ATTACHMENT_SIZE_BYTES
  );
}

function addReadinessCheck(
  checkName: AttachmentReadinessCheckName,
  result: boolean,
  checked: AttachmentReadinessCheckName[],
  failed: AttachmentReadinessCheckName[]
): void {
  if (result) {
    checked.push(checkName);
  } else {
    failed.push(checkName);
  }
}

function getAttachmentByIndex(
  attachmentIndex: number,
  attachmentAnalysis: AttachmentAnalysisItem[]
): AttachmentAnalysisItem {
  const attachment = attachmentAnalysis.find(function (item) {
    return item.attachmentIndex === attachmentIndex;
  });

  if (!attachment) {
    throw new Error(`Attachment with index ${attachmentIndex} was not found.`);
  }

  return attachment;
}

function decideAttachmentReadiness(
  input: AttachmentReadinessDecisionInput
): AttachmentReadinessDecision {
  const attachment = getAttachmentByIndex(
    input.attachmentIndex,
    input.attachmentAnalysis
  );

  const checked: AttachmentReadinessCheckName[] = [];
  const failed: AttachmentReadinessCheckName[] = [];

  const detectedFormat = detectAttachmentFormat(attachment);

  addReadinessCheck(
    "safe_filename",
    safe_filename(attachment.filename),
    checked,
    failed
  );

  addReadinessCheck(
    "accepted_format",
    accepted_format(detectedFormat),
    checked,
    failed
  );

  addReadinessCheck(
    "consistent_mime_extension",
    consistent_mime_extension(attachment),
    checked,
    failed
  );

  addReadinessCheck(
    "usable_location",
    usable_location(attachment),
    checked,
    failed
  );

  addReadinessCheck(
    "safe_location",
    safe_location(attachment),
    checked,
    failed
  );

  addReadinessCheck(
    "present_size",
    present_size(attachment.sizeBytes),
    checked,
    failed
  );

  addReadinessCheck(
    "positive_size",
    positive_size(attachment.sizeBytes),
    checked,
    failed
  );

  addReadinessCheck(
    "size_under_limit",
    size_under_limit(attachment.sizeBytes),
    checked,
    failed
  );

  return {
    decision: {
      route: failed.length === 0 ? "continue" : "stop"
    },
    history: {
      checked,
      failed,
      detectedFormat
    }
  };
}

export {
  decideAttachmentReadiness
};