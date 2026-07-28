type ValidatedTranslateMessageOutput = {
  translatedMessage: string;
};

function validateTranslateMessageOutput(parsedResponse: unknown): ValidatedTranslateMessageOutput | null {
  if (!isRecord(parsedResponse)) return null;
  if (typeof parsedResponse.translatedMessage !== "string") return null;

  const translatedMessage = parsedResponse.translatedMessage.trim();
  if (translatedMessage === "") return null;

  return {translatedMessage};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export {validateTranslateMessageOutput};
export type {ValidatedTranslateMessageOutput};
