import type {LiveMemoryTopicOptimized} from "../../../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";

type SegmentationKnowledge = LiveMemoryTopicOptimized["sourceTopicManager"]["retrieveKnowledge"]["segmentationKnowledge"];

function validateSegmentationKnowledgeOutput(parsedResponse: unknown): SegmentationKnowledge | null {
  if (!isRecord(parsedResponse)) return null;
  if (!hasOnlyKeys(parsedResponse, ["userFacingInformation", "supportFacingInformation"])) return null;

  return {
    isSegmented: true,
    userFacingInformation: validateNullableString(parsedResponse.userFacingInformation),
    supportFacingInformation: validateNullableString(parsedResponse.supportFacingInformation)
  };
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

export {validateSegmentationKnowledgeOutput};
