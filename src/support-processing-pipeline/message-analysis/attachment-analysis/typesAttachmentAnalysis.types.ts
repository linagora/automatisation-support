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
 * Generic helpers
 * ===================================================== */

type MaybePromise<T> = T | Promise<T>;

type AttachmentAnalysisStep<TInput, TOutput> = (
  input: TInput
) => MaybePromise<TOutput>;

type NonEmptyArray<T> = [T, ...T[]];

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

type AttachmentReadinessDecisionRoute =
  | "continue"
  | "stop";

type AttachmentDetectedFormat =
  | "image"
  | "video"
  | "unknown";

type AttachmentVisualFormat = Exclude<
  AttachmentDetectedFormat,
  "unknown"
>;

export type AttachmentReadinessCheckName =
  | "filename_safe"
  | "supported_visual_format"
  | "mime_extension_consistent"
  | "usable_location"
  | "safe_location"
  | "size_present"
  | "size_positive"
  | "size_under_limit";

export type AttachmentRefusalReason =
  | "unsafe_filename"
  | "unsupported_visual_format"
  | "mime_extension_mismatch"
  | "missing_location"
  | "unsafe_location"
  | "missing_size"
  | "invalid_size"
  | "size_too_large";

export type AttachmentReadinessDecisionInput = {
  attachment: LatestUserAttachment;
};

type AttachmentReadinessContinueDecision = {
  decision: {
    route: Extract<AttachmentReadinessDecisionRoute, "continue">;
  };
  history: {
    checked: AttachmentReadinessCheckName[];
    failed: [];
    detectedFormat: AttachmentVisualFormat;
  };
};

type AttachmentReadinessStopDecision = {
  decision: {
    route: Extract<AttachmentReadinessDecisionRoute, "stop">;
  };
  history: {
    checked: AttachmentReadinessCheckName[];
    failed: NonEmptyArray<AttachmentReadinessCheckName>;
    detectedFormat: AttachmentDetectedFormat;
    refusalReason: AttachmentRefusalReason;
  };
};

export type AttachmentReadinessDecision =
  | AttachmentReadinessContinueDecision
  | AttachmentReadinessStopDecision;

/* =====================================================
 * Attachment sequence context
 * ===================================================== */

type AttachmentMetadata = {
  index: number;
  filename: string;
  type?: string;
  mimeType?: string;
  sizeBytes?: number;
};

type AttachmentSequenceContext = {
  alreadyAnalyzedAttachments: AttachmentAnalysis;
  remainingAttachmentsToAnalyze: AttachmentMetadata[];
};

/* =====================================================
 * Vision analysis shared types
 * ===================================================== */

type AttachmentStructuredObservations = unknown;

type AttachmentLlmAnalysis = {
  llmDescription: string;
  structuredObservations?: AttachmentStructuredObservations;
  relationToPreviousAttachment?: string;
};

type AttachmentVisionAnalysisFailureReason =
  | "vision_model_unavailable"
  | "vision_model_timeout"
  | "vision_model_refused"
  | "empty_analysis"
  | "invalid_analysis_output"
  | "unknown_analysis_failure";

type AttachmentVisionAnalysisResult =
  | {
      status: "analyzed";
      analysis: AttachmentLlmAnalysis;
    }
  | {
      status: "failed";
      reason: AttachmentVisionAnalysisFailureReason;
    };

/* =====================================================
 * Image analysis
 * ===================================================== */

export type ImageAnalysisInput = {
  attachment: LatestUserAttachment;
  latestUserMessage: LatestUserMessage;
  attachmentSequenceContext: AttachmentSequenceContext;
};

export type ImageAnalysisResult = AttachmentVisionAnalysisResult;

/* =====================================================
 * Video analysis
 * ===================================================== */

export type VideoAnalysisInput = {
  attachment: LatestUserAttachment;
  latestUserMessage: LatestUserMessage;
  attachmentSequenceContext: AttachmentSequenceContext;
};

export type VideoAnalysisResult = AttachmentVisionAnalysisResult;

/* =====================================================
 * Attachment analysis item
 * ===================================================== */

type AttachmentAnalyzedItem = {
  filename: string;
  status: "analyzed";
  readinessDecision: AttachmentReadinessContinueDecision;
  analysis: AttachmentLlmAnalysis;
};

type AttachmentFailedItem = {
  filename: string;
  status: "failed";
  reason: AttachmentVisionAnalysisFailureReason;
  readinessDecision: AttachmentReadinessContinueDecision;
};

type AttachmentRefusedItem = {
  filename: string;
  status: "refused";
  reason: AttachmentRefusalReason;
  readinessDecision: AttachmentReadinessStopDecision;
};

type AttachmentAnalysisItem =
  | AttachmentAnalyzedItem
  | AttachmentFailedItem
  | AttachmentRefusedItem;

export type AttachmentAnalysis = AttachmentAnalysisItem[];

/* =====================================================
 * Attachment analysis steps
 * ===================================================== */

export type AttachmentAnalysisSteps = {
  decideAttachmentReadiness?: AttachmentAnalysisStep<
    AttachmentReadinessDecisionInput,
    AttachmentReadinessDecision
  >;

  requestImageAnalysis?: AttachmentAnalysisStep<
    ImageAnalysisInput,
    ImageAnalysisResult
  >;

  requestVideoAnalysis?: AttachmentAnalysisStep<
    VideoAnalysisInput,
    VideoAnalysisResult
  >;
};