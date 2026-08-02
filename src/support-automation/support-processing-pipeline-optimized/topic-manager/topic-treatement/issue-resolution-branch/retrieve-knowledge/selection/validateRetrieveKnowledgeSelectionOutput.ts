import type {LiveMemoryIssueRetrieveKnowledge} from "../../../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";

type RetrieveKnowledgeSelection = LiveMemoryIssueRetrieveKnowledge["selection"];

function validateRetrieveKnowledgeSelectionOutput(
  parsedResponse: unknown,
  validRawKnowledgeIds: string[]
): RetrieveKnowledgeSelection | null {
  if (!isRecord(parsedResponse)) return null;
  if (!hasOnlyKeys(parsedResponse, ["isClearSelected", "selectedRawKnowledgeIds", "clarificationQuestion", "selectionExplanation"])) return null;
  if (typeof parsedResponse.isClearSelected !== "boolean") return null;
  if (!Array.isArray(parsedResponse.selectedRawKnowledgeIds)) return null;

  const selectedRawKnowledgeIds = validateSelectedRawKnowledgeIds(
    parsedResponse.selectedRawKnowledgeIds,
    validRawKnowledgeIds
  );
  const clarificationQuestion = validateNullableNonEmptyString(parsedResponse.clarificationQuestion);
  const selectionExplanation = validateNullableNonEmptyString(parsedResponse.selectionExplanation);

  if (!parsedResponse.isClearSelected) {
    if (!clarificationQuestion) return null;

    return {
      isClearSelected: false,
      selectedRawKnowledgeIds,
      clarificationQuestion,
      selectionExplanation
    };
  }

  if (parsedResponse.clarificationQuestion !== null) return null;

  return {
    isClearSelected: true,
    selectedRawKnowledgeIds,
    clarificationQuestion: null,
    selectionExplanation
  };
}

function validateSelectedRawKnowledgeIds(
  rawIds: unknown[],
  validRawKnowledgeIds: string[]
): string[] {
  const validIdSet = new Set(validRawKnowledgeIds);
  const selectedRawKnowledgeIds: string[] = [];

  for (const rawId of rawIds) {
    if (typeof rawId !== "string") continue;
    if (!validIdSet.has(rawId)) continue;
    if (selectedRawKnowledgeIds.includes(rawId)) continue;
    selectedRawKnowledgeIds.push(rawId);
  }

  return selectedRawKnowledgeIds;
}

function validateNullableNonEmptyString(value: unknown): string | null {
  if (value === null) return null;
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
