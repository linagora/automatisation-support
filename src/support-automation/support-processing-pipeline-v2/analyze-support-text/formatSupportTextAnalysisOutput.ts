import type {
  FormatSupportTextAnalysisOutputInput,
  SupportTextSegment,
  SupportTextValidationResult,
  TextUnderstanding
} from "./typesAnalyzeSupportText.types";
import {
  ATTEMPTED_ACTION_OUTCOME_VALUES,
  MESSAGE_KIND_VALUES,
  SUPPORT_METADATA_FIELD_CATALOG
} from "../support-text-analysis.catalog";

type Primitive = string | number | boolean | null;

type Removed = {
  sourceSegmentIds?: string[];
  unitIndex?: number;
  field: string;
  reason: string;
};

type Rejected = {
  sourceSegmentIds?: string[];
  unitIndex: number;
  reason: string;
};

type SegmentDebug = {
  segmentId: string;
  fallbackUsed: boolean;
  fallbackScope?: "global" | "local";
  fallbackReason?: string;
};

type Debug = {
  fallbackScope: "none" | "global" | "local";
  validationReason?: string;
  segments: SegmentDebug[];
  rejectedUnits: Rejected[];
  removedSecondaryElements: Removed[];
};

type DebugResult = {
  result: SupportTextValidationResult;
  debug: Debug;
};

type Draft = {
  sourceSegmentIds: string[];
  messageKinds: NonNullable<TextUnderstanding["messageKinds"]>;
  caseDetails: NonNullable<TextUnderstanding["caseDetails"]>;
  attemptedActions: NonNullable<TextUnderstanding["attemptedActions"]>;
  supportMetadata: NonNullable<TextUnderstanding["supportMetadata"]>;
  summary: string;
};

