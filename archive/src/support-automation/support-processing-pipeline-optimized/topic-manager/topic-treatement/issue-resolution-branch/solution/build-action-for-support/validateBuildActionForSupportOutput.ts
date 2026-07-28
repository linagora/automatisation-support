export type BuildActionForSupportValidatedOutput = {
  actionToTakeForSupport: string | null;
};

function validateBuildActionForSupportOutput(parsedResponse: unknown): BuildActionForSupportValidatedOutput | null {
  if (!isRecord(parsedResponse)) return null;
  if (!hasOnlyKeys(parsedResponse, ["actionToTakeForSupport"])) return null;

  return {
    actionToTakeForSupport: validateNullableString(parsedResponse.actionToTakeForSupport)
  };
}

function validateNullableString(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value === "string") return value.trim() === "" ? null : value;
  return null;
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: string[]): boolean {
  const allowedKeySet = new Set(allowedKeys);
  return Object.keys(value).every((key) => allowedKeySet.has(key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export {validateBuildActionForSupportOutput};
