import {
  decideTextSecurityWithAccountTrust
} from "../shared/decideTextSecurityWithAccountTrust";
import {
  decideRefusedAttachmentRoute
} from "./decideRefusedAttachmentRoute";
import {
  runLlmTrusterReview
} from "../shared/runLlmTrusterReview";
import {
  runTextSecurityChecks
} from "../shared/runTextSecurityChecks";

import type {
  AttachmentAnalysisSecurityDecision,
  AttachmentAnalysisSecurityInput
} from "../../typesMessageAnalysis.types";

async function runAttachmentAnalysisSecurity(
  input: AttachmentAnalysisSecurityInput
): Promise<AttachmentAnalysisSecurityDecision> {
  if (
    input.attachmentAnalysis.some((attachment) => {
      return attachment.status === "failed";
    })
  ) {
    return {
      decision: {
        route: "continue"
      },
      history: {
        checked: [],
        failed: []
      }
    };
  }

  if (
    input.attachmentAnalysis.some((attachment) => {
      return attachment.status === "refused";
    })
  ) {
    const refusedAttachmentRouteDecision = decideRefusedAttachmentRoute({
      accountTrustStatus: input.accountTrustStatus
    });

    return {
      decision: {
        route: refusedAttachmentRouteDecision.route
      },
      history: {
        checked: [],
        failed: []
      }
    };
  }

  const attachmentAnalysisText = input.attachmentAnalysis
    .flatMap((attachment) => {
      const description = attachment.analysis?.llmDescription?.trim();

      return description === undefined || description === "" ? [] : [description];
    })
    .join("\n");

  const suspiciousAttachment = input.attachmentAnalysis.find((attachment) => {
    return attachment.status === "suspicious";
  });

  if (suspiciousAttachment !== undefined) {
    const llmReview = await runLlmTrusterReview({
      reviewKind: "attachment_analysis_suspicious",
      attachmentAnalysisDescription: attachmentAnalysisText,
      attachmentAnalysisSuspicion: {
        status: "suspicious",
        ...(suspiciousAttachment?.reason
          ? { reason: suspiciousAttachment.reason }
          : {})
      },
      accountTrustStatus: input.accountTrustStatus,
      latestUserMessageContent: input.latestUserMessageContent
    });

    return {
      decision: {
        route: llmReview.route === "continue" ? "continue" : "stop"
      },
      history: {
        checked: [],
        failed: [],
        llmReview
      }
    };
  }

  const textSecurityChecks = runTextSecurityChecks({
    text: attachmentAnalysisText,
    disabledChecks: ["excessive_repetition"]
  });

  const trustDecision = decideTextSecurityWithAccountTrust({
    textSecurityChecks,
    accountTrustStatus: input.accountTrustStatus
  });

  if (trustDecision.route === "continue") {
    return {
      decision: {
        route: "continue"
      },
      history: {
        checked: textSecurityChecks.checked,
        failed: textSecurityChecks.failed
      }
    };
  }

  if (trustDecision.route === "stop") {
    return {
      decision: {
        route: "stop"
      },
      history: {
        checked: textSecurityChecks.checked,
        failed: textSecurityChecks.failed
      }
    };
  }

  const llmReview = await runLlmTrusterReview({
    reviewKind: "attachment_text_security_checks",
    attachmentAnalysisDescription: attachmentAnalysisText,
    textSecurityChecks,
    trustDecision: {
      route: "review_with_llm_truster",
      ...(trustDecision.reason ? { reason: trustDecision.reason } : {})
    },
    accountTrustStatus: input.accountTrustStatus,
    latestUserMessageContent: input.latestUserMessageContent
  });

  return {
    decision: {
      route: llmReview.route === "continue" ? "continue" : "stop"
    },
    history: {
      checked: textSecurityChecks.checked,
      failed: textSecurityChecks.failed,
      llmReview
    }
  };
}

export {
  runAttachmentAnalysisSecurity
};