type ItemResult =
  | { ok: true; item: Draft; removed: Removed[] }
  | { ok: false; sourceSegmentIds?: string[]; reason: string; removed: Removed[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== "";

const isOneOf = <T extends string>(
  value: unknown,
  allowed: readonly T[]
): value is T =>
  typeof value === "string" && allowed.includes(value as T);

const asPrimitive = (value: unknown): Primitive | undefined => {
  if (value === null) return null;
  if (typeof value === "string") return value.trim() ? value : undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  return typeof value === "boolean" ? value : undefined;
};

const containsExact = (
  value: unknown,
  segments: SupportTextSegment[]
): value is string =>
  isString(value) && segments.some((segment) => segment.verbatim.includes(value));

const isSnakeCaseKey = (value: string): boolean =>
  /^[a-z][a-z0-9_]{1,80}$/.test(value);

const removal = (
  sourceSegmentIds: string[] | undefined,
  unitIndex: number | undefined,
  field: string,
  reason: string
): Removed => ({
  ...(sourceSegmentIds ? { sourceSegmentIds } : {}),
  ...(unitIndex !== undefined ? { unitIndex } : {}),
  field,
  reason
});

function buildFallbackTextUnderstanding(
  segment: SupportTextSegment,
  understandingIndex = 1
): TextUnderstanding {
  return {
    understandingId: `text_understanding_${understandingIndex}`,
    sourceSegmentIds: [segment.segmentId],
    messageKinds: [],
    caseDetails: [],
    attemptedActions: [],
    supportMetadata: [],
    summary: segment.verbatim
  };
}

const globalFallback = (segments: SupportTextSegment[]): TextUnderstanding[] =>
  segments.map((segment, index) => buildFallbackTextUnderstanding(segment, index + 1));

function parseSourceSegmentIds(
  raw: unknown,
  supportSegments: SupportTextSegment[]
): string[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;

  const inputOrder = new Map(
    supportSegments.map((segment, index) => [segment.segmentId, index])
  );
  const seen = new Set<string>();
  const ids: string[] = [];

  for (const value of raw) {
    if (!isString(value)) return undefined;

    const id = value.trim();
    if (!inputOrder.has(id) || seen.has(id)) return undefined;

    seen.add(id);
    ids.push(id);
  }

  return ids.sort((first, second) => {
    return (inputOrder.get(first) ?? 0) - (inputOrder.get(second) ?? 0);
  });
}

function parseMessageKinds(
  raw: unknown,
  referencedSegments: SupportTextSegment[]
): Draft["messageKinds"] | undefined {
  if (!Array.isArray(raw)) return undefined;

  return raw.flatMap((entry): Draft["messageKinds"] => {
    if (
      !isRecord(entry) ||
      !isOneOf(entry.kind, MESSAGE_KIND_VALUES) ||
      !containsExact(entry.evidence, referencedSegments)
    ) {
      return [];
    }

    return [{
      kind: entry.kind,
      evidence: entry.evidence
    }];
  });
}

function parseCaseDetails(
  raw: unknown,
  referencedSegments: SupportTextSegment[],
  allowedFields: Set<string>
): Draft["caseDetails"] | undefined {
  if (!Array.isArray(raw)) return undefined;

  return raw.flatMap((detail): Draft["caseDetails"] => {
    if (
      !isRecord(detail) ||
      !isString(detail.key) ||
      !containsExact(detail.evidence, referencedSegments)
    ) {
      return [];
    }

    const key = detail.key.trim();
    const value = asPrimitive(detail.value);

    if (value === undefined) return [];
    if (!allowedFields.has(key) && !isSnakeCaseKey(key)) return [];

    return [{
      key,
      value,
      evidence: detail.evidence
    }];
  });
}

function parseAttemptedActions(
  raw: unknown,
  referencedSegments: SupportTextSegment[]
): Draft["attemptedActions"] | undefined {
  if (!Array.isArray(raw)) return undefined;

  return raw.flatMap((action): Draft["attemptedActions"] => {
    if (
      !isRecord(action) ||
      !isString(action.action) ||
      !isOneOf(action.outcome, ATTEMPTED_ACTION_OUTCOME_VALUES) ||
      !containsExact(action.evidence, referencedSegments)
    ) {
      return [];
    }

    return [{
      action: action.action.trim(),
      outcome: action.outcome,
      evidence: action.evidence
    }];
  });
}

function parseSupportMetadata(
  raw: unknown,
  referencedSegments: SupportTextSegment[],
  allowedFields: Set<string>
): Draft["supportMetadata"] | undefined {
  if (!Array.isArray(raw)) return undefined;

  return raw.flatMap((metadata): Draft["supportMetadata"] => {
    if (
      !isRecord(metadata) ||
      !isString(metadata.key) ||
      !containsExact(metadata.evidence, referencedSegments)
    ) {
      return [];
    }

    const key = metadata.key.trim();
    const value = asPrimitive(metadata.value);

    if (value === undefined) return [];
    if (!allowedFields.has(key) && !isSnakeCaseKey(key)) return [];

    return [{
      key,
      value,
      evidence: metadata.evidence
    }];
  });
}

function normalizeItem(params: {
  raw: Record<string, unknown>;
  supportSegments: SupportTextSegment[];
  segmentById: Map<string, SupportTextSegment>;
  allowedFields: Set<string>;
  allowedMetadataFields: Set<string>;
  unitIndex: number;
}): ItemResult {
  const sourceSegmentIds = parseSourceSegmentIds(
    params.raw.sourceSegmentIds,
    params.supportSegments
  );

  if (!sourceSegmentIds) {
    return {
      ok: false,
      reason: "invalid_source_segment_ids",
      removed: []
    };
  }

  const referencedSegments = sourceSegmentIds.map((id) => params.segmentById.get(id));

  if (referencedSegments.some((segment) => segment === undefined)) {
    return {
      ok: false,
      sourceSegmentIds,
      reason: "unknown_source_segment_id",
      removed: []
    };
  }

  const segments = referencedSegments as SupportTextSegment[];

  if (!isString(params.raw.summary)) {
    return {
      ok: false,
      sourceSegmentIds,
      reason: "invalid_summary",
      removed: []
    };
  }

  const removed: Removed[] = [];

  const messageKinds = parseMessageKinds(params.raw.messageKinds, segments);
  const caseDetails = parseCaseDetails(
    params.raw.caseDetails,
    segments,
    params.allowedFields
  );
  const attemptedActions = parseAttemptedActions(params.raw.attemptedActions, segments);
  const supportMetadata = parseSupportMetadata(
    params.raw.supportMetadata,
    segments,
    params.allowedMetadataFields
  );

  if (params.raw.messageKinds != null && messageKinds === undefined) {
    removed.push(removal(sourceSegmentIds, params.unitIndex, "messageKinds", "not_array"));
  }

  if (params.raw.caseDetails != null && caseDetails === undefined) {
    removed.push(removal(sourceSegmentIds, params.unitIndex, "caseDetails", "not_array"));
  }

  if (params.raw.attemptedActions != null && attemptedActions === undefined) {
    removed.push(removal(sourceSegmentIds, params.unitIndex, "attemptedActions", "not_array"));
  }

  if (params.raw.supportMetadata != null && supportMetadata === undefined) {
    removed.push(removal(sourceSegmentIds, params.unitIndex, "supportMetadata", "not_array"));
  }

  return {
    ok: true,
    item: {
      sourceSegmentIds,
      messageKinds: messageKinds ?? [],
      caseDetails: caseDetails ?? [],
      attemptedActions: attemptedActions ?? [],
      supportMetadata: supportMetadata ?? [],
      summary: params.raw.summary.trim()
    },
    removed
  };
}

const assignIds = (drafts: Draft[]): TextUnderstanding[] =>
  drafts.map((draft, index) => ({
    understandingId: `text_understanding_${index + 1}`,
    ...draft
  }));

function globalDebug(segments: SupportTextSegment[], reason: string): Debug {
  return {
    fallbackScope: "global",
    validationReason: reason,
    segments: segments.map((segment) => ({
      segmentId: segment.segmentId,
      fallbackUsed: true,
      fallbackScope: "global",
      fallbackReason: reason
    })),
    rejectedUnits: [],
    removedSecondaryElements: []
  };
}

function formatSupportTextAnalysisOutputWithDebug(
  input: FormatSupportTextAnalysisOutputInput
): DebugResult {
  if (input.rawSupportTextAnalysis.status !== "completed") {
    const reason = "llm_call_failed";

    return {
      result: {
        status: "invalid",
        reason,
        textUnderstandings: globalFallback(input.supportSegments),
        supportResponseCues: []
      },
      debug: globalDebug(input.supportSegments, reason)
    };
  }

  const parsed = input.rawSupportTextAnalysis.parsedResponse;

  if (!isRecord(parsed) || !Array.isArray(parsed.items)) {
    const reason = "invalid_json";

    return {
      result: {
        status: "invalid",
        reason,
        textUnderstandings: globalFallback(input.supportSegments),
        supportResponseCues: []
      },
      debug: globalDebug(input.supportSegments, reason)
    };
  }

  const segmentById = new Map(
    input.supportSegments.map((segment) => [segment.segmentId, segment])
  );
  const allowedFields = new Set(
    input.extractableFieldCatalog.map((field) => field.fieldName)
  );
  const allowedMetadataFields = new Set(
    SUPPORT_METADATA_FIELD_CATALOG.map((field) => field.fieldName)
  );

  const drafts: Draft[] = [];
  const coveredSegmentIds = new Set<string>();
  const rejectedUnits: Rejected[] = [];
  const removedSecondaryElements: Removed[] = [];

  parsed.items.forEach((raw, unitIndex) => {
    if (!isRecord(raw)) {
      rejectedUnits.push({ unitIndex, reason: "unit_not_object" });
      return;
    }

    const normalized = normalizeItem({
      raw,
      supportSegments: input.supportSegments,
      segmentById,
      allowedFields,
      allowedMetadataFields,
      unitIndex
    });

    removedSecondaryElements.push(...normalized.removed);

    if (!normalized.ok) {
      rejectedUnits.push({
        ...(normalized.sourceSegmentIds
          ? { sourceSegmentIds: normalized.sourceSegmentIds }
          : {}),
        unitIndex,
        reason: normalized.reason
      });
      return;
    }

    drafts.push(normalized.item);

    for (const sourceSegmentId of normalized.item.sourceSegmentIds) {
      coveredSegmentIds.add(sourceSegmentId);
    }
  });

  const segments: SegmentDebug[] = [];
  let hasLocalFallback = false;

  for (const segment of input.supportSegments) {
    if (coveredSegmentIds.has(segment.segmentId)) {
      segments.push({
        segmentId: segment.segmentId,
        fallbackUsed: false
      });
      continue;
    }

    hasLocalFallback = true;

    drafts.push({
      sourceSegmentIds: [segment.segmentId],
      messageKinds: [],
      caseDetails: [],
      attemptedActions: [],
      supportMetadata: [],
      summary: segment.verbatim
    });

    segments.push({
      segmentId: segment.segmentId,
      fallbackUsed: true,
      fallbackScope: "local",
      fallbackReason: "missing_valid_understanding"
    });
  }

  const textUnderstandings = assignIds(drafts);

  const debug: Debug = {
    fallbackScope: hasLocalFallback ? "local" : "none",
    ...(hasLocalFallback ? { validationReason: "invalid_segment_item" } : {}),
    segments,
    rejectedUnits,
    removedSecondaryElements
  };

  return hasLocalFallback
    ? {
        result: {
          status: "invalid",
          reason: "invalid_segment_item",
          textUnderstandings,
          supportResponseCues: []
        },
        debug
      }
    : {
        result: {
          status: "valid",
          textUnderstandings,
          supportResponseCues: []
        },
        debug
      };
}

function formatSupportTextAnalysisOutput(
  input: FormatSupportTextAnalysisOutputInput
): SupportTextValidationResult {
  return formatSupportTextAnalysisOutputWithDebug(input).result;
}

export {
  buildFallbackTextUnderstanding,
  formatSupportTextAnalysisOutput,
  formatSupportTextAnalysisOutputWithDebug
};
