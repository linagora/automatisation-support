import type {
  FormatRenderSupportResponseOutput,
  FormatRenderSupportResponseOutputInput,
  RawRenderedSupportResponse,
  RenderedSupportResponse
} from "./typesRenderSupportResponse.types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : null;
}

function isFrenchLanguage(value: unknown): boolean {
  const language = asString(value)?.toLowerCase();

  return language === "fr" ||
    language === "fr-fr" ||
    language === "french" ||
    language?.startsWith("fr-") === true;
}

function hasBasicFrenchMarker(value: string): boolean {
  return /\b(bonjour|merci|vous|votre|vos|pouvez|pouvez-vous|je|j['’]|comprends|probl[eè]me|erreur|quel|quelle)\b/iu
    .test(value);
}

function hasObviousEnglishOpening(value: string): boolean {
  return /^(hello|hi|thanks for|thank you|i see|i understand|could you|please let me know)\b/iu
    .test(value.trim());
}

function hasObviousEnglishSupportPhrase(value: string): boolean {
  return /\b(could you|please let me know|i see you(?:'re| are)|you(?:'re| are) having trouble|what exactly happens|which platform)\b/iu
    .test(value);
}

function isManifestlyEnglishForFrenchTarget(value: string): boolean {
  if (hasBasicFrenchMarker(value)) {
    return false;
  }

  return hasObviousEnglishOpening(value) ||
    hasObviousEnglishSupportPhrase(value);
}

function exposesInternalOrTechnicalDetails(value: string): boolean {
  return /\b(RAG|retrieval|catalog|planner|pipeline|renderer|timeout|stack trace|debug logs?|internal logs?|backend|database|deployment|environment variable|feature flag|API key|token|secret|admin console)\b/iu
    .test(value);
}

function buildFallbackText(
  input: FormatRenderSupportResponseOutputInput,
  reason: string
): string {
  if (
    reason === "final_response_language_mismatch" &&
    isFrenchLanguage(input.input.targetLanguage)
  ) {
    return "Je n’ai pas assez d’informations pour répondre correctement. Pouvez-vous préciser votre demande ?";
  }

  if (reason === "internal_or_technical_content_exposed") {
    return isFrenchLanguage(input.input.targetLanguage)
      ? "Je n’ai pas assez d’informations pour répondre correctement. Pouvez-vous préciser votre demande ?"
      : "I do not have enough information to answer correctly. Could you please clarify your request?";
  }

  const firstSay = Array.isArray(input.input.composedSupportResponsePlan.say)
    ? input.input.composedSupportResponsePlan.say.find((item) => {
        return typeof item === "string" && item.trim() !== "";
      })
    : undefined;

  if (firstSay) {
    return firstSay.trim();
  }

  if (isFrenchLanguage(input.input.targetLanguage)) {
    return "Je n’ai pas assez d’informations pour répondre correctement. Pouvez-vous préciser votre demande ?";
  }

  return "I do not have enough information to answer correctly. Could you please clarify your request?";
}

function buildFallbackResponse(
  input: FormatRenderSupportResponseOutputInput,
  reason: string
): RenderedSupportResponse {
  const finalResponseText = buildFallbackText(input, reason);

  return {
    finalResponseText
  };
}

function parseFinalResponseText(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  return asString(value.finalResponseText);
}

function formatRenderSupportResponseOutput(
  input: FormatRenderSupportResponseOutputInput
): FormatRenderSupportResponseOutput {
  if (input.rawRenderSupportResponse.status !== "completed") {
    const reason =
      input.rawRenderSupportResponse.error?.message ?? "llm_call_failed";

    return {
      renderedResponse: buildFallbackResponse(input, reason),
      validation: {
        status: "fallback",
        reason
      }
    };
  }

  const finalResponseText = parseFinalResponseText(
    input.rawRenderSupportResponse.parsedResponse as RawRenderedSupportResponse
  );

  if (!finalResponseText) {
    return {
      renderedResponse: buildFallbackResponse(
        input,
        "invalid_or_missing_final_response_text"
      ),
      validation: {
        status: "fallback",
        reason: "invalid_or_missing_final_response_text"
      }
    };
  }

  if (
    isFrenchLanguage(input.input.targetLanguage) &&
    isManifestlyEnglishForFrenchTarget(finalResponseText)
  ) {
    return {
      renderedResponse: buildFallbackResponse(
        input,
        "final_response_language_mismatch"
      ),
      validation: {
        status: "fallback",
        reason: "final_response_language_mismatch"
      }
    };
  }

  if (exposesInternalOrTechnicalDetails(finalResponseText)) {
    return {
      renderedResponse: buildFallbackResponse(
        input,
        "internal_or_technical_content_exposed"
      ),
      validation: {
        status: "fallback",
        reason: "internal_or_technical_content_exposed"
      }
    };
  }

  return {
    renderedResponse: {
      finalResponseText
    },
    validation: {
      status: "valid"
    }
  };
}

export {
  buildFallbackResponse,
  formatRenderSupportResponseOutput
};
