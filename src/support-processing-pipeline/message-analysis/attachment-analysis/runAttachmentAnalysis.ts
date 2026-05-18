/**
 * Attachment Analysis Orchestrator
 *
 * This file prepares visual attachments for analysis.
 *
 * It runs a local readiness decision for each attachment, then calls the
 * appropriate vision analysis function depending on the detected visual format.
 *
 * The output is a per-attachment analysis array.
 *
 * This orchestrator does not perform support-topic interpretation.
 * That responsibility remains in fullWeightMessageAnalysis.
 */

import {
  decideAttachmentReadiness
} from "./decideAttachmentReadiness";

import {
  requestImageAnalysis
} from "./requestImageAnalysis";

import {
  requestVideoAnalysis
} from "./requestVideoAnalysis";

import type {
  AttachmentAnalysis,
  AttachmentAnalysisInput,
  AttachmentAnalysisSteps
} from "./typesAttachmentAnalysis.types";

type AttachmentLike = AttachmentAnalysisInput["latestUserAttachments"][number];

function getAttachmentFilename(
  attachment: AttachmentLike,
  index: number
): string {
  const attachmentRecord = attachment as Record<string, unknown>;

  if (typeof attachmentRecord.name === "string" && attachmentRecord.name.length > 0) {
    return attachmentRecord.name;
  }

  return `attachment-${index + 1}`;
}

function getStringField(
  attachment: AttachmentLike,
  fieldName: string
): string | undefined {
  const attachmentRecord = attachment as Record<string, unknown>;
  const value = attachmentRecord[fieldName];

  return typeof value === "string" ? value : undefined;
}

function getNumberField(
  attachment: AttachmentLike,
  fieldName: string
): number | undefined {
  const attachmentRecord = attachment as Record<string, unknown>;
  const value = attachmentRecord[fieldName];

  return typeof value === "number" ? value : undefined;
}

function buildAttachmentMetadata(
  attachment: AttachmentLike,
  index: number
) {
  const type = getStringField(attachment, "type");
  const mimeType = getStringField(attachment, "mimeType");
  const sizeBytes = getNumberField(attachment, "sizeBytes");

  return {
    index,
    filename: getAttachmentFilename(attachment, index),
    ...(type ? { type } : {}),
    ...(mimeType ? { mimeType } : {}),
    ...(typeof sizeBytes === "number" ? { sizeBytes } : {})
  };
}

function buildRemainingAttachmentsMetadata(
  attachments: AttachmentLike[],
  currentIndex: number
) {
  return attachments
    .slice(currentIndex + 1)
    .map(function (attachment, offset) {
      const index = currentIndex + 1 + offset;

      return buildAttachmentMetadata(attachment, index);
    });
}

async function runAttachmentAnalysis(
  input: AttachmentAnalysisInput,
  steps: AttachmentAnalysisSteps = {}
): Promise<AttachmentAnalysis> {
  const attachmentAnalysisSteps: Required<AttachmentAnalysisSteps> = {
    decideAttachmentReadiness:
      steps.decideAttachmentReadiness || decideAttachmentReadiness,

    requestImageAnalysis:
      steps.requestImageAnalysis || requestImageAnalysis,

    requestVideoAnalysis:
      steps.requestVideoAnalysis || requestVideoAnalysis
  };

  const {
    latestUserMessage,
    latestUserAttachments
  } = input;

  const attachmentAnalysis: AttachmentAnalysis = [];

  for (let index = 0; index < latestUserAttachments.length; index++) {
    const attachment = latestUserAttachments[index];
    const filename = getAttachmentFilename(attachment, index);

    /* =====================================================
     * Prepare attachmentReadinessDecisionInput
     * ===================================================== */

    const attachmentReadinessDecisionInput = {
      attachment
    };

    const attachmentReadinessDecision =
      await attachmentAnalysisSteps.decideAttachmentReadiness(
        attachmentReadinessDecisionInput
      );

    /* =====================================================
     * route ?
     * attachmentReadinessDecision.decision.route
     * ===================================================== */

    switch (attachmentReadinessDecision.decision.route) {
      case "stop": {
        attachmentAnalysis.push({
          filename,
          status: "refused",
          reason: attachmentReadinessDecision.history.refusalReason,
          readinessDecision: attachmentReadinessDecision
        });

        continue;
      }

      case "continue": {
        break;
      }
    }

    /* =====================================================
     * Prepare attachmentSequenceContext
     * ===================================================== */

    const attachmentSequenceContext = {
      alreadyAnalyzedAttachments: attachmentAnalysis,
      remainingAttachmentsToAnalyze: buildRemainingAttachmentsMetadata(
        latestUserAttachments,
        index
      )
    };

    /* =====================================================
     * visual format ?
     * Only image or video can reach this point
     * ===================================================== */

    switch (attachmentReadinessDecision.history.detectedFormat) {
      case "image": {
        const imageAnalysisInput = {
          attachment,
          latestUserMessage,
          attachmentSequenceContext
        };

        const imageAnalysisResult =
          await attachmentAnalysisSteps.requestImageAnalysis(
            imageAnalysisInput
          );

        switch (imageAnalysisResult.status) {
          case "analyzed": {
            attachmentAnalysis.push({
              filename,
              status: "analyzed",
              readinessDecision: attachmentReadinessDecision,
              analysis: imageAnalysisResult.analysis
            });

            break;
          }

          case "failed": {
            attachmentAnalysis.push({
              filename,
              status: "failed",
              reason: imageAnalysisResult.reason,
              readinessDecision: attachmentReadinessDecision
            });

            break;
          }
        }

        break;
      }

      case "video": {
        const videoAnalysisInput = {
          attachment,
          latestUserMessage,
          attachmentSequenceContext
        };

        const videoAnalysisResult =
          await attachmentAnalysisSteps.requestVideoAnalysis(
            videoAnalysisInput
          );

        switch (videoAnalysisResult.status) {
          case "analyzed": {
            attachmentAnalysis.push({
              filename,
              status: "analyzed",
              readinessDecision: attachmentReadinessDecision,
              analysis: videoAnalysisResult.analysis
            });

            break;
          }

          case "failed": {
            attachmentAnalysis.push({
              filename,
              status: "failed",
              reason: videoAnalysisResult.reason,
              readinessDecision: attachmentReadinessDecision
            });

            break;
          }
        }

        break;
      }
    }
  }

  return attachmentAnalysis;
}

export {
  runAttachmentAnalysis
};