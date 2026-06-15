import {
  runTextSecurityChecks
} from "../../message-analysis/security-functions/shared/runTextSecurityChecks";

import type {
  DetectSuspiciousPromptPatternsInput,
  PromptSecuritySignals
} from "./typesDetectSuspiciousPromptPatterns.types";

function normalizePromptPatternSeparators(text: string): string {
  return text
    .replace(/[^\p{L}\p{N}:/._-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function detectSuspiciousPromptPatterns(
  input: DetectSuspiciousPromptPatternsInput
): PromptSecuritySignals {
  const matchedPatternIds = new Set<string>();
  const textVariants = new Set([
    input.latestUserMessage.content,
    normalizePromptPatternSeparators(input.latestUserMessage.content)
  ]);

  for (const text of textVariants) {
    const textSecurityChecks = runTextSecurityChecks({
      text
    });

    for (const failedCheck of textSecurityChecks.failed) {
      matchedPatternIds.add(failedCheck);
    }
  }

  return {
    matchedPatternIds: [...matchedPatternIds]
  };
}

export {
  detectSuspiciousPromptPatterns
};
