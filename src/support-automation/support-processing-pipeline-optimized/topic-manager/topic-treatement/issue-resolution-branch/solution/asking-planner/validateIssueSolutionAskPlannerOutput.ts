export type IssueSolutionAskPlannerOutput = {
  say: string;
};

function validateIssueSolutionAskPlannerOutput(parsedResponse: unknown): IssueSolutionAskPlannerOutput | null {
  if (!isRecord(parsedResponse)) return null;
  if (!hasOnlyKeys(parsedResponse, ["say"])) return null;
  if (typeof parsedResponse.say !== "string" || parsedResponse.say.trim() === "") return null;

  return {
    say: parsedResponse.say.trim()
  };
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: string[]): boolean {
  const allowedKeySet = new Set(allowedKeys);
  return Object.keys(value).every((key) => allowedKeySet.has(key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export {validateIssueSolutionAskPlannerOutput};
