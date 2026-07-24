import type {ComposedSupportResponsePlan} from "./buildRenderSupportResponsePrompt";

type ValidatedRenderSupportResponseOutput = {
  finalResponseText: string;
};

type RenderSupportResponseValidationInput = {
  composedSupportResponsePlan: ComposedSupportResponsePlan;
  targetLanguage?: string;
  channel?: string;
};

function validateRenderSupportResponseOutput(
  parsedResponse: unknown,
  input: RenderSupportResponseValidationInput
): ValidatedRenderSupportResponseOutput | null {
  if (!isRecord(parsedResponse)) return null;
  if (typeof parsedResponse.finalResponseText !== "string") return null;

  const finalResponseText = parsedResponse.finalResponseText.trim();

  if (finalResponseText === "") return null;
  if (exposesInternalOrTechnicalDetails(finalResponseText)) return null;

  if (
    isFrenchLanguage(input.targetLanguage) &&
    isManifestlyEnglishForFrenchTarget(finalResponseText)
  ) {
    return null;
  }

  return {finalResponseText};
}

function buildDeterministicRenderedSupportResponse(input: RenderSupportResponseValidationInput): ValidatedRenderSupportResponseOutput {
  const firstSay = input.composedSupportResponsePlan.say.find((item) => {
    return typeof item === "string" && item.trim() !== "";
  })?.trim();

  if (firstSay) {
    return {finalResponseText: firstSay};
  }

  if (isFrenchLanguage(input.targetLanguage)) {
    return {
      finalResponseText: "Je n’ai pas assez d’informations pour répondre correctement. Pouvez-vous préciser votre demande ?"
    };
  }

  return {
    finalResponseText: "I do not have enough information to answer correctly. Could you please clarify your request?"
  };
}

function isFrenchLanguage(value: string | undefined): boolean {
  const language = value?.toLowerCase();

  return language === "fr" ||
    language === "fr-fr" ||
    language === "french" ||
    language?.startsWith("fr-") === true;
}

function hasBasicFrenchMarker(value: string): boolean {
  return /\b(bonjour|merci|vous|votre|vos|pouvez|pouvez-vous|je|j['’]|comprends|probl[eè]me|erreur|quel|quelle|pourriez|pouvez)\b/iu
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
  if (hasBasicFrenchMarker(value)) return false;

  return hasObviousEnglishOpening(value) || hasObviousEnglishSupportPhrase(value);
}

function exposesInternalOrTechnicalDetails(value: string): boolean {
  return /\b(RAG|retrieval|catalog|planner|pipeline|renderer|topicIds?|debug logs?|internal logs?|stack trace|implementationStatus|nextTopicMemoryPatch|internalReasonCodes|API key|token|secret)\b/iu
    .test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export {
  buildDeterministicRenderedSupportResponse,
  validateRenderSupportResponseOutput
};

export type {
  RenderSupportResponseValidationInput,
  ValidatedRenderSupportResponseOutput
};
