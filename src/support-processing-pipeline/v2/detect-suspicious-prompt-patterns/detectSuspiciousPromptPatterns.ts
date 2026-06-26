import type {
  DetectSuspiciousPromptPatternsInput,
  PromptSecuritySignals
} from "../typesSupportProcessingPipelineV2.types";

const PATTERN_ORDER = [
  "prompt_injection_attempt",
  "sensitive_data_request",
  "credential_or_secret_leak",
  "internal_information_request",
  "suspicious_link_or_url"
] as const;

type SuspiciousPatternId = typeof PATTERN_ORDER[number];

function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim();
}

function addPattern(
  matchedPatternIds: Set<SuspiciousPatternId>,
  patternId: SuspiciousPatternId
): void {
  matchedPatternIds.add(patternId);
}

function hasPromptInjectionAttempt(content: string): boolean {
  const normalized = normalizeText(content);

  return [
    /ignore[\s,.;:!?-]*previous[\s,.;:!?-]*instructions/iu,
    /ignore[\s,.;:!?-]*all[\s,.;:!?-]*previous[\s,.;:!?-]*instructions/iu,
    /ignore[\s,.;:!?-]*les[\s,.;:!?-]*instructions/iu,
    /ignore[\s,.;:!?-]*toutes[\s,.;:!?-]*les[\s,.;:!?-]*instructions/iu,
    /\bjailbreak\b/iu,
    /\bdeveloper mode\b/iu,
    /\bdo anything now\b/iu,
    /\bDAN mode\b/iu,
    /\bsystem prompt\b/iu,
    /\bhidden prompt\b/iu,
    /\bprompt cach[ée]\b/iu,
    /\bprompt syst[èe]me\b/iu,
    /\bmontre[-\s]?moi ton prompt\b/iu,
    /\br[ée]v[èe]le.*prompt\b/iu
  ].some((pattern) => pattern.test(normalized));
}

function hasSensitiveDataRequest(content: string): boolean {
  const normalized = normalizeText(content);

  return [
    /\b(export|dump|send|show|reveal|give|list)\b.*\b(private|customer|user|internal|confidential)\b.*\b(data|emails?|messages?|records?)\b/iu,
    /\b(export|dump|send|show|reveal|give|list)\b.*\b(all|every)\b.*\b(customer|user)\b.*\b(data|records?)\b/iu,
    /\b(exporte|affiche|montre|r[ée]v[èe]le|donne|liste)\b.*\b(donn[ée]es|messages?|emails?)\b.*\b(priv[ée]es|clients?|utilisateurs?)\b/iu
  ].some((pattern) => pattern.test(normalized));
}

function hasCredentialOrSecretLeakRequest(content: string): boolean {
  const normalized = normalizeText(content);

  const hasBenignTokenErrorMessage = [
    /\btoken\s+(expired|invalid|has expired)\b/iu,
    /\binvalid\s+token\b/iu,
    /\bjwt\s+expired\b/iu,
    /\bsession\s+expired\b/iu,
    /\btoken\s+(a\s+)?expir[ée]\b/iu,
    /\berreur\s+token\s+expir[ée]\b/iu
  ].some((pattern) => pattern.test(normalized));

  const hasStructuredSecret = [
    /\bsk-[a-z0-9_-]{20,}\b/iu,
    /\b(?:api[_\s-]?key|token|secret)\s*[:=]\s*[a-z0-9._~+/=-]{24,}\b/iu,
    /\beyJ[a-z0-9_-]{10,}\.[a-z0-9_-]{10,}\.[a-z0-9_-]{10,}\b/iu,
    /\b[a-f0-9]{32,}\b/iu
  ].some((pattern) => pattern.test(normalized));

  if (hasStructuredSecret) {
    return true;
  }

  if (hasBenignTokenErrorMessage) {
    return false;
  }

  return [
    /\b(show|reveal|give|send|export|dump|print)\b.*\b(api[_\s-]?key|token|private key|secret|password|credential)\b/iu,
    /\b(api[_\s-]?key|token|private key|secret|password|credential)\b.*\b(show|reveal|give|send|export|dump|print)\b/iu,
    /\b(affiche|montre|r[ée]v[èe]le|donne|exporte)\b.*\b(token|cl[ée]\s*api|cl[ée]\s*priv[ée]e|secret|mot de passe|identifiants?)\b/iu,
    /\b(token|cl[ée]\s*api|cl[ée]\s*priv[ée]e|secret|mot de passe|identifiants?)\b.*\b(affiche|montre|r[ée]v[èe]le|donne|exporte)\b/iu
  ].some((pattern) => pattern.test(normalized));
}

function hasInternalInformationRequest(content: string): boolean {
  const normalized = normalizeText(content);

  return [
    /\b(show|reveal|explain|dump|print)\b.*\b(internal logs?|hidden logs?|pipeline internals|model internals|architecture internals|system messages?)\b/iu,
    /\b(affiche|montre|r[ée]v[èe]le|explique|donne)\b.*\b(logs? internes?|architecture interne|pipeline interne|messages? syst[èe]me)\b/iu
  ].some((pattern) => pattern.test(normalized));
}

function hasExplicitUrl(content: string): boolean {
  return /\b(?:https?:\/\/|www\.)[^\s<>()]+/iu.test(content);
}

function hasHighRiskBareDomain(content: string): boolean {
  return /\b[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?\.(?:zip|mov|click|top|xyz|tk|ml|ga|cf|gq|ru|cn|su|info)\b/iu.test(
    content
  );
}

function hasSuspiciousLinkOrUrl(content: string): boolean {
  return hasExplicitUrl(content) || hasHighRiskBareDomain(content);
}

function detectSuspiciousPromptPatterns(
  input: DetectSuspiciousPromptPatternsInput
): PromptSecuritySignals {
  const content = input.latestUserMessage.content;
  const matchedPatternIds = new Set<SuspiciousPatternId>();

  if (content.trim() === "") {
    return {
      matchedPatternIds: []
    };
  }

  if (hasPromptInjectionAttempt(content)) {
    addPattern(matchedPatternIds, "prompt_injection_attempt");
  }

  if (hasSensitiveDataRequest(content)) {
    addPattern(matchedPatternIds, "sensitive_data_request");
  }

  if (hasCredentialOrSecretLeakRequest(content)) {
    addPattern(matchedPatternIds, "credential_or_secret_leak");
  }

  if (hasInternalInformationRequest(content)) {
    addPattern(matchedPatternIds, "internal_information_request");
  }

  if (hasSuspiciousLinkOrUrl(content)) {
    addPattern(matchedPatternIds, "suspicious_link_or_url");
  }

  return {
    matchedPatternIds: PATTERN_ORDER.filter((patternId) => {
      return matchedPatternIds.has(patternId);
    })
  };
}

export {
  detectSuspiciousPromptPatterns
};
