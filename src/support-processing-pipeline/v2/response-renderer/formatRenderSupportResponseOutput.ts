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

function buildFallbackText(
  input: FormatRenderSupportResponseOutputInput
): string {
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
  _reason: string
): RenderedSupportResponse {
  const finalResponseText = buildFallbackText(input);

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
