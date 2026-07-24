type PlanTurnAnalysisInput = {
  latestUserMessage: {
    content: string;
  };
  latestUserAttachments: unknown[];
  promptSecuritySignals: {
    matchedPatternIds: string[];
  };
  accountTrustStatus: {
    status: "trusted" | "neutral" | "restricted" | "blocked" | string;
  };
};

type TurnAnalysisPlan = {
  analyzeText: boolean;
  analyzeAttachments: boolean;
  matchedPatternIds: string[];
};

function planTurnAnalysis(
  input: PlanTurnAnalysisInput
): TurnAnalysisPlan {
  const hasText = input.latestUserMessage.content.trim() !== "";
  const hasAttachments = input.latestUserAttachments.length > 0;

  const hasSecuritySignals =
    input.promptSecuritySignals.matchedPatternIds.length > 0;

  const isTrustedOrNeutral =
    input.accountTrustStatus.status === "trusted" ||
    input.accountTrustStatus.status === "neutral";

  const analyzeText =
    hasText &&
    (isTrustedOrNeutral || !hasSecuritySignals);

  const analyzeAttachments =
    hasAttachments &&
    isTrustedOrNeutral;

  return {
    analyzeText,
    analyzeAttachments,
    matchedPatternIds: input.promptSecuritySignals.matchedPatternIds
  };
}

export {
  planTurnAnalysis
};

export type {
  PlanTurnAnalysisInput,
  TurnAnalysisPlan
};
