type ExtractIssueSolutionValidatedOutput = {
  status: "available" | "not_found" | "not_relevant";
  customerFacingSolution: string | null;
  supportFacingSummary: string | null;
  confidence: number | null;
};

function validateExtractIssueSolutionOutput(value: unknown): ExtractIssueSolutionValidatedOutput | null {
  if (!isRecord(value)) return null;

  const status = validateStatus(value.status);
  const customerFacingSolution = validateNullableString(value.customerFacingSolution);
  const supportFacingSummary = validateNullableString(value.supportFacingSummary);
  const confidence = typeof value.confidence === "number" && Number.isFinite(value.confidence)
    ? Math.max(0, Math.min(1, value.confidence))
    : value.confidence === null
      ? null
      : undefined;

  if (!status || customerFacingSolution === undefined || supportFacingSummary === undefined || confidence === undefined) return null;
  if (status === "available" && !customerFacingSolution) return null;

  return {
    status,
    customerFacingSolution,
    supportFacingSummary,
    confidence
  };
}

function validateStatus(value: unknown): ExtractIssueSolutionValidatedOutput["status"] | null {
  return value === "available" || value === "not_found" || value === "not_relevant" ? value : null;
}

function validateNullableString(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value === "string") return value.trim() || null;
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export {validateExtractIssueSolutionOutput};
export type {ExtractIssueSolutionValidatedOutput};
