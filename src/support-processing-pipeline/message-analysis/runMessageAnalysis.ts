/**
 * Message Analysis orchestrator.
 */

import { runRawInputSafetyGate } from "./safety-functions/raw-input-safety/runRawInputSafetyGate";
import { decideRawInputTrustConsistency } from "./safety-functions/raw-input-safety/decideRawInputTrustConsistency";
import { runRawInputSafetyReviewLlmTruster } from "./safety-functions/raw-input-safety/runRawInputSafetyReviewLlmTruster";

import { runAttachmentAnalysisSafetyGate } from "./safety-functions/attachment-safety/runAttachmentAnalysisSafetyGate";
import { decideAttachmentTrustConsistency } from "./safety-functions/attachment-safety/decideAttachmentTrustConsistency";
import { runAttachmentSafetyReviewLlmTruster } from "./safety-functions/attachment-safety/runAttachmentSafetyReviewLlmTruster";

import { runAttachmentAnalysis } from "./attachment-analysis/runAttachmentAnalysis";
import { runAnalysisGate } from "./analysis-gate/runAnalysisGate";
import { runLightweightMessageAnalysis } from "./lightweight-message-analysis/runLightweightMessageAnalysis";
import { runFullweightMessageAnalysis } from "./fullweight-message-analysis/runFullweightMessageAnalysis";
import { assembleTurnUnderstandingDelta } from "./turn-understanding-delta/assembleTurnUnderstandingDelta";

import type {
  AnalysisGate,
  AnalysisGateInput,
  AttachmentAnalysis,
  AttachmentAnalysisInput,
  AttachmentAnalysisSafetyGate,
  AttachmentAnalysisSafetyGateInput,
  AttachmentSafetyReview,
  AttachmentSafetyReviewInput,
  AttachmentTrustConsistencyInput,
  AttachmentTrustDecision,
  FullweightMessageAnalysisInput,
  LightweightMessageAnalysis,
  LightweightMessageAnalysisInput,
  MessageAnalysisInput,
  MessageAnalysisOutput,
  MessageAnalysisSteps,
  RawFullweightMessageAnalysis,
  RawInputSafetyGate,
  RawInputSafetyGateInput,
  RawInputSafetyReview,
  RawInputSafetyReviewInput,
  RawInputTrustConsistencyInput,
  RawInputTrustDecision,
  TurnUnderstandingDeltaInput
} from "./typesMessageAnalysis.types.ts";


