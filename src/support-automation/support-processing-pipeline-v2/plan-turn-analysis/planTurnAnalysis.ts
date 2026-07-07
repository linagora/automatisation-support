import type {
  PlanTurnAnalysisInput,
  TurnAnalysisPlan
} from "./typesPlanTurnAnalysis.types";

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