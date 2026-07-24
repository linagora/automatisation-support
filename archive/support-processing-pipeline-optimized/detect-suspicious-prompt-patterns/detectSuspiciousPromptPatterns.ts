const suspiciousPatternIds = [
  "prompt_injection_attempt",
  "sensitive_data_request",
  "credential_or_secret_leak",
  "internal_information_request",
  "suspicious_link_or_url"
] as const;

type SuspiciousPatternId = typeof suspiciousPatternIds[number];

type DetectSuspiciousPromptPatternsInput = {
  latestUserMessage: {
    content: string;
  };
};

type PromptSecuritySignals = {
  matchedPatternIds: SuspiciousPatternId[];
};

const promptInjectionPatterns = [
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
  /\bprompt cach(?:é|ée|e)\b/iu,
  /\bprompt syst[èe]me\b/iu,
  /\bmontre[-\s]?moi ton prompt\b/iu,
  /\br[ée]v[èe]le.*prompt\b/iu
] as const;

const sensitiveDataRequestPatterns = [
  /\b(export|dump|send|show|reveal|give|list)\b.*\b(private|customer|user|internal|confidential)\b.*\b(data|emails?|messages?|records?)\b/iu,
  /\b(export|dump|send|show|reveal|give|list)\b.*\b(all|every)\b.*\b(customer|user)\b.*\b(data|records?)\b/iu,
  /\b(exporte|affiche|montre|r[ée]v[èe]le|donne|liste)\b.*\b(donn[ée]es|messages?|emails?)\b.*\b(priv[ée]es|clients?|utilisateurs?)\b/iu
] as const;

const benignTokenErrorPatterns = [
  /\btoken\s+(expired|invalid|has expired)\b/iu,
  /\binvalid\s+token\b/iu,
  /\bjwt\s+expired\b/iu,
  /\bsession\s+expired\b/iu,
  /\btoken\s+(a\s+)?expir[ée]\b/iu,
  /\berreur\s+token\s+expir[ée]\b/iu
] as const;

const structuredSecretPatterns = [
  /\bsk-[a-z0-9_-]{20,}\b/iu,
  /\b(?:api[_\s-]?key|token|secret)\s*[:=]\s*[a-z0-9._~+/=-]{24,}\b/iu,
  /\beyJ[a-z0-9_-]{10,}\.[a-z0-9_-]{10,}\.[a-z0-9_-]{10,}\b/iu,
  /\b[a-f0-9]{32,}\b/iu
] as const;

const credentialOrSecretRequestPatterns = [
  /\b(show|reveal|give|send|export|dump|print)\b.*\b(api[_\s-]?key|token|private key|secret|password|credential)\b/iu,
  /\b(api[_\s-]?key|token|private key|secret|password|credential)\b.*\b(show|reveal|give|send|export|dump|print)\b/iu,
  /\b(affiche|montre|r[ée]v[èe]le|donne|exporte)\b.*\b(token|cl[ée]\s*api|cl[ée]\s*priv[ée]e|secret|mot de passe|identifiants?)\b/iu,
  /\b(token|cl[ée]\s*api|cl[ée]\s*priv[ée]e|secret|mot de passe|identifiants?)\b.*\b(affiche|montre|r[ée]v[èe]le|donne|exporte)\b/iu
] as const;

const internalInformationRequestPatterns = [
  /\b(show|reveal|explain|dump|print)\b.*\b(internal logs?|hidden logs?|pipeline internals|model internals|architecture internals|system messages?)\b/iu,
  /\b(affiche|montre|r[ée]v[èe]le|explique|donne)\b.*\b(logs? internes?|architecture interne|pipeline interne|messages? syst[èe]me)\b/iu
] as const;

const highRiskBareDomainPattern =
  /\b[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?\.(?:zip|mov|click|top|xyz|tk|ml|ga|cf|gq|ru|cn|su|info)\b/iu;

function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim();
}

function hasPromptInjectionAttempt(normalizedContent: string): boolean {
  return promptInjectionPatterns.some((pattern) => {
    return pattern.test(normalizedContent);
  });
}

function hasSensitiveDataRequest(normalizedContent: string): boolean {
  return sensitiveDataRequestPatterns.some((pattern) => {
    return pattern.test(normalizedContent);
  });
}

function hasCredentialOrSecretSignal(normalizedContent: string): boolean {
  const hasStructuredSecret = structuredSecretPatterns.some((pattern) => {
    return pattern.test(normalizedContent);
  });

  if (hasStructuredSecret) {
    return true;
  }

  const hasBenignTokenErrorMessage = benignTokenErrorPatterns.some((pattern) => {
    return pattern.test(normalizedContent);
  });

  if (hasBenignTokenErrorMessage) {
    return false;
  }

  return credentialOrSecretRequestPatterns.some((pattern) => {
    return pattern.test(normalizedContent);
  });
}

function hasInternalInformationRequest(normalizedContent: string): boolean {
  return internalInformationRequestPatterns.some((pattern) => {
    return pattern.test(normalizedContent);
  });
}

function hasSuspiciousLinkOrUrl(normalizedContent: string): boolean {
  return highRiskBareDomainPattern.test(normalizedContent);
}

function hasSuspiciousPattern(
  patternId: SuspiciousPatternId,
  normalizedContent: string
): boolean {
  switch (patternId) {
    case "prompt_injection_attempt":
      return hasPromptInjectionAttempt(normalizedContent);
    case "sensitive_data_request":
      return hasSensitiveDataRequest(normalizedContent);
    case "credential_or_secret_leak":
      return hasCredentialOrSecretSignal(normalizedContent);
    case "internal_information_request":
      return hasInternalInformationRequest(normalizedContent);
    case "suspicious_link_or_url":
      return hasSuspiciousLinkOrUrl(normalizedContent);
  }
}

function detectSuspiciousPromptPatterns(
  input: DetectSuspiciousPromptPatternsInput
): PromptSecuritySignals {
  const normalizedContent = normalizeText(input.latestUserMessage.content);

  if (normalizedContent === "") {
    return {matchedPatternIds: []};
  }

  return {
    matchedPatternIds: suspiciousPatternIds.filter((patternId) => {
      return hasSuspiciousPattern(patternId, normalizedContent);
    })
  };
}

export {
  detectSuspiciousPromptPatterns
};

export type {
  DetectSuspiciousPromptPatternsInput,
  PromptSecuritySignals,
  SuspiciousPatternId
};
