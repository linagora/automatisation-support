import type {LiveMemoryTopicOptimized} from "../../../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";

type RetrieveKnowledgeFilter = LiveMemoryTopicOptimized["sourceTopicManager"]["retrieveKnowledge"]["filter"];

function validateRetrieveKnowledgeFilterOutput(
  parsedResponse: unknown,
  validRawKnowledgeIds: string[]
): RetrieveKnowledgeFilter | null {
  if (!isRecord(parsedResponse)) return null;
  if (!hasOnlyKeys(parsedResponse, ["keptRawKnowledgeIds", "filterExplanation"])) return null;
  if (!Array.isArray(parsedResponse.keptRawKnowledgeIds)) return null;

  return {
    isFiltered: true,
    keptRawKnowledgeIds: validateKeptRawKnowledgeIds(
      parsedResponse.keptRawKnowledgeIds,
      validRawKnowledgeIds
    ),
    filterExplanation: validateNullableString(parsedResponse.filterExplanation)
  };
}

function validateKeptRawKnowledgeIds(
  rawIds: unknown[],
  validRawKnowledgeIds: string[]
): string[] {
  const validIdSet = new Set(validRawKnowledgeIds);
  const keptRawKnowledgeIds: string[] = [];

  for (const rawId of rawIds) {
    if (typeof rawId !== "string") continue;
    if (!validIdSet.has(rawId)) continue;
    if (keptRawKnowledgeIds.includes(rawId)) continue;
    keptRawKnowledgeIds.push(rawId);
  }

  return keptRawKnowledgeIds;
}

function validateNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: string[]): boolean {
  const allowedKeySet = new Set(allowedKeys);
  return Object.keys(value).every((key) => allowedKeySet.has(key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export {validateRetrieveKnowledgeFilterOutput};
