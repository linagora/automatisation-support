import {formatCatalogSelection} from "./catalogSelection";

// LLM output validation:
// Validates the parsed JSON returned by the support text analysis LLM.
// This file does not call the LLM, build prompts, repair output, or decide fallbacks.

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

// Validates the top-level LLM payload and checks that no support segment was dropped.
function validateAnalyzeSupportTextOutput(
  parsedResponse: unknown,
  supportSegments: SupportTextSegment[]
): ValidatedSupportTextUnderstanding[] | null {
  if (!isRecord(parsedResponse)) return null;
  if (!Array.isArray(parsedResponse.understandings)) return null;

  const segmentById = new Map(supportSegments.map((segment) => [segment.segmentId, segment]));
  const coveredSegmentIds = new Set<string>();
  const understandings: ValidatedSupportTextUnderstanding[] = [];

  for (const rawUnderstanding of parsedResponse.understandings) {
    const understanding = validateSupportTextUnderstanding(rawUnderstanding, supportSegments, segmentById);
    if (!understanding) return null;

    understandings.push(understanding);

    for (const sourceSegmentId of understanding.sourceSegmentIds) {
      coveredSegmentIds.add(sourceSegmentId);
    }
  }

  if (!supportSegments.every((segment) => coveredSegmentIds.has(segment.segmentId))) {
    return null;
  }

  return understandings;
}

// Validates one understanding and grounds all evidence against its referenced segments.
function validateSupportTextUnderstanding(
  rawUnderstanding: unknown,
  supportSegments: SupportTextSegment[],
  segmentById: Map<string, SupportTextSegment>
): ValidatedSupportTextUnderstanding | null {
  if (!isRecord(rawUnderstanding)) return null;

  const sourceSegmentIds = validateSourceSegmentIds(rawUnderstanding.sourceSegmentIds, supportSegments);
  if (!sourceSegmentIds) return null;

  const referencedSegments = sourceSegmentIds.map((segmentId) => segmentById.get(segmentId));
  if (referencedSegments.some((segment) => segment === undefined)) return null;
  if (!hasOnlyKeys(rawUnderstanding, [
    "sourceSegmentIds",
    "caseDetailsExtracted",
    "attemptedActionsExtracted",
    "other",
    "summaryMessage"
  ])) return null;

  const segments = referencedSegments as SupportTextSegment[];
  const caseDetailsExtracted = validateKeyedPrimitiveEvidenceArray(
    rawUnderstanding.caseDetailsExtracted,
    formatCatalogSelection.extractableFields,
    segments
  );
  const attemptedActionsExtracted = validateAttemptedActions(rawUnderstanding["attemptedActionsExtracted"], segments);
  const other = validateKeyedOtherEvidenceArray(
    rawUnderstanding.other,
    formatCatalogSelection.otherKeys,
    segments
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
  supportSegments: SupportTextSegment[]
): string[] | null {
  if (!Array.isArray(rawSourceSegmentIds) || rawSourceSegmentIds.length === 0) return null;

  const inputOrder = new Map(supportSegments.map((segment, index) => [segment.segmentId, index]));
  const seen = new Set<string>();
  let previousIndex = -1;
  const sourceSegmentIds: string[] = [];

  for (const value of rawSourceSegmentIds) {
    if (typeof value !== "string") return null;

    const index = inputOrder.get(value);
    if (index === undefined) return null;
    if (seen.has(value)) return null;
    if (index <= previousIndex) return null;

    previousIndex = index;
    seen.add(value);
    sourceSegmentIds.push(value);
  }

  return sourceSegmentIds;
}

// Shared validator for arrays shaped as {key, value, evidence}.
function validateKeyedPrimitiveEvidenceArray(
  rawItems: unknown,
  allowedKeys: readonly string[],
  segments: SupportTextSegment[]
): KeyedPrimitiveEvidence[] | null {
  if (!Array.isArray(rawItems)) return null;

  const items: KeyedPrimitiveEvidence[] = [];

  for (const rawItem of rawItems) {
    if (!isRecord(rawItem)) return null;

    const key = validateEnumValue(rawItem.key, allowedKeys);
    const value = asPrimitive(rawItem.value);
    const status = validateExtractedStatus(rawItem.status);

    if (!key || value === undefined || !status || !containsExactEvidence(rawItem.evidence, segments)) {
      return null;
    }

    items.push({
      key,
      value,
      evidence: rawItem.evidence,
      status
    });
  }

  return items;
}

function validateAttemptedActions(
  rawItems: unknown,
  segments: SupportTextSegment[]
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

    if (
      typeof rawItem.action !== "string" ||
      rawItem.action.trim() === "" ||
      !outcome ||
      !status ||
      !containsExactEvidence(rawItem.evidence, segments)
    ) {
      return null;
    }

    attemptedActions.push({
      action: rawItem.action,
      outcome,
      evidence: rawItem.evidence,
      status
    });
  }

  return attemptedActions;
}

function validateKeyedOtherEvidenceArray(
  rawItems: unknown,
  allowedKeys: readonly string[],
  segments: SupportTextSegment[]
): KeyedOtherEvidence[] | null {
  if (!Array.isArray(rawItems)) return null;

  const items: KeyedOtherEvidence[] = [];

  for (const rawItem of rawItems) {
    if (!isRecord(rawItem)) return null;

    const key = validateEnumValue(rawItem.key, allowedKeys);
    const value = asPrimitive(rawItem.value);

    if (!key || value === undefined || !containsExactEvidence(rawItem.evidence, segments)) {
      return null;
    }

    items.push({
      key,
      value,
      evidence: rawItem.evidence
    });
  }

  return items;
}

function validateEnumValue(value: unknown, allowedValues: readonly string[]): string | null {
  return typeof value === "string" && allowedValues.includes(value) ? value : null;
}

function validateExtractedStatus(value: unknown): ExtractedStatus | null {
  return value === "obtained" || value === "user_declared_unavailable"
    ? value
    : null;
}

function containsExactEvidence(value: unknown, segments: SupportTextSegment[]): value is string {
  return typeof value === "string" &&
    value.trim() !== "" &&
    segments.some((segment) => segment.verbatim.includes(value));
}

function asPrimitive(value: unknown): Primitive | undefined {
  if (value === null) return null;
  if (typeof value === "string") return value.trim() === "" ? undefined : value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "boolean") return value;
  return undefined;
}

// Small runtime guards for unknown parsed JSON.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: string[]): boolean {
  const allowedKeySet = new Set(allowedKeys);
  return Object.keys(value).every((key) => allowedKeySet.has(key));
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
