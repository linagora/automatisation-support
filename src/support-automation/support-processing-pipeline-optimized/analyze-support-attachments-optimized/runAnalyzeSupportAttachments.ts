import type {AnalyzeAttachmentSurfaceOutput} from "../analyze-attachment-surface-optimized/runAnalyzeAttachmentSurface";

type AnalyzeSupportAttachmentsInput = {
  attachmentSurfaceAnalysis: AnalyzeAttachmentSurfaceOutput | null | undefined;
  latestUserAttachments: unknown[];
  recentInteractionContext: unknown;
};

type AnalyzeSupportAttachmentsOutput =
  | {
      status: "analyzed";
      fallbackReason: null;
      understandings: [];
    }
  | {
      status: "fallback";
      fallbackReason: {
        source: "analyze_support_attachments";
        reason: "not_yet_implemented";
      };
    };

function runAnalyzeSupportAttachments(
  input: AnalyzeSupportAttachmentsInput
): AnalyzeSupportAttachmentsOutput {
  void input.attachmentSurfaceAnalysis;
  void input.recentInteractionContext;

  if (input.latestUserAttachments.length === 0) {
    return {
      status: "analyzed",
      fallbackReason: null,
      understandings: []
    };
  }

  return {
    status: "fallback",
    fallbackReason: {
      source: "analyze_support_attachments",
      reason: "not_yet_implemented"
    }
  };
}

export {runAnalyzeSupportAttachments};

export type {
  AnalyzeSupportAttachmentsInput,
  AnalyzeSupportAttachmentsOutput
};