async function runMessageAnalysis(
  messageAnalysisInput: MessageAnalysisInput,
  steps: MessageAnalysisSteps = {}
): Promise<MessageAnalysisOutput> {
  const messageAnalysisSteps: Required<MessageAnalysisSteps> = {
    runRawInputSafetyGate:
      steps.runRawInputSafetyGate || runRawInputSafetyGate,

    decideRawInputTrustConsistency:
      steps.decideRawInputTrustConsistency || decideRawInputTrustConsistency,

    runRawInputSafetyReviewLlmTruster:
      steps.runRawInputSafetyReviewLlmTruster ||
      runRawInputSafetyReviewLlmTruster,

    runAttachmentAnalysis:
      steps.runAttachmentAnalysis || runAttachmentAnalysis,

    runAttachmentAnalysisSafetyGate:
      steps.runAttachmentAnalysisSafetyGate || runAttachmentAnalysisSafetyGate,

    decideAttachmentTrustConsistency:
      steps.decideAttachmentTrustConsistency || decideAttachmentTrustConsistency,

    runAttachmentSafetyReviewLlmTruster:
      steps.runAttachmentSafetyReviewLlmTruster ||
      runAttachmentSafetyReviewLlmTruster,

    runAnalysisGate:
      steps.runAnalysisGate || runAnalysisGate,

    runLightweightMessageAnalysis:
      steps.runLightweightMessageAnalysis || runLightweightMessageAnalysis,

    runFullweightMessageAnalysis:
      steps.runFullweightMessageAnalysis || runFullweightMessageAnalysis,

    assembleTurnUnderstandingDelta:
      steps.assembleTurnUnderstandingDelta || assembleTurnUnderstandingDelta
  };

  const {
    latestUserMessage,
    latestUserAttachments,
    accountTrustStatus,
    supportTopicKnowledge,
    conversationHistory
  } = messageAnalysisInput;

  let rawInputTrustDecision: RawInputTrustDecision = {
    status: "skipped"
  };

  let rawInputSafetyReview: RawInputSafetyReview = {
    status: "skipped"
  };

  let attachmentAnalysis: AttachmentAnalysis = {
    status: "skipped"
  };

  let attachmentAnalysisSafetyGate: AttachmentAnalysisSafetyGate = {
    status: "skipped"
  };

  let attachmentTrustDecision: AttachmentTrustDecision = {
    status: "skipped"
  };

  let attachmentSafetyReview: AttachmentSafetyReview = {
    status: "skipped"
  };

  let analysisGate: AnalysisGate = {
    status: "skipped"
  };

  let lightweightMessageAnalysis: LightweightMessageAnalysis = {
    status: "skipped",
    shouldRunSupportMessageAnalysis: false,
    segments_signal: [],
    segments_scope_boundary: [],
    segments_suspicious: []
  };

  let rawFullweightMessageAnalysis: RawFullweightMessageAnalysis = {
    status: "skipped",
    segments_lack_comprehension: [],
    segments_topic: [],
    segments_signal: [],
    segments_scope_boundary: [],
    segments_suspicious: []
  };

  const rawInputSafetyGateInput: RawInputSafetyGateInput = {
    latestUserMessage,
    latestUserAttachments
  };

  const rawInputSafetyGate =
    await messageAnalysisSteps.runRawInputSafetyGate(rawInputSafetyGateInput);

  const hasSuspiciousAttachment =
    rawInputSafetyGate.failedChecks.includes("suspicious_attachments");

  if (!hasSuspiciousAttachment) {
    const rawInputTrustConsistencyInput: RawInputTrustConsistencyInput = {
      rawInputSafetyGate,
      accountTrustStatus
    };

    rawInputTrustDecision =
      await messageAnalysisSteps.decideRawInputTrustConsistency(
        rawInputTrustConsistencyInput
      );

    if (
      rawInputTrustDecision.status === "decided" &&
      rawInputTrustDecision.route === "review_with_llm_truster"
    ) {
      const rawInputSafetyReviewInput: RawInputSafetyReviewInput = {
        latestUserMessage,
        rawInputSafetyGate,
        accountTrustStatus
      };

      rawInputSafetyReview =
        await messageAnalysisSteps.runRawInputSafetyReviewLlmTruster(
          rawInputSafetyReviewInput
        );
    }

    const finalRawInputRoute =
      rawInputSafetyReview.status === "reviewed"
        ? rawInputSafetyReview.route
        : rawInputTrustDecision.status === "decided" &&
            rawInputTrustDecision.route !== "review_with_llm_truster"
          ? rawInputTrustDecision.route
          : "stop";

    if (finalRawInputRoute === "continue") {
      let finalAttachmentRoute: "continue" | "stop" = "continue";

      if (latestUserAttachments.length > 0) {
        const attachmentAnalysisInput: AttachmentAnalysisInput = {
          latestUserMessage,
          latestUserAttachments
        };

        attachmentAnalysis =
          await messageAnalysisSteps.runAttachmentAnalysis(
            attachmentAnalysisInput
          );

        const attachmentAnalysisSafetyGateInput: AttachmentAnalysisSafetyGateInput =
          {
            attachmentAnalysis
          };

        attachmentAnalysisSafetyGate =
          await messageAnalysisSteps.runAttachmentAnalysisSafetyGate(
            attachmentAnalysisSafetyGateInput
          );

        const attachmentTrustConsistencyInput: AttachmentTrustConsistencyInput = {
          attachmentAnalysisSafetyGate,
          accountTrustStatus
        };

        attachmentTrustDecision =
          await messageAnalysisSteps.decideAttachmentTrustConsistency(
            attachmentTrustConsistencyInput
          );

        if (
          attachmentTrustDecision.status === "decided" &&
          attachmentTrustDecision.route === "review_with_llm_truster"
        ) {
          const attachmentSafetyReviewInput: AttachmentSafetyReviewInput = {
            attachmentAnalysis,
            attachmentAnalysisSafetyGate,
            accountTrustStatus
          };

          attachmentSafetyReview =
            await messageAnalysisSteps.runAttachmentSafetyReviewLlmTruster(
              attachmentSafetyReviewInput
            );
        }

        finalAttachmentRoute =
          attachmentSafetyReview.status === "reviewed"
            ? attachmentSafetyReview.route
            : attachmentTrustDecision.status === "decided" &&
                attachmentTrustDecision.route !== "review_with_llm_truster"
              ? attachmentTrustDecision.route
              : "stop";
      }

      if (finalAttachmentRoute === "continue") {
        const analysisGateInput: AnalysisGateInput = {
          latestUserMessage,
          supportTopicKnowledge,
          conversationHistory,
          attachmentAnalysis
        };

        analysisGate =
          await messageAnalysisSteps.runAnalysisGate(analysisGateInput);

        if (
          analysisGate.status === "checked" &&
          analysisGate.shouldRunLightweightMessageAnalysis === true
        ) {
          const lightweightMessageAnalysisInput: LightweightMessageAnalysisInput =
            {
              latestUserMessage,
              supportTopicKnowledge,
              conversationHistory,
              attachmentAnalysis
            };

          lightweightMessageAnalysis =
            await messageAnalysisSteps.runLightweightMessageAnalysis(
              lightweightMessageAnalysisInput
            );
        } else {
          lightweightMessageAnalysis = {
            status: "skipped",
            shouldRunSupportMessageAnalysis: true,
            segments_signal: [],
            segments_scope_boundary: [],
            segments_suspicious: []
          };
        }

        if (lightweightMessageAnalysis.shouldRunSupportMessageAnalysis === true) {
          const fullweightMessageAnalysisInput: FullweightMessageAnalysisInput = {
            latestUserMessage,
            supportTopicKnowledge,
            conversationHistory,
            attachmentAnalysis,
            lightweightMessageAnalysis
          };

          rawFullweightMessageAnalysis =
            await messageAnalysisSteps.runFullweightMessageAnalysis(
              fullweightMessageAnalysisInput
            );
        }
      }
    }
  }

  const turnUnderstandingDeltaInput: TurnUnderstandingDeltaInput = {
    rawInputSafetyGate,
    rawInputTrustDecision,
    rawInputSafetyReview,
    attachmentAnalysis,
    attachmentAnalysisSafetyGate,
    attachmentTrustDecision,
    attachmentSafetyReview,
    analysisGate,
    lightweightMessageAnalysis,
    rawFullweightMessageAnalysis,
    supportTopicKnowledge,
    conversationHistory
  };

  return messageAnalysisSteps.assembleTurnUnderstandingDelta(
    turnUnderstandingDeltaInput
  );
}

export { runMessageAnalysis };