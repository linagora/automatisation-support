type AnalyzeSimilarIssueTopicsValidatedOutput = {
  status: "identified" | "unclear" | "absent";
  confirmedTopicIds: string[];
  disambiguationQuestion: string | null;
  reason: string;
};

function validateAnalyzeSimilarIssueTopicsOutput(value: unknown): AnalyzeSimilarIssueTopicsValidatedOutput | null {
  if (!isRecord(value)) return null;

  const status = validateStatus(value.status);
  const confirmedTopicIds = Array.isArray(value.confirmedTopicIds)
    ? value.confirmedTopicIds.filter((item): item is string => typeof item === "string" && item.trim() !== "")
    : null;
  const disambiguationQuestion = typeof value.disambiguationQuestion === "string"
    ? value.disambiguationQuestion.trim()
    : value.disambiguationQuestion === null
      ? null
      : undefined;
  const reason = typeof value.reason === "string" && value.reason.trim() !== ""
    ? value.reason.trim()
    : null;

  if (!status || confirmedTopicIds === null || disambiguationQuestion === undefined || !reason) return null;
  if (status === "identified" && confirmedTopicIds.length === 0) return null;
  if (status === "unclear" && !disambiguationQuestion) return null;

  return {
    status,
    confirmedTopicIds,
    disambiguationQuestion,
    reason
  };
}

function validateStatus(value: unknown): AnalyzeSimilarIssueTopicsValidatedOutput["status"] | null {
  return value === "identified" || value === "unclear" || value === "absent" ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export {validateAnalyzeSimilarIssueTopicsOutput};
export type {AnalyzeSimilarIssueTopicsValidatedOutput};
