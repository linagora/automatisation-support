import type {SegmentationKnowledge} from "./runSegmentationKnowledge--oneShotStep";
type SegmentedKnowledgeBySource = SegmentationKnowledge["segmentedKnowledge"][number];
type SegmentedKnowledgePiece = SegmentedKnowledgeBySource["userFacingKnowledge"][number];

function validateSegmentationKnowledgeOutput(
  parsedResponse: unknown,
  validSelectedRawKnowledgeIds: string[]
): SegmentationKnowledge | null {
  if (!isRecord(parsedResponse)) return null;
  if (!hasOnlyKeys(parsedResponse, ["segmentedKnowledge"])) return null;
  if (!Array.isArray(parsedResponse.segmentedKnowledge)) return null;

  return {
    isSegmented: true,
    segmentedKnowledge: validateSegmentedKnowledge(
      parsedResponse.segmentedKnowledge,
      validSelectedRawKnowledgeIds
    )
  };
}

function validateSegmentedKnowledge(
  rawSegmentedKnowledge: unknown[],
  validSelectedRawKnowledgeIds: string[]
): SegmentedKnowledgeBySource[] {
  const validIdSet = new Set(validSelectedRawKnowledgeIds);
  const seenRawKnowledgeIds = new Set<string>();
  const segmentedKnowledge: SegmentedKnowledgeBySource[] = [];

  for (const rawSource of rawSegmentedKnowledge) {
    const source = validateSegmentedKnowledgeBySource(rawSource, validIdSet);
    if (!source) continue;
    if (seenRawKnowledgeIds.has(source.rawKnowledgeId)) continue;

    seenRawKnowledgeIds.add(source.rawKnowledgeId);
    segmentedKnowledge.push(source);
  }

  return segmentedKnowledge;
}

function validateSegmentedKnowledgeBySource(
  value: unknown,
  validIdSet: Set<string>
): SegmentedKnowledgeBySource | null {
  if (!isRecord(value)) return null;
  if (!hasOnlyKeys(value, ["rawKnowledgeId", "userFacingKnowledge", "supportFacingKnowledge"])) return null;

  const rawKnowledgeId = validateNonEmptyString(value.rawKnowledgeId);
  if (!rawKnowledgeId || !validIdSet.has(rawKnowledgeId)) return null;
  if (!Array.isArray(value.userFacingKnowledge)) return null;
  if (!Array.isArray(value.supportFacingKnowledge)) return null;

  const userFacingKnowledge = validateSegmentedKnowledgePieces(value.userFacingKnowledge);
  const supportFacingKnowledge = validateSegmentedKnowledgePieces(value.supportFacingKnowledge);

  if (userFacingKnowledge.length === 0 && supportFacingKnowledge.length === 0) {
    return null;
  }

  return {
    rawKnowledgeId,
    userFacingKnowledge,
    supportFacingKnowledge
  };
}

function validateSegmentedKnowledgePieces(rawPieces: unknown[]): SegmentedKnowledgePiece[] {
  return rawPieces.flatMap((rawPiece) => {
    if (!isRecord(rawPiece)) return [];
    if (!hasOnlyKeys(rawPiece, ["text", "sourceHint", "sourceSpan"])) return [];

    const text = validateNonEmptyString(rawPiece.text);
    if (!text) return [];

    return [
      {
        text,
        sourceHint: validateNullableString(rawPiece.sourceHint),
        sourceSpan: validateNullableString(rawPiece.sourceSpan)
      }
    ];
  });
}

function validateNullableString(value: unknown): string | null {
  if (value === null) return null;
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

export {validateSegmentationKnowledgeOutput};
