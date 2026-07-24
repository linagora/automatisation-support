type AnalyzeAttachmentSurfaceInput = {
  latestUserMessage: {content: string};
  latestUserAttachments: unknown[];
  turnAnalysisPlan: unknown;
};

type AnalyzeAttachmentSurfaceOutput =
  | {
      status: "analyzed";
      fallbackReason: null;
      attachments: Array<{supportRelevant: boolean}>;
    }
  | {
      status: "fallback";
      fallbackReason: {
        source: "analyze_attachment_surface";
        reason: "not_yet_implemented";
      };
    };

function runAnalyzeAttachmentSurface(
  input: AnalyzeAttachmentSurfaceInput
): AnalyzeAttachmentSurfaceOutput {
  void input.latestUserMessage;
  void input.turnAnalysisPlan;

  if (input.latestUserAttachments.length === 0) {
    return {
      status: "analyzed",
      fallbackReason: null,
      attachments: []
    };
  }

  return {
    status: "fallback",
    fallbackReason: {
      source: "analyze_attachment_surface",
      reason: "not_yet_implemented"
    }
  };
}

export {runAnalyzeAttachmentSurface};

export type {
  AnalyzeAttachmentSurfaceInput,
  AnalyzeAttachmentSurfaceOutput
};
