import type {LiveMemoryTopicOptimized} from "../../../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";

type RetrieveKnowledgeFilter = LiveMemoryTopicOptimized["sourceTopicManager"]["retrieveKnowledge"]["filter"];

type FilteredCandidate = {
  sourceId: string | null;
  title: string | null;
  summary: string | null;
  usefulInformation: string | null;
  rawExcerpt: string | null;
  keepReason: string;
};

function validateRetrieveKnowledgeFilterOutput(parsedResponse: unknown): RetrieveKnowledgeFilter | null {
  if (!isRecord(parsedResponse)) return null;
  if (!hasOnlyKeys(parsedResponse, ["filteredRagKnowledge", "filterExplanation"])) return null;
  if (!Array.isArray(parsedResponse.filteredRagKnowledge)) return null;

  const filteredRagKnowledge: FilteredCandidate[] = [];

  for (const rawCandidate of parsedResponse.filteredRagKnowledge) {
    const candidate = validateFilteredCandidate(rawCandidate);
    if (!candidate) return null;
    filteredRagKnowledge.push(candidate);
  }

  const filterExplanation = validateString(parsedResponse.filterExplanation);
  if (!filterExplanation) return null;

  return {
    isFiltered: true,
    filteredRagKnowledge,
    filterExplanation
  };
}

function validateFilteredCandidate(value: unknown): FilteredCandidate | null {
  if (!isRecord(value)) return null;
  if (!hasOnlyKeys(value, ["sourceId", "title", "summary", "usefulInformation", "rawExcerpt", "keepReason"])) return null;

  const keepReason = validateString(value.keepReason);
  if (!keepReason) return null;

  return {
    sourceId: validateNullableString(value.sourceId),
    title: validateNullableString(value.title),
    summary: validateNullableString(value.summary),
    usefulInformation: validateNullableString(value.usefulInformation),
    rawExcerpt: validateNullableString(value.rawExcerpt),
    keepReason
  };
}

function validateNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function validateString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: string[]): boolean {
  const allowedKeySet = new Set(allowedKeys);
  return Object.keys(value).every((key) => allowedKeySet.has(key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export {validateRetrieveKnowledgeFilterOutput};
