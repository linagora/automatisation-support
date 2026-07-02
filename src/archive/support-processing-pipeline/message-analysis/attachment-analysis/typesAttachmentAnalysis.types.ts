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
  AttachmentAnalysisItem,
  AttachmentReadinessCheckName,
  AttachmentReadinessDecision,
  AttachmentVisionAnalysis,
  LatestUserAttachment,
  LatestUserMessage
} from "../../typesSupportProcessingPipeline.types";

export type {
  AttachmentAnalysisItem,
  AttachmentAnalysisStatus,
  AttachmentDetectedFormat,
  AttachmentReadinessCheckName,
  AttachmentReadinessDecision,
  AttachmentVisionAnalysis,
  AttachmentVisionObservations
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

export type AttachmentReadinessDecisionInput = {
  attachmentIndex: number;
  attachmentAnalysis: AttachmentAnalysis;
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
