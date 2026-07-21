import {formatCatalogSelection} from "./catalogSelection";

// LLM output validation:
// Validates the parsed JSON returned by the support text analysis LLM.
// This file does not call the LLM, build prompts, repair output, or decide fallbacks.

type Primitive = string | number | boolean | null;

type SupportTextSegment = {
  segmentId: string;
  verbatim: string;
};

type KeyedPrimitiveEvidence = {
  key: string;
  value: Primitive;
  evidence: string;
};

type AttemptedAction = {
  action: string;
  outcome: string;
  evidence: string;
};

type ValidatedSupportTextUnderstanding = {
  sourceSegmentIds: string[];
  extractedFields: KeyedPrimitiveEvidence[];
  attemptedActions: AttemptedAction[];
  other: KeyedPrimitiveEvidence[];
  summary: string;
  supportDomain: string;
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
    "extractedFields",
    "attemptedActions",
    "other",
    "summary",
    "supportDomain"
  ])) return null;

  const segments = referencedSegments as SupportTextSegment[];
  const extractedFields = validateKeyedPrimitiveEvidenceArray(
    rawUnderstanding.extractedFields,
    formatCatalogSelection.extractableFields,
    segments
  );
  const attemptedActions = validateAttemptedActions(rawUnderstanding.attemptedActions, segments);
  const other = validateKeyedPrimitiveEvidenceArray(
    rawUnderstanding.other,
    formatCatalogSelection.otherKeys,
    segments
  );
  const supportDomain = validateSupportDomain(rawUnderstanding.supportDomain);

  if (
    !extractedFields ||
    !attemptedActions ||
    !other ||
    !supportDomain ||
    typeof rawUnderstanding.summary !== "string" ||
    rawUnderstanding.summary.trim() === ""
  ) {
    return null;
  }

  return {
    sourceSegmentIds,
    extractedFields,
    attemptedActions,
    other,
    summary: rawUnderstanding.summary,
    supportDomain
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

    if (
      typeof rawItem.action !== "string" ||
      rawItem.action.trim() === "" ||
      !outcome ||
      !containsExactEvidence(rawItem.evidence, segments)
    ) {
      return null;
    }

    attemptedActions.push({
      action: rawItem.action,
      outcome,
      evidence: rawItem.evidence
    });
  }

  return attemptedActions;
}

function validateSupportDomain(value: unknown): string | null {
  return value === "unknown"
    ? value
    : validateEnumValue(value, formatCatalogSelection.supportDomains);
}

function validateEnumValue(value: unknown, allowedValues: readonly string[]): string | null {
  return typeof value === "string" && allowedValues.includes(value) ? value : null;
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
