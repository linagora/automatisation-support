type ResponseLanguage = string;
type ResponseTemplateLanguage = "French" | "English";

const LEGACY_LANGUAGE_CODES: Record<string, string> = {
  french: "fr",
  english: "en",
  other: "unknown",
  unknown: "unknown"
};

function normalizeBcp47LanguageCode(value: string): string | undefined {
  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue === "") {
    return undefined;
  }

  const legacyLanguageCode = LEGACY_LANGUAGE_CODES[normalizedValue];

  if (legacyLanguageCode) {
    return legacyLanguageCode;
  }

  return /^[a-z]{2,3}(?:-[a-z0-9]{2,8}){0,2}$/u.test(normalizedValue)
    ? normalizedValue
    : undefined;
}

function normalizeDetectedUserLanguage(userLanguage: unknown): string {
  if (typeof userLanguage !== "string") {
    return "unknown";
  }

  return normalizeBcp47LanguageCode(userLanguage) ?? "unknown";
}

function normalizeUserLanguageForResponse(
  userLanguage: unknown
): ResponseLanguage {
  const normalizedLanguage = normalizeDetectedUserLanguage(userLanguage);

  return normalizedLanguage === "unknown" ? "en" : normalizedLanguage;
}

function normalizeUserLanguageForTemplate(
  userLanguage: unknown
): ResponseTemplateLanguage {
  return normalizeUserLanguageForResponse(userLanguage) === "fr"
    ? "French"
    : "English";
}

export {
  normalizeDetectedUserLanguage,
  normalizeUserLanguageForTemplate,
  normalizeUserLanguageForResponse
};

export type {
  ResponseLanguage,
  ResponseTemplateLanguage
};
