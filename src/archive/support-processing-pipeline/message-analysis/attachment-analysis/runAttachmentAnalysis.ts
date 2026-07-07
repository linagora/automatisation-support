/**
 * Attachment Analysis Orchestrator
 *
 * This file prepares visual attachments for analysis.
 *
 * It first initializes a complete attachmentAnalysis document with all
 * attachments marked as analysis_pending.
 *
 * Then, for each attachmentAnalysis item, it runs a local readiness decision
 * and updates the corresponding item in the attachmentAnalysis document.
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
  LatestUserAttachment
} from "../../typesSupportProcessingPipeline.types";

import type {
  AttachmentAnalysis,
  AttachmentAnalysisInput,
  AttachmentAnalysisItem,
  AttachmentAnalysisSteps
} from "./typesAttachmentAnalysis.types";

// Builds the initial analysis_pending item for one attachment.
function buildInitialAttachmentAnalysisItem(
  attachment: LatestUserAttachment,
  attachmentIndex: number
): AttachmentAnalysisItem {
  return {
    attachmentIndex,
    filename: attachment.name,
    url: attachment.url,
    path: attachment.path,
    type: attachment.type,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    status: "analysis_pending",
    reason: undefined,
    readinessDecision: undefined,
    analysis: undefined
  };
}

// Initializes the complete attachmentAnalysis document before any analysis starts.
function initializeAttachmentAnalysis(
  attachments: LatestUserAttachment[]
): AttachmentAnalysis {
  const attachmentAnalysis: AttachmentAnalysis = [];

  for (let arrayIndex = 0; arrayIndex < attachments.length; arrayIndex++) {
    const attachment = attachments[arrayIndex];
    const attachmentIndex = arrayIndex + 1;

    const attachmentAnalysisItem = buildInitialAttachmentAnalysisItem(
      attachment,
      attachmentIndex
    );

    attachmentAnalysis.push(attachmentAnalysisItem);
  }

  return attachmentAnalysis;
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

  /* =====================================================
   * Initialize output
   * ===================================================== */

  const attachmentAnalysis = initializeAttachmentAnalysis(
    latestUserAttachments
  );

  /* =====================================================
   * For each item in attachmentAnalysis
   * ===================================================== */

  for (
    let arrayIndex = 0;
    arrayIndex < attachmentAnalysis.length;
    arrayIndex++
  ) {
    const attachmentIndex =
      attachmentAnalysis[arrayIndex].attachmentIndex ?? arrayIndex + 1;

    /* =====================================================
     * Prepare attachmentReadinessDecisionInput
     * ===================================================== */

    const attachmentReadinessDecisionInput = {
      attachmentIndex,
      attachmentAnalysis
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
        attachmentAnalysis[arrayIndex] = {
          ...attachmentAnalysis[arrayIndex],
          status: "refused",
          reason:
            attachmentReadinessDecision.history.failed.join(", ") ||
            "attachment_readiness_failed",
          readinessDecision: attachmentReadinessDecision,
          analysis: undefined
        };

        break;
      }

      case "continue": {
        attachmentAnalysis[arrayIndex] = {
          ...attachmentAnalysis[arrayIndex],
          readinessDecision: attachmentReadinessDecision
        };

        /* =====================================================
         * vision format ?
         * Only image or video can reach this point
         * ===================================================== */

        switch (attachmentReadinessDecision.history.detectedFormat) {
          case "image": {
            const imageAnalysisInput = {
              attachmentIndex,
              latestUserMessage,
              attachmentAnalysis
            };

            const imageAnalysisResult =
              await attachmentAnalysisSteps.requestImageAnalysis(
                imageAnalysisInput
              );

            switch (imageAnalysisResult.status) {
              case "analyzed": {
                attachmentAnalysis[arrayIndex] = {
                  ...attachmentAnalysis[arrayIndex],
                  status: "analyzed",
                  reason: undefined,
                  analysis: imageAnalysisResult.analysis
                };

                break;
              }

              case "failed": {
                attachmentAnalysis[arrayIndex] = {
                  ...attachmentAnalysis[arrayIndex],
                  status: "failed",
                  reason: imageAnalysisResult.reason,
                  analysis: undefined
                };

                break;
              }

              case "suspicious": {
                attachmentAnalysis[arrayIndex] = {
                  ...attachmentAnalysis[arrayIndex],
                  status: "suspicious",
                  reason: imageAnalysisResult.reason,
                  analysis: imageAnalysisResult.analysis
                };

                break;
              }
            }

            break;
          }

          case "video": {
            const videoAnalysisInput = {
              attachmentIndex,
              latestUserMessage,
              attachmentAnalysis
            };

            const videoAnalysisResult =
              await attachmentAnalysisSteps.requestVideoAnalysis(
                videoAnalysisInput
              );

            switch (videoAnalysisResult.status) {
              case "analyzed": {
                attachmentAnalysis[arrayIndex] = {
                  ...attachmentAnalysis[arrayIndex],
                  status: "analyzed",
                  reason: undefined,
                  analysis: videoAnalysisResult.analysis
                };

                break;
              }

              case "failed": {
                attachmentAnalysis[arrayIndex] = {
                  ...attachmentAnalysis[arrayIndex],
                  status: "failed",
                  reason: videoAnalysisResult.reason,
                  analysis: undefined
                };

                break;
              }

              case "suspicious": {
                attachmentAnalysis[arrayIndex] = {
                  ...attachmentAnalysis[arrayIndex],
                  status: "suspicious",
                  reason: videoAnalysisResult.reason,
                  analysis: videoAnalysisResult.analysis
                };

                break;
              }
            }

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
