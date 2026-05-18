/**
 * Message Analysis orchestrator.
 */

import { runLatestUserMessageSecurity } from "./safety-functions/message-gate/runLatestUserMessageSecurity";
import { runAttachmentAnalysisSecurity } from "./safety-functions/attachment-gate/runAttachmentAnalysisSecurity";

import { runAttachmentAnalysis } from "./attachment-analysis/runAttachmentAnalysis";
import { runAnalysisGate } from "./analysis-gate/runAnalysisGate";
import { runLightWeightMessageAnalysis } from "./lightweight-message-analysis/runLightWeightMessageAnalysis";
import { runFullWeightMessageAnalysis } from "./fullweight-message-analysis/runFullWeightMessageAnalysis";
import { assembleTurnUnderstandingDelta } from "./turn-understanding-delta/assembleTurnUnderstandingDelta";

import type {
  AnalysisGateInput,
  AttachmentAnalysis,
  AttachmentAnalysisInput,
  AttachmentAnalysisSecurityInput,
  FullWeightMessageAnalysis,
  FullWeightMessageAnalysisInput,
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

  switch (latestUserMessageSecurityDecision.decision.route) {
    case "continue": {
      securityGateSummary.gateChecked.latestUserMessageSecurityDecision =
        latestUserMessageSecurityDecision;

      break;
    }

    case "stop": {
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
  }

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

    switch (attachmentAnalysisSecurityDecision.decision.route) {
      case "continue": {
        securityGateSummary.gateChecked.attachmentAnalysisSecurityDecision =
          attachmentAnalysisSecurityDecision;

        break;
      }

      case "stop": {
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
    }
  }

  /* =====================================================
   * 6.4 analysisGate
   * ===================================================== */

  const analysisGateInput: AnalysisGateInput = {
    latestUserMessage,
    supportTopicKnowledge,
    conversationHistory,
    ...(attachmentAnalysis ? { attachmentAnalysis } : {})
  };

  const analysisGate =
    await messageAnalysisSteps.runAnalysisGate(analysisGateInput);

  /* =====================================================
   * 6.5 lightWeightMessageAnalysis
   * ===================================================== */

  let lightWeightMessageAnalysis: LightWeightMessageAnalysis | undefined;

  if (analysisGate.shouldRunLightWeightMessageAnalysis === true) {
    const lightWeightMessageAnalysisInput: LightWeightMessageAnalysisInput = {
      latestUserMessage,
      supportTopicKnowledge,
      conversationHistory,
      ...(attachmentAnalysis ? { attachmentAnalysis } : {})
    };

    lightWeightMessageAnalysis =
      await messageAnalysisSteps.runLightWeightMessageAnalysis(
        lightWeightMessageAnalysisInput
      );
  }

  /* =====================================================
   * 6.6 fullWeightMessageAnalysis
   * ===================================================== */

  let fullWeightMessageAnalysis: FullWeightMessageAnalysis | undefined;

  const shouldRunFullWeightMessageAnalysis =
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

    fullWeightMessageAnalysis =
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
    analysisGate,
    ...(lightWeightMessageAnalysis ? { lightWeightMessageAnalysis } : {}),
    ...(fullWeightMessageAnalysis ? { fullWeightMessageAnalysis } : {}),
    supportTopicKnowledge,
    conversationHistory
  };

  return messageAnalysisSteps.assembleTurnUnderstandingDelta(
    turnUnderstandingDeltaInput
  );
}

export { runMessageAnalysis };