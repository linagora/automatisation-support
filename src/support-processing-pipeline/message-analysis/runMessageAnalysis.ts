/**
 * Message Analysis orchestrator.
 */

import { runLatestUserMessageSecurity } from "./seurity-functions/latest-user-messsage/runLatestUserMessageSecurity";
import { runAttachmentAnalysisSecurity } from "./seurity-functions/attachment-analysis/runAttachmentAnalysisSecurity";

import { runAttachmentAnalysis } from "./attachment-analysis/runAttachmentAnalysis";
import { runAnalysisGate } from "./analysis-gate/runAnalysisGate";
import { runLightWeightMessageAnalysis } from "./lightweight-message-analysis/runLightWeightMessageAnalysis";
import { runFullWeightMessageAnalysis } from "./fullweight-message-analysis/runFullWeightMessageAnalysis";
import { assembleTurnUnderstandingDelta } from "./turn-understanding-delta/runTurnUnderstandingDelta";

import type {
  AnalysisGate,
  AnalysisGateInput,
  AttachmentAnalysis,
  AttachmentAnalysisInput,
  AttachmentAnalysisSecurityInput,
  FullWeightMessageAnalysisInput,
  FullWeightMessageAnalysisOutput,
  LatestUserMessageSecurityInput,
  LightWeightMessageAnalysis,
  LightWeightMessageAnalysisInput,
  MessageAnalysisInput,
  MessageAnalysisOutput,
  MessageAnalysisSteps,
  SecurityGateSummary,
  TurnUnderstandingDeltaInput
} from "./typesMessageAnalysis.types.ts";

