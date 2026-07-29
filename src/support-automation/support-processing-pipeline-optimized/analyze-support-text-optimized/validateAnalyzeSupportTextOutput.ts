import {formatCatalogSelection} from "./catalogSelection";

type Primitive = string | number | boolean | null;
type ExtractedStatus = "obtained" | "user_declared_unavailable";

type SupportTextSegment = {
  segmentId: string;
  verbatim: string;
};

type SourceGrounding = {
  sourceSegmentIds: string[];
};

type KeyedPrimitiveEvidence = SourceGrounding & {
  key: string;
  value: Primitive;
  evidence: string;
  status: ExtractedStatus;
};

type KeyedOtherEvidence = SourceGrounding & {
  key: string;
  value: Primitive;
  evidence: string;
};

type AttemptedAction = SourceGrounding & {
  action: string;
  outcome: string;
  evidence: string;
  status: ExtractedStatus;
};

type ValidatedSupportTextAnalysis = {
  summaryMessage: string | null;
  userLanguage: string;
  caseDetailsExtracted: KeyedPrimitiveEvidence[];
  attemptedActionsExtracted: AttemptedAction[];
  otherExtracted: KeyedOtherEvidence[];
};

function validateAnalyzeSupportTextOutput(
  parsedResponse: unknown,
  supportSegments: SupportTextSegment[]
): ValidatedSupportTextAnalysis | null {
  if (!isRecord(parsedResponse)) return null;

  const knownSegmentIds = new Set(
    supportSegments.map((segment) => segment.segmentId)
  );

  return {
    summaryMessage: asNullableNonEmptyString(parsedResponse.summaryMessage),
    userLanguage: asNonEmptyString(parsedResponse.userLanguage) ?? "unknown",
    caseDetailsExtracted: validateCaseDetails(
      parsedResponse.caseDetailsExtracted,
      knownSegmentIds
    ),
    attemptedActionsExtracted: validateAttemptedActions(
      parsedResponse.attemptedActionsExtracted,
      knownSegmentIds
    ),
    otherExtracted: validateOtherItems(
      parsedResponse.otherExtracted,
      knownSegmentIds
    )
  };
}

function validateCaseDetails(
  rawItems: unknown,
  knownSegmentIds: Set<string>
): KeyedPrimitiveEvidence[] {
  if (!Array.isArray(rawItems)) return [];

  const items: KeyedPrimitiveEvidence[] = [];

  for (const rawItem of rawItems) {
    const item = validateCaseDetail(rawItem, knownSegmentIds);

    if (item) {
      items.push(item);
    }
  }

  return items;
}

function validateCaseDetail(
  rawItem: unknown,
  knownSegmentIds: Set<string>
): KeyedPrimitiveEvidence | null {
  if (!isRecord(rawItem)) return null;

  const key = asAllowedString(
    rawItem.key,
    formatCatalogSelection.extractableFields
  );

  const value = asPrimitive(rawItem.value);
  const evidence = asNonEmptyString(rawItem.evidence);
  const sourceSegmentIds = validateSourceSegmentIds(
    rawItem.sourceSegmentIds,
    knownSegmentIds
  );

  if (!key || value === undefined || !evidence || sourceSegmentIds.length === 0) {
    return null;
  }

  return {
    key,
    value,
    evidence,
    status: value === null
      ? "user_declared_unavailable"
      : validateStatus(rawItem.status),
    sourceSegmentIds
  };
}

function validateAttemptedActions(
  rawItems: unknown,
  knownSegmentIds: Set<string>
): AttemptedAction[] {
  if (!Array.isArray(rawItems)) return [];

  const attemptedActions: AttemptedAction[] = [];

  for (const rawItem of rawItems) {
    const attemptedAction = validateAttemptedAction(rawItem, knownSegmentIds);

    if (attemptedAction) {
      attemptedActions.push(attemptedAction);
    }
  }

  return attemptedActions;
}

function validateAttemptedAction(
  rawItem: unknown,
  knownSegmentIds: Set<string>
): AttemptedAction | null {
  if (!isRecord(rawItem)) return null;

  const action = asNonEmptyString(rawItem.action);
  const outcome = asAllowedString(
    rawItem.outcome,
    formatCatalogSelection.attemptedActionOutcomes
  );
  const evidence = asNonEmptyString(rawItem.evidence);
  const sourceSegmentIds = validateSourceSegmentIds(
    rawItem.sourceSegmentIds,
    knownSegmentIds
  );

  if (!action || !outcome || !evidence || sourceSegmentIds.length === 0) {
    return null;
  }

  const status = validateStatus(rawItem.status);

  return {
    action,
    outcome: status === "user_declared_unavailable" ? "unknown" : outcome,
    evidence,
    status,
    sourceSegmentIds
  };
}

function validateOtherItems(
  rawItems: unknown,
  knownSegmentIds: Set<string>
): KeyedOtherEvidence[] {
  if (!Array.isArray(rawItems)) return [];

  const items: KeyedOtherEvidence[] = [];

  for (const rawItem of rawItems) {
    const item = validateOtherItem(rawItem, knownSegmentIds);

    if (item) {
      items.push(item);
    }
  }

  return items;
}

function validateOtherItem(
  rawItem: unknown,
  knownSegmentIds: Set<string>
): KeyedOtherEvidence | null {
  if (!isRecord(rawItem)) return null;

  const key = asAllowedString(
    rawItem.key,
    formatCatalogSelection.otherKeys
  );

  const value = asPrimitive(rawItem.value);
  const evidence = asNonEmptyString(rawItem.evidence);
  const sourceSegmentIds = validateSourceSegmentIds(
    rawItem.sourceSegmentIds,
    knownSegmentIds
  );

  if (!key || value === undefined || !evidence || sourceSegmentIds.length === 0) {
    return null;
  }

  return {
    key,
    value,
    evidence,
    sourceSegmentIds
  };
}

function validateSourceSegmentIds(
  rawSourceSegmentIds: unknown,
  knownSegmentIds: Set<string>
): string[] {
  if (!Array.isArray(rawSourceSegmentIds)) return [];

  const sourceSegmentIds: string[] = [];
  const seen = new Set<string>();

  for (const rawId of rawSourceSegmentIds) {
    if (typeof rawId !== "string") continue;
    if (!knownSegmentIds.has(rawId)) continue;
    if (seen.has(rawId)) continue;

    seen.add(rawId);
    sourceSegmentIds.push(rawId);
  }

  return sourceSegmentIds;
}

function validateStatus(value: unknown): ExtractedStatus {
  return value === "user_declared_unavailable"
    ? "user_declared_unavailable"
    : "obtained";
}

function asAllowedString(
  value: unknown,
  allowedValues: readonly string[]
): string | null {
  if (typeof value !== "string") return null;

  return allowedValues.includes(value) ? value : null;
}

function asNullableNonEmptyString(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  return asNonEmptyString(value);
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();

  return trimmed === "" ? null : trimmed;
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
  ExtractedStatus,
  KeyedOtherEvidence,
  KeyedPrimitiveEvidence,
  Primitive,
  SupportTextSegment,
  ValidatedSupportTextAnalysis
};