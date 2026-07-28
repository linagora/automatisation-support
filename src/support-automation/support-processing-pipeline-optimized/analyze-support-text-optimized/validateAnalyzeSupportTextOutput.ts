import {formatCatalogSelection} from "./catalogSelection";

// LLM output validation:
// Validates the parsed JSON returned by the support text analysis LLM.
// This validator is intentionally tolerant on grounding details:
// - it validates structure and allowed enum values;
// - it does not require exact verbatim evidence matching;
// - it does not reject harmless extra keys;
// - it does not fail the whole brick because one support segment was not covered.
//
// The goal is to prevent malformed outputs from entering the pipeline,
// without turning small LLM formatting/evidence imperfections into global fallbacks.

type Primitive = string | number | boolean | null;
type ExtractedStatus = "obtained" | "user_declared_unavailable";

type SupportTextSegment = {
  segmentId: string;
  verbatim: string;
};

type KeyedPrimitiveEvidence = {
  key: string;
  value: Primitive;
  evidence: string;
  status: ExtractedStatus;
};

type KeyedOtherEvidence = {
  key: string;
  value: Primitive;
  evidence: string;
};

type AttemptedAction = {
  action: string;
  outcome: string;
  evidence: string;
  status: ExtractedStatus;
};

type ValidatedSupportTextUnderstanding = {
  sourceSegmentIds: string[];
  caseDetailsExtracted: KeyedPrimitiveEvidence[];
  attemptedActionsExtracted: AttemptedAction[];
  other: KeyedOtherEvidence[];
  summaryMessage: string;
};

function validateAnalyzeSupportTextOutput(
  parsedResponse: unknown,
  supportSegments: SupportTextSegment[]
): ValidatedSupportTextUnderstanding[] | null {
  if (!isRecord(parsedResponse)) return null;
  if (!Array.isArray(parsedResponse.understandings)) return null;

  const segmentById = new Map(
    supportSegments.map((segment) => [segment.segmentId, segment])
  );

  const understandings: ValidatedSupportTextUnderstanding[] = [];

  for (const rawUnderstanding of parsedResponse.understandings) {
    const understanding = validateSupportTextUnderstanding(
      rawUnderstanding,
      segmentById
    );

    if (!understanding) {
      return null;
    }

    understandings.push(understanding);
  }

  return understandings;
}

function validateSupportTextUnderstanding(
  rawUnderstanding: unknown,
  segmentById: Map<string, SupportTextSegment>
): ValidatedSupportTextUnderstanding | null {
  if (!isRecord(rawUnderstanding)) return null;

  const sourceSegmentIds = validateSourceSegmentIds(
    rawUnderstanding.sourceSegmentIds,
    segmentById
  );

  if (!sourceSegmentIds) return null;

  const caseDetailsExtracted = validateKeyedPrimitiveEvidenceArray(
    rawUnderstanding.caseDetailsExtracted,
    formatCatalogSelection.extractableFields
  );

  const attemptedActionsExtracted = validateAttemptedActions(
    rawUnderstanding.attemptedActionsExtracted
  );

  const other = validateKeyedOtherEvidenceArray(
    rawUnderstanding.other,
    formatCatalogSelection.otherKeys
  );

  if (
    !caseDetailsExtracted ||
    !attemptedActionsExtracted ||
    !other ||
    typeof rawUnderstanding.summaryMessage !== "string" ||
    rawUnderstanding.summaryMessage.trim() === ""
  ) {
    return null;
  }

  return {
    sourceSegmentIds,
    caseDetailsExtracted,
    attemptedActionsExtracted,
    other,
    summaryMessage: rawUnderstanding.summaryMessage
  };
}

function validateSourceSegmentIds(
  rawSourceSegmentIds: unknown,
  segmentById: Map<string, SupportTextSegment>
): string[] | null {
  if (!Array.isArray(rawSourceSegmentIds) || rawSourceSegmentIds.length === 0) {
    return null;
  }

  const sourceSegmentIds: string[] = [];
  const seen = new Set<string>();

  for (const value of rawSourceSegmentIds) {
    if (typeof value !== "string") return null;
    if (!segmentById.has(value)) return null;

    if (!seen.has(value)) {
      seen.add(value);
      sourceSegmentIds.push(value);
    }
  }

  return sourceSegmentIds;
}

function validateKeyedPrimitiveEvidenceArray(
  rawItems: unknown,
  allowedKeys: readonly string[]
): KeyedPrimitiveEvidence[] | null {
  if (!Array.isArray(rawItems)) return null;

  const items: KeyedPrimitiveEvidence[] = [];

  for (const rawItem of rawItems) {
    if (!isRecord(rawItem)) return null;

    const key = validateEnumValue(rawItem.key, allowedKeys);
    const value = asPrimitive(rawItem.value);
    const status = validateExtractedStatus(rawItem.status);
    const evidence = validateEvidence(rawItem.evidence);

    if (!key || value === undefined || !status || !evidence) {
      return null;
    }

    items.push({
      key,
      value,
      evidence,
      status
    });
  }

  return items;
}

function validateAttemptedActions(
  rawItems: unknown
): AttemptedAction[] | null {
  if (!Array.isArray(rawItems)) return null;

  const attemptedActions: AttemptedAction[] = [];

  for (const rawItem of rawItems) {
    if (!isRecord(rawItem)) return null;

    const outcome = validateEnumValue(
      rawItem.outcome,
      formatCatalogSelection.attemptedActionOutcomes
    );

    const status = validateExtractedStatus(rawItem.status);
    const evidence = validateEvidence(rawItem.evidence);

    if (
      typeof rawItem.action !== "string" ||
      rawItem.action.trim() === "" ||
      !outcome ||
      !status ||
      !evidence
    ) {
      return null;
    }

    attemptedActions.push({
      action: rawItem.action,
      outcome,
      evidence,
      status
    });
  }

  return attemptedActions;
}

function validateKeyedOtherEvidenceArray(
  rawItems: unknown,
  allowedKeys: readonly string[]
): KeyedOtherEvidence[] | null {
  if (!Array.isArray(rawItems)) return null;

  const items: KeyedOtherEvidence[] = [];

  for (const rawItem of rawItems) {
    if (!isRecord(rawItem)) return null;

    const key = validateEnumValue(rawItem.key, allowedKeys);
    const value = asPrimitive(rawItem.value);
    const evidence = validateEvidence(rawItem.evidence);

    if (!key || value === undefined || !evidence) {
      return null;
    }

    items.push({
      key,
      value,
      evidence
    });
  }

  return items;
}

function validateEnumValue(
  value: unknown,
  allowedValues: readonly string[]
): string | null {
  return typeof value === "string" && allowedValues.includes(value)
    ? value
    : null;
}

function validateExtractedStatus(value: unknown): ExtractedStatus | null {
  return value === "obtained" || value === "user_declared_unavailable"
    ? value
    : null;
}

function validateEvidence(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed === "" ? null : value;
}

function asPrimitive(value: unknown): Primitive | undefined {
  if (value === null) return null;
  if (typeof value === "string") return value.trim() === "" ? undefined : value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "boolean") return value;
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export {
  validateAnalyzeSupportTextOutput
};

export type {
  AttemptedAction,
  KeyedPrimitiveEvidence,
  Primitive,
  SupportTextSegment,
  ValidatedSupportTextUnderstanding
};