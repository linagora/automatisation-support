type IssueDeepQualificationAskPlannerOutput = {
  say: string;
};

function validateIssueDeepQualificationAskPlannerOutput(value: unknown): IssueDeepQualificationAskPlannerOutput | null {
  if (!isRecord(value)) return null;
  if (typeof value.say !== "string" || value.say.trim() === "") return null;
  return {say: value.say.trim()};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export {validateIssueDeepQualificationAskPlannerOutput};
export type {IssueDeepQualificationAskPlannerOutput};
