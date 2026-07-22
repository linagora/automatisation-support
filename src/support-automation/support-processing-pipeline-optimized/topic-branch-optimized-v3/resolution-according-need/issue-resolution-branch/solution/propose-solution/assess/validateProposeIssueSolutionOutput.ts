import type {IssueSolutionAttemptedAction} from "../../../runIssueResolutionBranch";

type ProposeIssueSolutionValidatedOutput = {
  status: "available" | "not_found" | "not_relevant";
  customerFacingSolution: string | null;
  supportFacingSummary: string | null;
  confidence: number | null;
  attemptedActionsToTry: IssueSolutionAttemptedAction[];
};

function validateProposeIssueSolutionOutput(value: unknown): ProposeIssueSolutionValidatedOutput | null {
  if (!isRecord(value)) return null;

  const status = validateStatus(value.status);
  const customerFacingSolution = validateNullableString(value.customerFacingSolution);
  const supportFacingSummary = validateNullableString(value.supportFacingSummary);
  const confidence = validateConfidence(value.confidence);
  const attemptedActionsToTry = validateAttemptedActionsToTry(value.attemptedActionsToTry);

  if (!status || customerFacingSolution === undefined || supportFacingSummary === undefined || confidence === undefined || attemptedActionsToTry === null) return null;
  if (status === "available" && !customerFacingSolution) return null;

  return {status, customerFacingSolution, supportFacingSummary, confidence, attemptedActionsToTry: status === "available" ? attemptedActionsToTry : []};
}

function validateStatus(value: unknown): ProposeIssueSolutionValidatedOutput["status"] | null {
  return value === "available" || value === "not_found" || value === "not_relevant" ? value : null;
}

function validateNullableString(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value === "string") return value.trim() || null;
  return undefined;
}

function validateConfidence(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.min(1, value));
  return undefined;
}

function validateAttemptedActionsToTry(value: unknown): IssueSolutionAttemptedAction[] | null {
  if (!Array.isArray(value)) return null;

  return value.flatMap((item): IssueSolutionAttemptedAction[] => {
    if (!isRecord(item) || typeof item.action !== "string" || item.action.trim() === "") return [];
    const evidence = typeof item.evidence === "string" && item.evidence.trim() !== "" ? item.evidence.trim() : null;
    return [{action: item.action.trim(), outcome: null, evidence, status: "missing_but_asked"}];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export {validateProposeIssueSolutionOutput};
export type {ProposeIssueSolutionValidatedOutput};
