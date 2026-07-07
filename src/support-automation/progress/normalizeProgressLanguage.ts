type ProgressLanguage = "fr" | "en";

function normalizeUserLanguageForProgress(
  userLanguage: unknown
): ProgressLanguage {
  if (typeof userLanguage !== "string") {
    return "en";
  }

  const normalizedLanguage = userLanguage.trim().toLowerCase();

  if (
    normalizedLanguage === "fr" ||
    normalizedLanguage.startsWith("fr-") ||
    normalizedLanguage === "french" ||
    normalizedLanguage === "français" ||
    normalizedLanguage === "francais"
  ) {
    return "fr";
  }

  return "en";
}

export {
  normalizeUserLanguageForProgress
};

export type {
  ProgressLanguage
};
