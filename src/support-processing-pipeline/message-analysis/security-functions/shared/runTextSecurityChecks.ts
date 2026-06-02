import {
  textSecurityPatternDictionary
} from "./textSecurityPatternDictionary";

export type TextSecurityCheckName =
  | "prompt_injection_attempt"
  | "internal_information_request"
  | "sensitive_data_request"
  | "credential_or_secret_leak"
  | "spam_like_text"
  | "suspicious_link_or_url"
  | "excessive_repetition"
  | "unsafe_or_suspicious_content";

export type TextSecurityCheckInput = {
  text: string;
};

export type TextSecurityCheckOutput = {
  checked: TextSecurityCheckName[];
  failed: TextSecurityCheckName[];
};

type TextSecurityTestDefinition = {
  checkName: TextSecurityCheckName;
  detectRisk: (normalizedText: string) => boolean;
};

function normalizeSecurityText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function matchesAnyPattern(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => {
    return pattern.test(text);
  });
}

function hasUrlOrLink(text: string): boolean {
  return /https?:\/\/|www\.|[a-z0-9-]+\.[a-z]{2,}/iu.test(text);
}

function hasExcessiveRepetition(text: string): boolean {
  const repeatedCharacter = /(.)\1{12,}/u.test(text);

  if (repeatedCharacter) {
    return true;
  }

  const words = normalizeSecurityText(text)
    .split(/\s+/u)
    .filter((word) => word.length > 2);

  if (words.length < 8) {
    return false;
  }

  const wordCounts = new Map<string, number>();

  for (const word of words) {
    wordCounts.set(word, (wordCounts.get(word) ?? 0) + 1);
  }

  return [...wordCounts.values()].some((count) => {
    return count >= 6;
  });
}

function getPatternsForCheck(checkName: TextSecurityCheckName): RegExp[] {
  const patterns = textSecurityPatternDictionary[checkName];

  if (!patterns) {
    return [];
  }

  return [
    ...(patterns.fr ?? []),
    ...(patterns.en ?? []),
    ...(patterns.neutral ?? [])
  ];
}

function hasPatternRisk(
  checkName: TextSecurityCheckName,
  normalizedText: string
): boolean {
  return matchesAnyPattern(normalizedText, getPatternsForCheck(checkName));
}

const TEXT_SECURITY_TESTS: TextSecurityTestDefinition[] = [
  {
    checkName: "prompt_injection_attempt",
    detectRisk: (normalizedText) => {
      return hasPatternRisk("prompt_injection_attempt", normalizedText);
    }
  },
  {
    checkName: "internal_information_request",
    detectRisk: (normalizedText) => {
      return hasPatternRisk("internal_information_request", normalizedText);
    }
  },
  {
    checkName: "sensitive_data_request",
    detectRisk: (normalizedText) => {
      return hasPatternRisk("sensitive_data_request", normalizedText);
    }
  },
  {
    checkName: "credential_or_secret_leak",
    detectRisk: (normalizedText) => {
      return hasPatternRisk("credential_or_secret_leak", normalizedText);
    }
  },
  {
    checkName: "spam_like_text",
    detectRisk: (normalizedText) => {
      return hasPatternRisk("spam_like_text", normalizedText);
    }
  },
  {
    checkName: "suspicious_link_or_url",
    detectRisk: (normalizedText) => {
      return hasUrlOrLink(normalizedText);
    }
  },
  {
    checkName: "excessive_repetition",
    detectRisk: (normalizedText) => {
      return hasExcessiveRepetition(normalizedText);
    }
  },
  {
    checkName: "unsafe_or_suspicious_content",
    detectRisk: (normalizedText) => {
      return hasPatternRisk("unsafe_or_suspicious_content", normalizedText);
    }
  }
];

const TEXT_SECURITY_CHECKS: TextSecurityCheckName[] = TEXT_SECURITY_TESTS.map(
  (test) => {
    return test.checkName;
  }
);

function runTextSecurityChecks(
  input: TextSecurityCheckInput
): TextSecurityCheckOutput {
  const output: TextSecurityCheckOutput = {
    checked: [],
    failed: []
  };
  const normalizedText = normalizeSecurityText(input.text);

  for (const test of TEXT_SECURITY_TESTS) {
    const target = test.detectRisk(normalizedText) ? "failed" : "checked";

    output[target].push(test.checkName);
  }

  return output;
}

export {
  TEXT_SECURITY_CHECKS,
  runTextSecurityChecks
};
