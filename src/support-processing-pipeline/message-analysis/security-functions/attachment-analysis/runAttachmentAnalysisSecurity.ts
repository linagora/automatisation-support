/**
 * Temporary Attachment Analysis Security
 *
 * Mock implementation used while testing the message analysis pipeline.
 *
 * Always validates the attachment analysis and lets the pipeline continue.
 */

import type {
  AttachmentAnalysisSecurityDecision,
  AttachmentAnalysisSecurityInput
} from "../../typesMessageAnalysis.types";

async function runAttachmentAnalysisSecurity(
  input: AttachmentAnalysisSecurityInput
): Promise<AttachmentAnalysisSecurityDecision> {
  void input;

  return {
    decision: {
      route: "continue"
    },
    history: {
      checked: ["suspicious_attachments"],
      failed: [],
      contextAccountDecision: "continue"
    }
  };
}

export {
  runAttachmentAnalysisSecurity
};