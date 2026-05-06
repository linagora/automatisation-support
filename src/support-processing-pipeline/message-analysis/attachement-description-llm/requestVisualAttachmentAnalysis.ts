/**
 * Visual attachment analysis request
 *
 * This file will later contain the real call to an LLM vision model.
 *
 * For now, it returns analysis_not_available.
 */

import type {
  Attachment,
  VisualAttachmentAnalyzerOutput
} from "./runAttachmentDescriptionLLM";

interface RequestVisualAttachmentAnalysisInput {
  attachments: Attachment[];
  latestUserMessage?: string;
}

interface RequestVisualAttachmentAnalysisOutput {
  status: "analyzed" | "analysis_not_available";
  analysis: VisualAttachmentAnalyzerOutput | null;
  reason: string | null;
}

function requestVisualAttachmentAnalysis(
  input: RequestVisualAttachmentAnalysisInput
): RequestVisualAttachmentAnalysisOutput {
  void input;

  return {
    status: "analysis_not_available",
    analysis: null,
    reason: "visual_attachment_analysis_not_implemented"
  };
}

export {
  requestVisualAttachmentAnalysis
};

export type {
  RequestVisualAttachmentAnalysisInput,
  RequestVisualAttachmentAnalysisOutput
};