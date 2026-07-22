import type {IssueSolutionAttemptedAction} from "../../../runIssueResolutionBranch";

type AssessIssueSolutionUserFeedbackValidatedOutput = {
  feedbackStatus: "no_feedback" | "unclear" | "some_tested" | "all_tested" | "user_declared_unavailable";
  resolutionStatus: "resolved" | "unresolved" | "unknown";
  attemptedActionResults: IssueSolutionAttemptedAction[];
  reason: string | null;
};

function validateAssessIssueSolutionUserFeedbackOutput(value: unknown): AssessIssueSolutionUserFeedbackValidatedOutput | null {
  if (!isRecord(value)) return null;

  const feedbackStatus = validateFeedbackStatus(value.feedbackStatus);
  const resolutionStatus = validateResolutionStatus(value.resolutionStatus);
  const attemptedActionResults = validateAttemptedActionResults(value.attemptedActionResults);
  const reason = validateNullableString(value.reason);

  if (!feedbackStatus || !resolutionStatus || attemptedActionResults === null || reason === undefined) return null;
  return {feedbackStatus, resolutionStatus, attemptedActionResults, reason};
}

function validateFeedbackStatus(value: unknown): AssessIssueSolutionUserFeedbackValidatedOutput["feedbackStatus"] | null {
  return value === "no_feedback" || value === "unclear" || value === "some_tested" || value === "all_tested" || value === "user_declared_unavailable" ? value : null;
}

function validateResolutionStatus(value: unknown): AssessIssueSolutionUserFeedbackValidatedOutput["resolutionStatus"] | null {
  return value === "resolved" || value === "unresolved" || value === "unknown" ? value : null;
}

function validateAttemptedActionResults(value: unknown): IssueSolutionAttemptedAction[] | null {
  if (!Array.isArray(value)) return null;

  return value.flatMap((item): IssueSolutionAttemptedAction[] => {
    if (!isRecord(item) || typeof item.action !== "string" || item.action.trim() === "") return [];
    const outcome = validateOutcome(item.outcome) ?? "unknown";
    const evidence = typeof item.evidence === "string" && item.evidence.trim() !== "" ? item.evidence.trim() : null;
    return [{action: item.action.trim(), outcome, evidence, status: "obtained"}];
  });
}

function validateOutcome(value: unknown): IssueSolutionAttemptedAction["outcome"] | null {
  return value === "success" || value === "failed" || value === "partial" || value === "unknown" ? value : null;
}

function validateNullableString(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value === "string") return value.trim() || null;
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export {validateAssessIssueSolutionUserFeedbackOutput};
export type {AssessIssueSolutionUserFeedbackValidatedOutput};
