import type {LiveMemoryTopicOptimized} from "../../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";

type RetrieveKnowledgeSelection = LiveMemoryTopicOptimized["sourceTopicManager"]["retrieveKnowledge"]["selection"];

type SelectedCandidate = {
  sourceId: string | null;
  title: string | null;
  usefulInformation: string | null;
  whySelected: string;
};

function validateRetrieveKnowledgeSelectionOutput(parsedResponse: unknown): RetrieveKnowledgeSelection | null {
  if (!isRecord(parsedResponse)) return null;
  if (!hasOnlyKeys(parsedResponse, ["isClearSelected", "clarificationQuestion", "selectedfilteredRagKnowledge", "selectionExplanation"])) return null;
  if (typeof parsedResponse.isClearSelected !== "boolean") return null;

  const selectionExplanation = validateNonEmptyString(parsedResponse.selectionExplanation);
  if (!selectionExplanation) return null;

  if (!parsedResponse.isClearSelected) {
    const clarificationQuestion = validateNonEmptyString(parsedResponse.clarificationQuestion);
    if (!clarificationQuestion) return null;
    if (parsedResponse.selectedfilteredRagKnowledge !== null) return null;

    return {
      isClearSelected: false,
      clarificationQuestion,
      selectedfilteredRagKnowledge: null,
      selectionExplanation
    };
  }

  if (parsedResponse.clarificationQuestion !== null) return null;
  if (!Array.isArray(parsedResponse.selectedfilteredRagKnowledge)) return null;
  if (parsedResponse.selectedfilteredRagKnowledge.length === 0) return null;

  const selectedfilteredRagKnowledge: SelectedCandidate[] = [];

  for (const rawCandidate of parsedResponse.selectedfilteredRagKnowledge) {
    const candidate = validateSelectedCandidate(rawCandidate);
    if (!candidate) return null;
    selectedfilteredRagKnowledge.push(candidate);
  }

  return {
    isClearSelected: true,
    clarificationQuestion: null,
    selectedfilteredRagKnowledge,
    selectionExplanation
  };
}

function validateSelectedCandidate(value: unknown): SelectedCandidate | null {
  if (!isRecord(value)) return null;
  if (!hasOnlyKeys(value, ["sourceId", "title", "usefulInformation", "whySelected"])) return null;

  const whySelected = validateNonEmptyString(value.whySelected);
  if (!whySelected) return null;

  return {
    sourceId: validateNullableString(value.sourceId),
    title: validateNullableString(value.title),
    usefulInformation: validateNullableString(value.usefulInformation),
    whySelected
  };
}

function validateNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function validateNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: string[]): boolean {
  const allowedKeySet = new Set(allowedKeys);
  return Object.keys(value).every((key) => allowedKeySet.has(key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export {validateRetrieveKnowledgeSelectionOutput};
