/**
 * Shared types for the attachment-analysis pipeline.
 *
 * This file defines the local attachment analysis contract used by:
 * - runAttachmentAnalysis
 * - decideAttachmentReadiness
 * - requestImageAnalysis
 * - requestVideoAnalysis
 *
 * The attachment-analysis pipeline produces a per-attachment analysis.
 * It does not perform support-topic interpretation. That responsibility
 * remains in fullWeightMessageAnalysis.
 */

import type {
  LatestUserAttachment,
  LatestUserMessage
} from "../../typesSupportProcessingPipeline.types";

/* =====================================================
 * Attachment analysis input
 * ===================================================== */

export type AttachmentAnalysisInput = {
  latestUserMessage: LatestUserMessage;
  latestUserAttachments: LatestUserAttachment[];
};

/* =====================================================
 * Attachment readiness decision
 * ===================================================== */

type AttachmentReadinessRoute =
  | "continue"
  | "stop";

type AttachmentDetectedFormat =
  | "image"
  | "video"
  | "other";

export type AttachmentReadinessCheckName =
  | "safe_filename"
  | "accepted_format"
  | "consistent_mime_extension"
  | "usable_location"
  | "safe_location"
  | "present_size"
  | "positive_size"
  | "size_under_limit";

export type AttachmentReadinessDecisionInput = {
  attachmentIndex: number;
  attachmentAnalysis: AttachmentAnalysis;
};

export type AttachmentReadinessDecision = {
  decision: {
    route: AttachmentReadinessRoute;
  };
  history: {
    checked: AttachmentReadinessCheckName[];
    failed: AttachmentReadinessCheckName[];
    detectedFormat: AttachmentDetectedFormat;
  };
};

/* =====================================================
 * Attachment vision analysis
 * ===================================================== */

type AttachmentVisionObservations = {
  other?: unknown;
};

type AttachmentVisionAnalysis = {
  visionDescription: string;
  visionObservations?: AttachmentVisionObservations;
  relationToPreviousAttachment?: string;
};

/* =====================================================
 * Attachment vision analysis result
 * ===================================================== */

type AttachmentVisionAnalysisResult =
  | {
      status: "analyzed";
      reason?: undefined;
      analysis: AttachmentVisionAnalysis;
    }
  | {
      status: "failed";
      reason: string;
      analysis?: undefined;
    }
  | {
      status: "suspicious";
      reason: string;
      analysis: AttachmentVisionAnalysis;
    };

/* =====================================================
 * Attachment analysis item
 * ===================================================== */

export type AttachmentAnalysisItem = {
  attachmentIndex: number;
  filename: string | undefined;
  url: string | undefined;
  path: string | undefined;
  type: string | undefined;
  mimeType: string | undefined;
  sizeBytes: number | undefined;
  status:
    | "analysis_pending"
    | "analyzed"
    | "failed"
    | "refused"
    | "suspicious";
  reason: string | undefined;
  readinessDecision: AttachmentReadinessDecision | undefined;
  analysis: AttachmentVisionAnalysis | undefined;
};

export type AttachmentAnalysis = AttachmentAnalysisItem[];

/* =====================================================
 * Image analysis
 * ===================================================== */

export type ImageAnalysisInput = {
  attachmentIndex: number;
  latestUserMessage: LatestUserMessage;
  attachmentAnalysis: AttachmentAnalysis;
};

export type ImageAnalysisResult = AttachmentVisionAnalysisResult;

/* =====================================================
 * Video analysis
 * ===================================================== */

export type VideoAnalysisInput = {
  attachmentIndex: number;
  latestUserMessage: LatestUserMessage;
  attachmentAnalysis: AttachmentAnalysis;
};

export type VideoAnalysisResult = AttachmentVisionAnalysisResult;

/* =====================================================
 * Attachment analysis steps
 * ===================================================== */

export type AttachmentAnalysisSteps = {
  decideAttachmentReadiness?: (
    input: AttachmentReadinessDecisionInput
  ) => AttachmentReadinessDecision | Promise<AttachmentReadinessDecision>;

  requestImageAnalysis?: (
    input: ImageAnalysisInput
  ) => ImageAnalysisResult | Promise<ImageAnalysisResult>;

  requestVideoAnalysis?: (
    input: VideoAnalysisInput
  ) => VideoAnalysisResult | Promise<VideoAnalysisResult>;
};