import {
  BROAD_CATEGORY_HINTS,
  CANDIDATE_FACT_SUPPORT_VALUES,
  CONTEXT_DEPENDENCIES,
  PRIMARY_USER_EXPECTATIONS,
  SUPPORT_NEEDS,
  TESTED_ACTION_OUTCOMES,
  TEXT_UNCERTAINTY_REASONS
} from "./supportTextAnalysis.taxonomy";

import type {
  ContextualAnswer,
  FormatSupportTextAnalysisOutputInput,
  SupportResponseCue,
  SupportFact,
  SupportNeed,
  SupportTextSegment,
  SupportTextValidationResult,
  TestedAction,
  TextUnderstanding,
  TextUncertainty
} from "./typesAnalyzeSupportText.types";

type Draft = Omit<TextUnderstanding, "understandingId">;
type Primitive = string | number | boolean;
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
type ItemResult =
  | { ok: true; item: Draft; removed: Removed[] }
  | { ok: false; sourceSegmentIds?: string[]; reason: string; removed: Removed[] };
type CueResult =
  | { ok: true; cue: Omit<SupportResponseCue, "cueId"> }
  | { ok: false; sourceSegmentIds?: string[]; reason: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== "";

const isOneOf = <T extends string>(value: unknown, allowed: readonly T[]): value is T =>
  typeof value === "string" && allowed.includes(value as T);

const asPrimitive = (value: unknown): Primitive | undefined => {
  if (typeof value === "string") return value.trim() ? value : undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  return typeof value === "boolean" ? value : undefined;
};

const containsExact = (
  value: unknown,
  segments: SupportTextSegment[]
): value is string =>
  isString(value) && segments.some((segment) => segment.verbatim.includes(value));

const removal = (
  sourceSegmentIds: string[],
  unitIndex: number,
  field: string,
  reason: string
): Removed => ({ sourceSegmentIds, unitIndex, field, reason });

function buildFallbackTextUnderstanding(
  segment: SupportTextSegment,
  understandingIndex = 1
): TextUnderstanding {
  return {
    understandingId: `text_understanding_${understandingIndex}`,
    sourceSegmentIds: [segment.segmentId],
    sourceVerbatims: [segment.verbatim],
    summary: segment.verbatim,
    primaryUserExpectation: "unclear",
    supportNeeds: [],
    contextDependency: "needs_context_to_interpret",
    contextualAnswer: {
      type: "reference",
      value: null,
      evidence: segment.verbatim
    },
    facts: [],
    testedActions: [],
    uncertainties: [{
      reason: "deep_analysis_failed",
      detail: "The segment could not be analyzed reliably."
    }]
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

function parseExplicitRequest(
  raw: unknown,
  referencedSegments: SupportTextSegment[]
) {
  if (raw == null) return undefined;
  if (
    !isRecord(raw) ||
    !isString(raw.request) ||
    !containsExact(raw.evidence, referencedSegments)
  ) {
    return undefined;
  }

  return {
    request: raw.request.trim(),
    evidence: raw.evidence
  };
}

function parseContextualAnswer(
  raw: unknown,
  referencedSegments: SupportTextSegment[],
  contextDependency: string
): ContextualAnswer | undefined {
  if (!isRecord(raw)) return undefined;

  const needsContext =
    contextDependency === "needs_context_to_interpret" ||
    contextDependency === "needs_context_to_place";

  if (raw.type === "none") {
    return !needsContext && raw.value === null && raw.evidence === null
      ? { type: "none", value: null, evidence: null }
      : undefined;
  }

  if (
    !needsContext ||
    !isOneOf(raw.type, ["affirmative", "negative", "value", "reference"] as const) ||
    !containsExact(raw.evidence, referencedSegments)
  ) {
    return undefined;
  }

  if (raw.type === "affirmative") {
    return raw.value === true
      ? { type: "affirmative", value: true, evidence: raw.evidence }
      : undefined;
  }

  if (raw.type === "negative") {
    return raw.value === false
      ? { type: "negative", value: false, evidence: raw.evidence }
      : undefined;
  }

  if (raw.value !== null && asPrimitive(raw.value) === undefined) {
    return undefined;
  }

  return {
    type: raw.type,
    value: raw.value === null ? null : asPrimitive(raw.value),
    evidence: raw.evidence
  };
}

function parseFacts(
  raw: unknown,
  referencedSegments: SupportTextSegment[],
  allowedFields: Set<string>
): SupportFact[] | undefined {
  if (!Array.isArray(raw)) return undefined;

  return raw.flatMap((fact): SupportFact[] => {
    if (!isRecord(fact) || !containsExact(fact.evidence, referencedSegments)) {
      return [];
    }

    if (fact.type === "catalogued_field") {
      const fieldName = isString(fact.fieldName) ? fact.fieldName.trim() : undefined;
      const value = asPrimitive(fact.value);
      if (!fieldName || !allowedFields.has(fieldName) || value === undefined) return [];
      return [{
        type: "catalogued_field",
        fieldName,
        value,
        evidence: fact.evidence
      }];
    }

    if (fact.type === "open_fact") {
      const kind = isString(fact.kind) ? fact.kind.trim() : undefined;
      if (!kind || !isOneOf(fact.support, CANDIDATE_FACT_SUPPORT_VALUES)) return [];
      if (fact.value != null && asPrimitive(fact.value) === undefined) return [];
      const value = asPrimitive(fact.value);
      return [{
        type: "open_fact",
        kind,
        ...(value !== undefined ? { value } : {}),
        evidence: fact.evidence,
        support: fact.support
      }];
    }

    return [];
  });
}

function parseTestedActions(
  raw: unknown,
  referencedSegments: SupportTextSegment[]
): TestedAction[] | undefined {
  if (!Array.isArray(raw)) return undefined;

  return raw.flatMap((action): TestedAction[] => {
    if (
      !isRecord(action) ||
      !isString(action.label) ||
      !isOneOf(action.outcome, TESTED_ACTION_OUTCOMES) ||
      !containsExact(action.evidence, referencedSegments)
    ) {
      return [];
    }

    return [{
      label: action.label.trim(),
      outcome: action.outcome,
      evidence: action.evidence
    }];
  });
}

function parseUncertainties(
  raw: unknown,
  referencedSegments: SupportTextSegment[]
): TextUncertainty[] | undefined {
  if (!Array.isArray(raw)) return undefined;

  return raw.flatMap((uncertainty): TextUncertainty[] => {
    if (
      !isRecord(uncertainty) ||
      !isOneOf(uncertainty.reason, TEXT_UNCERTAINTY_REASONS) ||
      !isString(uncertainty.detail) ||
      (uncertainty.evidence != null &&
        !containsExact(uncertainty.evidence, referencedSegments))
    ) {
      return [];
    }

    return [{
      reason: uncertainty.reason,
      detail: uncertainty.detail.trim(),
      ...(typeof uncertainty.evidence === "string"
        ? { evidence: uncertainty.evidence }
        : {})
    }];
  });
}

function normalizeItem(params: {
  raw: Record<string, unknown>;
  supportSegments: SupportTextSegment[];
  segmentById: Map<string, SupportTextSegment>;
  allowedFields: Set<string>;
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

  const referencedSegments = sourceSegmentIds.map((id) => {
    return params.segmentById.get(id);
  });

  if (referencedSegments.some((segment) => segment === undefined)) {
    return {
      ok: false,
      sourceSegmentIds,
      reason: "unknown_source_segment_id",
      removed: []
    };
  }

  const segments = referencedSegments as SupportTextSegment[];

  if (!Array.isArray(params.raw.sourceVerbatims)) {
    return {
      ok: false,
      sourceSegmentIds,
      reason: "source_verbatims_not_array",
      removed: []
    };
  }

  const sourceVerbatims = params.raw.sourceVerbatims.filter(
    (value): value is string => containsExact(value, segments)
  );

  if (
    sourceVerbatims.length === 0 ||
    !isString(params.raw.summary) ||
    !isOneOf(params.raw.primaryUserExpectation, PRIMARY_USER_EXPECTATIONS) ||
    !isOneOf(params.raw.contextDependency, CONTEXT_DEPENDENCIES)
  ) {
    return {
      ok: false,
      sourceSegmentIds,
      reason: "invalid_core_fields",
      removed: []
    };
  }

  const contextualAnswer = parseContextualAnswer(
    params.raw.contextualAnswer,
    segments,
    params.raw.contextDependency
  );

  if (!contextualAnswer) {
    return {
      ok: false,
      sourceSegmentIds,
      reason: "invalid_contextual_consistency",
      removed: []
    };
  }

  const removed: Removed[] = [];
  const markInvalid = (field: string, raw: unknown, parsed: unknown, reason: string) => {
    if (raw != null && parsed === undefined) {
      removed.push(removal(sourceSegmentIds, params.unitIndex, field, reason));
    }
  };

  if (sourceVerbatims.length !== params.raw.sourceVerbatims.length) {
    removed.push(removal(sourceSegmentIds, params.unitIndex, "sourceVerbatims", "invalid_item"));
  }

  const explicitUserRequest = parseExplicitRequest(
    params.raw.explicitUserRequest,
    segments
  );
  const supportNeeds = Array.isArray(params.raw.supportNeeds)
    ? params.raw.supportNeeds.filter((value): value is SupportNeed => {
        return isOneOf(value, SUPPORT_NEEDS);
      })
    : undefined;
  const broadCategoryHint = isOneOf(params.raw.broadCategoryHint, BROAD_CATEGORY_HINTS)
    ? params.raw.broadCategoryHint
    : undefined;
  const facts = parseFacts(params.raw.facts, segments, params.allowedFields);
  const testedActions = parseTestedActions(params.raw.testedActions, segments);
  const uncertainties = parseUncertainties(params.raw.uncertainties, segments);

  markInvalid("explicitUserRequest", params.raw.explicitUserRequest, explicitUserRequest, "invalid_object");
  markInvalid("supportNeeds", params.raw.supportNeeds, supportNeeds, "not_array");
  markInvalid("broadCategoryHint", params.raw.broadCategoryHint, broadCategoryHint, "invalid_enum");
  markInvalid("facts", params.raw.facts, facts, "not_array");
  markInvalid("testedActions", params.raw.testedActions, testedActions, "not_array");
  markInvalid("uncertainties", params.raw.uncertainties, uncertainties, "not_array");

  return {
    ok: true,
    item: {
      sourceSegmentIds,
      sourceVerbatims,
      summary: params.raw.summary.trim(),
      primaryUserExpectation: params.raw.primaryUserExpectation,
      ...(explicitUserRequest ? { explicitUserRequest } : {}),
      supportNeeds: supportNeeds ?? [],
      ...(broadCategoryHint ? { broadCategoryHint } : {}),
      contextDependency: params.raw.contextDependency,
      contextualAnswer,
      facts: facts ?? [],
      testedActions: testedActions ?? [],
      uncertainties: uncertainties ?? []
    },
    removed
  };
}

const assignIds = (drafts: Draft[]): TextUnderstanding[] =>
  drafts.map((draft, index) => ({
    understandingId: `text_understanding_${index + 1}`,
    ...draft
  }));

function normalizeCue(params: {
  raw: unknown;
  supportSegments: SupportTextSegment[];
  segmentById: Map<string, SupportTextSegment>;
  understandingIds: Set<string>;
}): CueResult {
  if (!isRecord(params.raw)) {
    return {
      ok: false,
      reason: "cue_not_object"
    };
  }

  const sourceSegmentIds = parseSourceSegmentIds(
    params.raw.sourceSegmentIds,
    params.supportSegments
  );

  if (!sourceSegmentIds) {
    return {
      ok: false,
      reason: "invalid_cue_source_segment_ids"
    };
  }

  const segments = sourceSegmentIds.flatMap((id) => {
    const segment = params.segmentById.get(id);

    return segment ? [segment] : [];
  });

  if (
    segments.length !== sourceSegmentIds.length ||
    !containsExact(params.raw.verbatim, segments) ||
    !isString(params.raw.cueNote) ||
    !Array.isArray(params.raw.relatedUnderstandingIds) ||
    params.raw.relatedUnderstandingIds.length === 0
  ) {
    return {
      ok: false,
      sourceSegmentIds,
      reason: "invalid_cue_core_fields"
    };
  }

  const relatedUnderstandingIds: string[] = [];
  const seenUnderstandingIds = new Set<string>();

  for (const value of params.raw.relatedUnderstandingIds) {
    if (!isString(value)) {
      return {
        ok: false,
        sourceSegmentIds,
        reason: "invalid_cue_understanding_ids"
      };
    }

    const id = value.trim();

    if (!params.understandingIds.has(id) || seenUnderstandingIds.has(id)) {
      return {
        ok: false,
        sourceSegmentIds,
        reason: "invalid_cue_understanding_ids"
      };
    }

    seenUnderstandingIds.add(id);
    relatedUnderstandingIds.push(id);
  }

  return {
    ok: true,
    cue: {
      sourceSegmentIds,
      relatedUnderstandingIds,
      verbatim: params.raw.verbatim,
      cueNote: params.raw.cueNote.trim()
    }
  };
}

function parseSupportResponseCues(params: {
  raw: unknown;
  supportSegments: SupportTextSegment[];
  segmentById: Map<string, SupportTextSegment>;
  textUnderstandings: TextUnderstanding[];
}): {
  supportResponseCues: SupportResponseCue[];
  removed: Removed[];
} {
  if (params.raw == null) {
    return {
      supportResponseCues: [],
      removed: []
    };
  }

  if (!Array.isArray(params.raw)) {
    return {
      supportResponseCues: [],
      removed: [{
        field: "supportResponseCues",
        reason: "not_array"
      }]
    };
  }

  const understandingIds = new Set(
    params.textUnderstandings.map((understanding) => {
      return understanding.understandingId;
    })
  );
  const cues: SupportResponseCue[] = [];
  const removed: Removed[] = [];

  params.raw.forEach((rawCue) => {
    const result = normalizeCue({
      raw: rawCue,
      supportSegments: params.supportSegments,
      segmentById: params.segmentById,
      understandingIds
    });

    if (!result.ok) {
      removed.push({
        ...(result.sourceSegmentIds
          ? { sourceSegmentIds: result.sourceSegmentIds }
          : {}),
        field: "supportResponseCues",
        reason: result.reason
      });
      return;
    }

    cues.push({
      cueId: `support_response_cue_${cues.length + 1}`,
      ...result.cue
    });
  });

  return {
    supportResponseCues: cues,
    removed
  };
}

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
      segments.push({ segmentId: segment.segmentId, fallbackUsed: false });
      continue;
    }

    hasLocalFallback = true;
    const { understandingId: _ignored, ...fallback } =
      buildFallbackTextUnderstanding(segment);
    drafts.push(fallback);
    segments.push({
      segmentId: segment.segmentId,
      fallbackUsed: true,
      fallbackScope: "local",
      fallbackReason: "missing_valid_understanding"
    });
  }

  const textUnderstandings = assignIds(drafts);
  const parsedCues = parseSupportResponseCues({
    raw: parsed.supportResponseCues,
    supportSegments: input.supportSegments,
    segmentById,
    textUnderstandings
  });
  removedSecondaryElements.push(...parsedCues.removed);
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
          supportResponseCues: parsedCues.supportResponseCues
        },
        debug
      }
    : {
        result: {
          status: "valid",
          textUnderstandings,
          supportResponseCues: parsedCues.supportResponseCues
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