async function runMessageAnalysis(
  messageAnalysisInput: MessageAnalysisInput,
  steps: MessageAnalysisSteps = {}
): Promise<MessageAnalysisOutput> {
  const messageAnalysisSteps: Required<MessageAnalysisSteps> = {
    runLatestUserMessageSecurity:
      steps.runLatestUserMessageSecurity || runLatestUserMessageSecurity,

    runAttachmentAnalysis:
      steps.runAttachmentAnalysis || runAttachmentAnalysis,

    runAttachmentAnalysisSecurity:
      steps.runAttachmentAnalysisSecurity || runAttachmentAnalysisSecurity,

    runAnalysisGate:
      steps.runAnalysisGate || runAnalysisGate,

    runLightWeightMessageAnalysis:
      steps.runLightWeightMessageAnalysis || runLightWeightMessageAnalysis,

    runFullWeightMessageAnalysis:
      steps.runFullWeightMessageAnalysis || runFullWeightMessageAnalysis,

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

  const securityGateSummary: SecurityGateSummary = {
    gateChecked: {},
    gateFailed: {}
  };

  /* =====================================================
   * 6.1 latestUserMessageSecurityDecision
   * ===================================================== */

  const latestUserMessageSecurityInput: LatestUserMessageSecurityInput = {
    latestUserMessage,
    accountTrustStatus
  };

  const latestUserMessageSecurityDecision =
    await messageAnalysisSteps.runLatestUserMessageSecurity(
      latestUserMessageSecurityInput
    );

  if (latestUserMessageSecurityDecision.decision.route === "stop") {
    securityGateSummary.gateFailed = {
      latestUserMessageSecurityDecision
    };

    const turnUnderstandingDeltaInput: TurnUnderstandingDeltaInput = {
      securityGateSummary,
      supportTopicKnowledge,
      conversationHistory
    };

    return messageAnalysisSteps.assembleTurnUnderstandingDelta(
      turnUnderstandingDeltaInput
    );
  }

  securityGateSummary.gateChecked.latestUserMessageSecurityDecision =
    latestUserMessageSecurityDecision;

  /* =====================================================
   * 6.2 attachmentAnalysis
   * ===================================================== */

  let attachmentAnalysis: AttachmentAnalysis | undefined;

  if (latestUserAttachments.length > 0) {
    const attachmentAnalysisInput: AttachmentAnalysisInput = {
      latestUserMessage,
      latestUserAttachments
    };

    attachmentAnalysis =
      await messageAnalysisSteps.runAttachmentAnalysis(attachmentAnalysisInput);
    /* =====================================================
     * 6.3 attachmentAnalysisSecurityDecision
     * ===================================================== */

    const attachmentAnalysisSecurityInput: AttachmentAnalysisSecurityInput = {
      attachmentAnalysis,
      accountTrustStatus
    };

    const attachmentAnalysisSecurityDecision =
      await messageAnalysisSteps.runAttachmentAnalysisSecurity(
        attachmentAnalysisSecurityInput
      );

    if (attachmentAnalysisSecurityDecision.decision.route === "stop") {
      securityGateSummary.gateFailed = {
        attachmentAnalysisSecurityDecision
      };

      const turnUnderstandingDeltaInput: TurnUnderstandingDeltaInput = {
        securityGateSummary,
        supportTopicKnowledge,
        conversationHistory
      };

      return messageAnalysisSteps.assembleTurnUnderstandingDelta(
        turnUnderstandingDeltaInput
      );
    }

    securityGateSummary.gateChecked.attachmentAnalysisSecurityDecision =
      attachmentAnalysisSecurityDecision;
  }

  /* =====================================================
   * 6.4 analysisGate
   *
   * Important:
   * If there is an attachmentAnalysis, skip analysisGate and go
   * directly to full-weight analysis.
   * ===================================================== */

  let analysisGate: AnalysisGate | undefined;
  let lightWeightMessageAnalysis: LightWeightMessageAnalysis | undefined;
  let fullWeightMessageAnalysisOutput:
    FullWeightMessageAnalysisOutput | undefined;

  if (!attachmentAnalysis) {
    const analysisGateInput: AnalysisGateInput = {
      latestUserMessage
    };

    analysisGate = await messageAnalysisSteps.runAnalysisGate(
      analysisGateInput
    );

    /* =====================================================
     * 6.5 lightWeightMessageAnalysis
     * ===================================================== */

    if (analysisGate.decision.route === "light_weight_first") {
      const lightWeightMessageAnalysisInput: LightWeightMessageAnalysisInput = {
        latestUserMessage,
        supportTopicKnowledge,
        conversationHistory
      };

      lightWeightMessageAnalysis =
        await messageAnalysisSteps.runLightWeightMessageAnalysis(
          lightWeightMessageAnalysisInput
        );
    }
  }

  /* =====================================================
   * 6.6 fullWeightMessageAnalysisOutput
   * ===================================================== */

  const shouldRunFullWeightMessageAnalysis =
    Boolean(attachmentAnalysis) ||
    !analysisGate ||
    analysisGate.decision.route === "full_weight_direct" ||
    !lightWeightMessageAnalysis ||
    lightWeightMessageAnalysis.shouldRunSupportMessageAnalysis === true;

  if (shouldRunFullWeightMessageAnalysis) {
    const fullWeightMessageAnalysisInput: FullWeightMessageAnalysisInput = {
      latestUserMessage,
      supportTopicKnowledge,
      conversationHistory,
      ...(attachmentAnalysis ? { attachmentAnalysis } : {}),
      ...(lightWeightMessageAnalysis ? { lightWeightMessageAnalysis } : {})
    };

    fullWeightMessageAnalysisOutput =
      await messageAnalysisSteps.runFullWeightMessageAnalysis(
        fullWeightMessageAnalysisInput
      );
  }

  /* =====================================================
   * 6. turnUnderstandingDelta
   * ===================================================== */

  const turnUnderstandingDeltaInput: TurnUnderstandingDeltaInput = {
    securityGateSummary,
    ...(attachmentAnalysis ? { attachmentAnalysis } : {}),
    ...(analysisGate ? { analysisGate } : {}),
    ...(lightWeightMessageAnalysis ? { lightWeightMessageAnalysis } : {}),
    ...(fullWeightMessageAnalysisOutput
      ? { fullWeightMessageAnalysisOutput }
      : {}),
    supportTopicKnowledge,
    conversationHistory
  };

  return messageAnalysisSteps.assembleTurnUnderstandingDelta(
    turnUnderstandingDeltaInput
  );
}

export { runMessageAnalysis };