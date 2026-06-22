import type {
  BuildStandardResponseFragmentsInput,
  StandardResponseLanguage
} from "./typesBuildStandardResponseFragments.types";

type UserLanguage = "French" | "English" | "Other" | "Unknown";

const VALID_USER_LANGUAGES: UserLanguage[] = [
  "French",
  "English",
  "Other",
  "Unknown"
];

function toLanguage(value: unknown): StandardResponseLanguage | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue === "french" || normalizedValue === "fr" ||
    normalizedValue === "fr-fr") {
    return "french";
  }

  if (normalizedValue === "english" || normalizedValue === "en" ||
    normalizedValue === "en-us" || normalizedValue === "en-gb") {
    return "english";
  }

  return undefined;
}

function getKnownLanguageFromRecord(
  value: unknown
): StandardResponseLanguage | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  return toLanguage(record.userLanguage) ??
    toLanguage(record.user_language) ??
    toLanguage(record.lastUserLanguage) ??
    toLanguage(record.preferredLanguage) ??
    toLanguage(record.language) ??
    toLanguage(record.locale);
}

function detectLocalLanguageFromMessage(
  content: string | undefined
): StandardResponseLanguage | undefined {
  if (!content || content.trim() === "") {
    return undefined;
  }

  const normalizedContent = content
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (
    /\b(bonjour|merci|remerci|compte|bloque|probleme|support|humain|urgent|erreur|echec|connexion|connecter|facture|paiement|oui|non|normalement|semaine derniere|derniere fois|mot de passe|ca marche|ca ne marche pas)\b/u
      .test(normalizedContent) ||
    /[àâçéèêëîïôûùüÿœ]/iu.test(content)
  ) {
    return "french";
  }

  if (
    /\b(hello|hi|thanks|thank you|account|blocked|issue|support|human|urgent|error|failed|login|invoice|payment)\b/u
      .test(normalizedContent)
  ) {
    return "english";
  }

  return undefined;
}

function resolveStandardResponseLanguage(
  input: BuildStandardResponseFragmentsInput
): StandardResponseLanguage {
  if (
    VALID_USER_LANGUAGES.includes(
      input.textSurfaceAnalysis?.userLanguage as UserLanguage
    )
  ) {
    const surfaceLanguage = toLanguage(input.textSurfaceAnalysis?.userLanguage);

    if (surfaceLanguage) {
      return surfaceLanguage;
    }
  }

  return getKnownLanguageFromRecord(input.accountProfile) ??
    getKnownLanguageFromRecord(input.recentInteractionContext) ??
    detectLocalLanguageFromMessage(input.latestUserMessage?.content) ??
    "english";
}

export {
  resolveStandardResponseLanguage
};
