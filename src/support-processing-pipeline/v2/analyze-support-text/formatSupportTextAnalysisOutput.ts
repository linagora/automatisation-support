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
  ExtractableFieldDefinition,
  FormatSupportTextAnalysisOutputInput,
  RawContextualAnswer,
  RawExplicitUserRequest,
  RawSupportFact,
  RawSupportTextItem,
  RawTestedAction,
  RawTextUncertainty,
  SupportFact,
  SupportNeed,
  SupportTextSegment,
  SupportTextValidationResult,
  TestedAction,
  TextUnderstanding,
  TextUncertainty
} from "./typesAnalyzeSupportText.types";

const INVALID_SUPPORT_FACT_VALUE = Symbol("invalid_support_fact_value");

type TextUnderstandingDraft = Omit<TextUnderstanding, "understandingId">;

type RemovedSecondaryElement = {
  sourceSegmentId?: string;
  unitIndex?: number;
  field: string;
  reason: string;
};

type NormalizedItemResult =
  | {
      status: "valid";
      item: TextUnderstandingDraft;
      removedSecondaryElements: RemovedSecondaryElement[];
    }
  | {
      status: "invalid_core";
      sourceSegmentId?: string;
      reason: string;
      removedSecondaryElements: RemovedSecondaryElement[];
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function oneOf<TValue extends string>(
  value: unknown,
  allowedValues: readonly TValue[]
): value is TValue {
  return typeof value === "string" && allowedValues.includes(value as TValue);
}

function exactSubstringExists(value: string, segment: SupportTextSegment): boolean {
  return segment.verbatim.includes(value);
}

function buildFallbackTextUnderstanding(
  segment: SupportTextSegment,
  understandingIndex = 1
): TextUnderstanding {
  return {
    understandingId: `text_understanding_${understandingIndex}`,
    sourceSegmentId: segment.segmentId,
    sourceVerbatims: [segment.verbatim],
    summary: segment.verbatim,
    primaryUserExpectation: "unclear",
    supportNeeds: [],
    contextDependency: "needs_context_to_interpret",
    facts: [],
    testedActions: [],
    uncertainties: [
      {
        reason: "deep_analysis_failed",
        detail: "The segment could not be analyzed reliably."
      }
    ]
  };
}

function assignUnderstandingIds(
  items: TextUnderstandingDraft[]
): TextUnderstanding[] {
  return items.map((item, index) => {
    return {
      understandingId: `text_understanding_${index + 1}`,
      ...item
    };
  });
}

function buildGlobalFallback(
  supportSegments: SupportTextSegment[]
): TextUnderstanding[] {
  return supportSegments.map((segment, index) => {
    return buildFallbackTextUnderstanding(segment, index + 1);
  });
}

function uniqueBy<TItem>(
  items: TItem[],
  keyFor: (item: TItem) => string
): TItem[] {
  const seen = new Set<string>();
  const output: TItem[] = [];

  for (const item of items) {
    const key = keyFor(item);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(item);
  }

  return output;
}

function normalizeSupportFactValue(
  value: unknown
):
  | SupportFact["value"]
  | undefined
  | typeof INVALID_SUPPORT_FACT_VALUE {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "string") {
    return value.trim() !== "" ? value.trim() : INVALID_SUPPORT_FACT_VALUE;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : INVALID_SUPPORT_FACT_VALUE;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return INVALID_SUPPORT_FACT_VALUE;
}

function evidenceOverlaps(firstEvidence: string, secondEvidence: string): boolean {
  return firstEvidence.includes(secondEvidence) ||
    secondEvidence.includes(firstEvidence);
}

function supportFactKey(fact: SupportFact): string {
  if (fact.type === "catalogued_field") {
    return [
      fact.type,
      fact.fieldName,
      String(fact.value),
      fact.evidence
    ].join("\u0000");
  }

  return [
    fact.type,
    fact.kind,
    String(fact.value),
    fact.evidence,
    fact.support
  ].join("\u0000");
}

function removal(params: {
  sourceSegmentId?: string;
  unitIndex?: number;
  field: string;
  reason: string;
}): RemovedSecondaryElement {
  return {
    ...(params.sourceSegmentId ? { sourceSegmentId: params.sourceSegmentId } : {}),
    ...(params.unitIndex !== undefined ? { unitIndex: params.unitIndex } : {}),
    field: params.field,
    reason: params.reason
  };
}

function normalizeSourceVerbatims(params: {
  rawValue: unknown;
  segment: SupportTextSegment;
  sourceSegmentId: string;
  unitIndex: number;
}): {
  sourceVerbatims: string[];
  removedSecondaryElements: RemovedSecondaryElement[];
} {
  const removedSecondaryElements: RemovedSecondaryElement[] = [];

  if (!Array.isArray(params.rawValue)) {
    return {
      sourceVerbatims: [],
      removedSecondaryElements: [
        removal({
          sourceSegmentId: params.sourceSegmentId,
          unitIndex: params.unitIndex,
          field: "sourceVerbatims",
          reason: "not_array"
        })
      ]
    };
  }

  const sourceVerbatims: string[] = [];

  for (const rawVerbatim of params.rawValue) {
    if (
      !isNonEmptyString(rawVerbatim) ||
      !exactSubstringExists(rawVerbatim, params.segment)
    ) {
      removedSecondaryElements.push(
        removal({
          sourceSegmentId: params.sourceSegmentId,
          unitIndex: params.unitIndex,
          field: "sourceVerbatims",
          reason: "invalid_source_verbatim"
        })
      );
      continue;
    }

    sourceVerbatims.push(rawVerbatim);
  }

  return {
    sourceVerbatims: uniqueBy(sourceVerbatims, (item) => item),
    removedSecondaryElements
  };
}

function normalizeExplicitUserRequest(params: {
  rawValue: unknown;
  segment: SupportTextSegment;
  sourceSegmentId: string;
  unitIndex: number;
}): {
  explicitUserRequest?: TextUnderstanding["explicitUserRequest"];
  removedSecondaryElements: RemovedSecondaryElement[];
} {
  if (params.rawValue === undefined || params.rawValue === null) {
    return { removedSecondaryElements: [] };
  }

  const rawRequest = params.rawValue as RawExplicitUserRequest;

  if (
    !isRecord(rawRequest) ||
    !isNonEmptyString(rawRequest.request) ||
    !isNonEmptyString(rawRequest.evidence) ||
    !exactSubstringExists(rawRequest.evidence, params.segment)
  ) {
    return {
      removedSecondaryElements: [
        removal({
          sourceSegmentId: params.sourceSegmentId,
          unitIndex: params.unitIndex,
          field: "explicitUserRequest",
          reason: "invalid_explicit_user_request"
        })
      ]
    };
  }

  return {
    explicitUserRequest: {
      request: rawRequest.request.trim(),
      evidence: rawRequest.evidence
    },
    removedSecondaryElements: []
  };
}

function normalizeContextualAnswer(params: {
  rawValue: unknown;
  segment: SupportTextSegment;
  sourceSegmentId: string;
  unitIndex: number;
}): {
  contextualAnswer?: ContextualAnswer;
  removedSecondaryElements: RemovedSecondaryElement[];
} {
  if (params.rawValue === undefined || params.rawValue === null) {
    return { removedSecondaryElements: [] };
  }

  const rawAnswer = params.rawValue as RawContextualAnswer;
  const normalizedValue = normalizeSupportFactValue(rawAnswer.value);

  if (
    !isRecord(rawAnswer) ||
    !oneOf(rawAnswer.type, ["affirmative", "negative", "value", "reference"] as const) ||
    !isNonEmptyString(rawAnswer.evidence) ||
    !exactSubstringExists(rawAnswer.evidence, params.segment) ||
    normalizedValue === INVALID_SUPPORT_FACT_VALUE
  ) {
    return {
      removedSecondaryElements: [
        removal({
          sourceSegmentId: params.sourceSegmentId,
          unitIndex: params.unitIndex,
          field: "contextualAnswer",
          reason: "invalid_contextual_answer"
        })
      ]
    };
  }

  return {
    contextualAnswer: {
      type: rawAnswer.type,
      ...(normalizedValue !== undefined ? { value: normalizedValue } : {}),
      evidence: rawAnswer.evidence
    },
    removedSecondaryElements: []
  };
}

function normalizeSupportNeeds(params: {
  rawValue: unknown;
  sourceSegmentId: string;
  unitIndex: number;
}): {
  supportNeeds: SupportNeed[];
  removedSecondaryElements: RemovedSecondaryElement[];
} {
  if (params.rawValue === undefined || params.rawValue === null) {
    return { supportNeeds: [], removedSecondaryElements: [] };
  }

  if (!Array.isArray(params.rawValue)) {
    return {
      supportNeeds: [],
      removedSecondaryElements: [
        removal({
          sourceSegmentId: params.sourceSegmentId,
          unitIndex: params.unitIndex,
          field: "supportNeeds",
          reason: "not_array"
        })
      ]
    };
  }

  const removedSecondaryElements: RemovedSecondaryElement[] = [];
  const supportNeeds: SupportNeed[] = [];

  for (const item of params.rawValue) {
    if (!oneOf(item, SUPPORT_NEEDS)) {
      removedSecondaryElements.push(
        removal({
          sourceSegmentId: params.sourceSegmentId,
          unitIndex: params.unitIndex,
          field: "supportNeeds",
          reason: "invalid_support_need"
        })
      );
      continue;
    }

    supportNeeds.push(item);
  }

  return {
    supportNeeds: uniqueBy(supportNeeds, (item) => item),
    removedSecondaryElements
  };
}

function normalizeBroadCategoryHint(params: {
  rawValue: unknown;
  sourceSegmentId: string;
  unitIndex: number;
}): {
  broadCategoryHint?: TextUnderstanding["broadCategoryHint"];
  removedSecondaryElements: RemovedSecondaryElement[];
} {
  if (params.rawValue === undefined || params.rawValue === null) {
    return { removedSecondaryElements: [] };
  }

  if (!oneOf(params.rawValue, BROAD_CATEGORY_HINTS)) {
    return {
      removedSecondaryElements: [
        removal({
          sourceSegmentId: params.sourceSegmentId,
          unitIndex: params.unitIndex,
          field: "broadCategoryHint",
          reason: "invalid_broad_category_hint"
        })
      ]
    };
  }

  return {
    broadCategoryHint: params.rawValue,
    removedSecondaryElements: []
  };
}

function normalizeTestedActions(params: {
  rawValue: unknown;
  segment: SupportTextSegment;
  sourceSegmentId: string;
  unitIndex: number;
}): {
  testedActions: TestedAction[];
  removedSecondaryElements: RemovedSecondaryElement[];
} {
  if (params.rawValue === undefined || params.rawValue === null) {
    return { testedActions: [], removedSecondaryElements: [] };
  }

  if (!Array.isArray(params.rawValue)) {
    return {
      testedActions: [],
      removedSecondaryElements: [
        removal({
          sourceSegmentId: params.sourceSegmentId,
          unitIndex: params.unitIndex,
          field: "testedActions",
          reason: "not_array"
        })
      ]
    };
  }

  const testedActions: TestedAction[] = [];
  const removedSecondaryElements: RemovedSecondaryElement[] = [];

  for (const rawAction of params.rawValue as RawTestedAction[]) {
    if (
      !isRecord(rawAction) ||
      !isNonEmptyString(rawAction.label) ||
      !oneOf(rawAction.outcome, TESTED_ACTION_OUTCOMES) ||
      !isNonEmptyString(rawAction.evidence) ||
      !exactSubstringExists(rawAction.evidence, params.segment)
    ) {
      removedSecondaryElements.push(
        removal({
          sourceSegmentId: params.sourceSegmentId,
          unitIndex: params.unitIndex,
          field: "testedActions",
          reason: "invalid_tested_action"
        })
      );
      continue;
    }

    testedActions.push({
      label: rawAction.label.trim(),
      outcome: rawAction.outcome,
      evidence: rawAction.evidence
    });
  }

  return {
    testedActions: uniqueBy(testedActions, (action) => {
      return `${action.label}\u0000${action.outcome}\u0000${action.evidence}`;
    }),
    removedSecondaryElements
  };
}

function normalizeSupportFacts(params: {
  rawValue: unknown;
  segment: SupportTextSegment;
  sourceSegmentId: string;
  unitIndex: number;
  extractableFieldCatalog: ExtractableFieldDefinition[];
  testedActions: TestedAction[];
}): {
  facts: SupportFact[];
  removedSecondaryElements: RemovedSecondaryElement[];
} {
  if (params.rawValue === undefined || params.rawValue === null) {
    return { facts: [], removedSecondaryElements: [] };
  }

  if (!Array.isArray(params.rawValue)) {
    return {
      facts: [],
      removedSecondaryElements: [
        removal({
          sourceSegmentId: params.sourceSegmentId,
          unitIndex: params.unitIndex,
          field: "facts",
          reason: "not_array"
        })
      ]
    };
  }

  const allowedFieldNames = new Set(
    params.extractableFieldCatalog.map((field) => field.fieldName)
  );
  const facts: SupportFact[] = [];
  const removedSecondaryElements: RemovedSecondaryElement[] = [];

  for (const rawFact of params.rawValue as RawSupportFact[]) {
    if (
      !isRecord(rawFact) ||
      !isNonEmptyString(rawFact.evidence) ||
      !exactSubstringExists(rawFact.evidence, params.segment)
    ) {
      removedSecondaryElements.push(
        removal({
          sourceSegmentId: params.sourceSegmentId,
          unitIndex: params.unitIndex,
          field: "facts",
          reason: "invalid_fact_evidence"
        })
      );
      continue;
    }

    if (rawFact.type === "catalogued_field") {
      const normalizedValue = normalizeSupportFactValue(rawFact.value);

      if (
        !isNonEmptyString(rawFact.fieldName) ||
        !allowedFieldNames.has(rawFact.fieldName.trim()) ||
        normalizedValue === undefined ||
        normalizedValue === INVALID_SUPPORT_FACT_VALUE
      ) {
        removedSecondaryElements.push(
          removal({
            sourceSegmentId: params.sourceSegmentId,
            unitIndex: params.unitIndex,
            field: "facts",
            reason: "invalid_catalogued_fact"
          })
        );
        continue;
      }

      facts.push({
        type: "catalogued_field",
        fieldName: rawFact.fieldName.trim(),
        value: normalizedValue,
        evidence: rawFact.evidence
      });
      continue;
    }

    if (rawFact.type === "open_fact") {
      const kind = isNonEmptyString(rawFact.kind)
        ? rawFact.kind.trim()
        : undefined;
      const normalizedValue = normalizeSupportFactValue(rawFact.value);

      if (
        !kind ||
        allowedFieldNames.has(kind) ||
        !oneOf(rawFact.support, CANDIDATE_FACT_SUPPORT_VALUES) ||
        normalizedValue === INVALID_SUPPORT_FACT_VALUE
      ) {
        removedSecondaryElements.push(
          removal({
            sourceSegmentId: params.sourceSegmentId,
            unitIndex: params.unitIndex,
            field: "facts",
            reason: "invalid_open_fact"
          })
        );
        continue;
      }

      facts.push({
        type: "open_fact",
        kind,
        ...(normalizedValue !== undefined ? { value: normalizedValue } : {}),
        evidence: rawFact.evidence,
        support: rawFact.support
      });
      continue;
    }

    removedSecondaryElements.push(
      removal({
        sourceSegmentId: params.sourceSegmentId,
        unitIndex: params.unitIndex,
        field: "facts",
        reason: "unknown_fact_type"
      })
    );
  }

  const uniqueFacts = uniqueBy(facts, supportFactKey);
  const cataloguedFacts = uniqueFacts.filter((fact) => {
    return fact.type === "catalogued_field";
  });

  return {
    facts: uniqueFacts.filter((fact) => {
      if (fact.type === "catalogued_field") {
        return true;
      }

      const duplicatesTestedAction = params.testedActions.some((action) => {
        return evidenceOverlaps(fact.evidence, action.evidence);
      });

      if (duplicatesTestedAction) {
        removedSecondaryElements.push(
          removal({
            sourceSegmentId: params.sourceSegmentId,
            unitIndex: params.unitIndex,
            field: "facts",
            reason: "open_fact_duplicates_tested_action"
          })
        );
        return false;
      }

      const duplicatesCataloguedFact = cataloguedFacts.some((cataloguedFact) => {
        return evidenceOverlaps(fact.evidence, cataloguedFact.evidence);
      });

      if (duplicatesCataloguedFact) {
        removedSecondaryElements.push(
          removal({
            sourceSegmentId: params.sourceSegmentId,
            unitIndex: params.unitIndex,
            field: "facts",
            reason: "open_fact_duplicates_catalogued_fact"
          })
        );
        return false;
      }

      return true;
    }),
    removedSecondaryElements
  };
}

function normalizeUncertainties(params: {
  rawValue: unknown;
  segment: SupportTextSegment;
  sourceSegmentId: string;
  unitIndex: number;
}): {
  uncertainties: TextUncertainty[];
  removedSecondaryElements: RemovedSecondaryElement[];
} {
  if (params.rawValue === undefined || params.rawValue === null) {
    return { uncertainties: [], removedSecondaryElements: [] };
  }

  if (!Array.isArray(params.rawValue)) {
    return {
      uncertainties: [],
      removedSecondaryElements: [
        removal({
          sourceSegmentId: params.sourceSegmentId,
          unitIndex: params.unitIndex,
          field: "uncertainties",
          reason: "not_array"
        })
      ]
    };
  }

  const uncertainties: TextUncertainty[] = [];
  const removedSecondaryElements: RemovedSecondaryElement[] = [];

  for (const rawUncertainty of params.rawValue as RawTextUncertainty[]) {
    if (
      !isRecord(rawUncertainty) ||
      !isNonEmptyString(rawUncertainty.reason) ||
      !TEXT_UNCERTAINTY_REASONS.includes(
        rawUncertainty.reason as typeof TEXT_UNCERTAINTY_REASONS[number]
      ) ||
      !isNonEmptyString(rawUncertainty.detail)
    ) {
      removedSecondaryElements.push(
        removal({
          sourceSegmentId: params.sourceSegmentId,
          unitIndex: params.unitIndex,
          field: "uncertainties",
          reason: "invalid_uncertainty"
        })
      );
      continue;
    }

    const evidence =
      typeof rawUncertainty.evidence === "string"
        ? rawUncertainty.evidence
        : undefined;

    if (evidence !== undefined && (
      !isNonEmptyString(evidence) ||
      !exactSubstringExists(evidence, params.segment)
    )) {
      removedSecondaryElements.push(
        removal({
          sourceSegmentId: params.sourceSegmentId,
          unitIndex: params.unitIndex,
          field: "uncertainties",
          reason: "invalid_uncertainty_evidence"
        })
      );
      continue;
    }

    uncertainties.push({
      reason: rawUncertainty.reason as TextUncertainty["reason"],
      detail: rawUncertainty.detail.trim(),
      ...(evidence ? { evidence } : {})
    });
  }

  return {
    uncertainties,
    removedSecondaryElements
  };
}

function normalizeItem(params: {
  rawItem: RawSupportTextItem;
  segmentById: Map<string, SupportTextSegment>;
  extractableFieldCatalog: ExtractableFieldDefinition[];
  unitIndex: number;
}): NormalizedItemResult {
  const removedSecondaryElements: RemovedSecondaryElement[] = [];
  const sourceSegmentId = isNonEmptyString(params.rawItem.sourceSegmentId)
    ? params.rawItem.sourceSegmentId.trim()
    : undefined;

  if (!sourceSegmentId) {
    return {
      status: "invalid_core",
      reason: "invalid_source_segment_id",
      removedSecondaryElements
    };
  }

  const segment = params.segmentById.get(sourceSegmentId);

  if (!segment) {
    return {
      status: "invalid_core",
      sourceSegmentId,
      reason: "unknown_source_segment_id",
      removedSecondaryElements
    };
  }

  const sourceVerbatimResult = normalizeSourceVerbatims({
    rawValue: params.rawItem.sourceVerbatims,
    segment,
    sourceSegmentId,
    unitIndex: params.unitIndex
  });
  removedSecondaryElements.push(
    ...sourceVerbatimResult.removedSecondaryElements
  );

  if (sourceVerbatimResult.sourceVerbatims.length === 0) {
    return {
      status: "invalid_core",
      sourceSegmentId,
      reason: "no_valid_source_verbatim",
      removedSecondaryElements
    };
  }

  const summary = isNonEmptyString(params.rawItem.summary)
    ? params.rawItem.summary.trim()
    : undefined;

  if (!summary) {
    return {
      status: "invalid_core",
      sourceSegmentId,
      reason: "invalid_summary",
      removedSecondaryElements
    };
  }

  if (
    !oneOf(
      params.rawItem.primaryUserExpectation,
      PRIMARY_USER_EXPECTATIONS
    )
  ) {
    return {
      status: "invalid_core",
      sourceSegmentId,
      reason: "invalid_primary_user_expectation",
      removedSecondaryElements
    };
  }

  if (!oneOf(params.rawItem.contextDependency, CONTEXT_DEPENDENCIES)) {
    return {
      status: "invalid_core",
      sourceSegmentId,
      reason: "invalid_context_dependency",
      removedSecondaryElements
    };
  }

  const explicitUserRequestResult = normalizeExplicitUserRequest({
    rawValue: params.rawItem.explicitUserRequest,
    segment,
    sourceSegmentId,
    unitIndex: params.unitIndex
  });
  const supportNeedsResult = normalizeSupportNeeds({
    rawValue: params.rawItem.supportNeeds,
    sourceSegmentId,
    unitIndex: params.unitIndex
  });
  const broadCategoryHintResult = normalizeBroadCategoryHint({
    rawValue: params.rawItem.broadCategoryHint,
    sourceSegmentId,
    unitIndex: params.unitIndex
  });
  const contextualAnswerResult = normalizeContextualAnswer({
    rawValue: params.rawItem.contextualAnswer,
    segment,
    sourceSegmentId,
    unitIndex: params.unitIndex
  });
  const testedActionsResult = normalizeTestedActions({
    rawValue: params.rawItem.testedActions,
    segment,
    sourceSegmentId,
    unitIndex: params.unitIndex
  });
  const factsResult = normalizeSupportFacts({
    rawValue: params.rawItem.facts,
    segment,
    sourceSegmentId,
    unitIndex: params.unitIndex,
    extractableFieldCatalog: params.extractableFieldCatalog,
    testedActions: testedActionsResult.testedActions
  });
  const uncertaintiesResult = normalizeUncertainties({
    rawValue: params.rawItem.uncertainties,
    segment,
    sourceSegmentId,
    unitIndex: params.unitIndex
  });

  removedSecondaryElements.push(
    ...explicitUserRequestResult.removedSecondaryElements,
    ...supportNeedsResult.removedSecondaryElements,
    ...broadCategoryHintResult.removedSecondaryElements,
    ...contextualAnswerResult.removedSecondaryElements,
    ...testedActionsResult.removedSecondaryElements,
    ...factsResult.removedSecondaryElements,
    ...uncertaintiesResult.removedSecondaryElements
  );

  return {
    status: "valid",
    item: {
      sourceSegmentId,
      sourceVerbatims: sourceVerbatimResult.sourceVerbatims,
      summary,
      primaryUserExpectation: params.rawItem.primaryUserExpectation,
      ...(explicitUserRequestResult.explicitUserRequest
        ? { explicitUserRequest: explicitUserRequestResult.explicitUserRequest }
        : {}),
      supportNeeds: supportNeedsResult.supportNeeds,
      ...(broadCategoryHintResult.broadCategoryHint
        ? { broadCategoryHint: broadCategoryHintResult.broadCategoryHint }
        : {}),
      contextDependency: params.rawItem.contextDependency,
      ...(contextualAnswerResult.contextualAnswer
        ? { contextualAnswer: contextualAnswerResult.contextualAnswer }
        : {}),
      facts: factsResult.facts,
      testedActions: testedActionsResult.testedActions,
      uncertainties: uncertaintiesResult.uncertainties
    },
    removedSecondaryElements
  };
}

function formatSupportTextAnalysisOutput(
  input: FormatSupportTextAnalysisOutputInput
): SupportTextValidationResult {
  return formatSupportTextAnalysisOutputWithDebug(input).result;
}

type SupportTextSegmentDebug = {
  segmentId: string;
  fallbackUsed: boolean;
  fallbackScope?: "global" | "local";
  fallbackReason?: string;
};

type SupportTextRejectedUnitDebug = {
  sourceSegmentId?: string;
  unitIndex: number;
  reason: string;
};

type SupportTextFormatDebug = {
  fallbackScope: "none" | "global" | "local";
  validationReason?: string;
  segments: SupportTextSegmentDebug[];
  rejectedUnits: SupportTextRejectedUnitDebug[];
  removedSecondaryElements: RemovedSecondaryElement[];
};

type SupportTextDebugValidationResult = {
  result: SupportTextValidationResult;
  debug: SupportTextFormatDebug;
};

function buildGlobalFallbackDebug(
  supportSegments: SupportTextSegment[],
  reason: string
): SupportTextFormatDebug {
  return {
    fallbackScope: "global",
    validationReason: reason,
    segments: supportSegments.map((segment) => ({
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
): SupportTextDebugValidationResult {
  if (input.rawSupportTextAnalysis.status !== "completed") {
    const reason = "llm_call_failed";

    return {
      result: {
        status: "invalid",
        reason,
        textUnderstandings: buildGlobalFallback(input.supportSegments)
      },
      debug: buildGlobalFallbackDebug(input.supportSegments, reason)
    };
  }

  const parsedResponse = input.rawSupportTextAnalysis.parsedResponse;

  if (!isRecord(parsedResponse) || !Array.isArray(parsedResponse.items)) {
    const reason = "invalid_json";

    return {
      result: {
        status: "invalid",
        reason,
        textUnderstandings: buildGlobalFallback(input.supportSegments)
      },
      debug: buildGlobalFallbackDebug(input.supportSegments, reason)
    };
  }

  const segmentById = new Map(
    input.supportSegments.map((segment) => [segment.segmentId, segment])
  );
  const validDraftsBySegmentId = new Map<string, TextUnderstandingDraft[]>();
  const rejectedUnits: SupportTextRejectedUnitDebug[] = [];
  const removedSecondaryElements: RemovedSecondaryElement[] = [];

  (parsedResponse.items as unknown[]).forEach((rawItem, index) => {
    if (!isRecord(rawItem)) {
      rejectedUnits.push({
        unitIndex: index,
        reason: "unit_not_object"
      });
      return;
    }

    const normalizedItem = normalizeItem({
      rawItem,
      segmentById,
      extractableFieldCatalog: input.extractableFieldCatalog,
      unitIndex: index
    });

    removedSecondaryElements.push(
      ...normalizedItem.removedSecondaryElements
    );

    if (normalizedItem.status === "invalid_core") {
      rejectedUnits.push({
        ...(normalizedItem.sourceSegmentId
          ? { sourceSegmentId: normalizedItem.sourceSegmentId }
          : {}),
        unitIndex: index,
        reason: normalizedItem.reason
      });
      return;
    }

    const existingDrafts =
      validDraftsBySegmentId.get(normalizedItem.item.sourceSegmentId) ?? [];
    existingDrafts.push(normalizedItem.item);
    validDraftsBySegmentId.set(
      normalizedItem.item.sourceSegmentId,
      existingDrafts
    );
  });

  let hasLocalFallback = false;
  const segmentDebug: SupportTextSegmentDebug[] = [];
  const orderedDrafts: TextUnderstandingDraft[] = [];

  for (const segment of input.supportSegments) {
    const segmentDrafts = validDraftsBySegmentId.get(segment.segmentId) ?? [];

    if (segmentDrafts.length === 0) {
      hasLocalFallback = true;
      segmentDebug.push({
        segmentId: segment.segmentId,
        fallbackUsed: true,
        fallbackScope: "local",
        fallbackReason: "missing_valid_understanding"
      });
      orderedDrafts.push({
        sourceSegmentId: segment.segmentId,
        sourceVerbatims: [segment.verbatim],
        summary: segment.verbatim,
        primaryUserExpectation: "unclear",
        supportNeeds: [],
        contextDependency: "needs_context_to_interpret",
        facts: [],
        testedActions: [],
        uncertainties: [
          {
            reason: "deep_analysis_failed",
            detail: "The segment could not be analyzed reliably."
          }
        ]
      });
      continue;
    }

    segmentDebug.push({
      segmentId: segment.segmentId,
      fallbackUsed: false
    });
    orderedDrafts.push(...segmentDrafts);
  }

  const textUnderstandings = assignUnderstandingIds(orderedDrafts);

  if (hasLocalFallback) {
    const reason = "invalid_segment_item";

    return {
      result: {
        status: "invalid",
        reason,
        textUnderstandings
      },
      debug: {
        fallbackScope: "local",
        validationReason: reason,
        segments: segmentDebug,
        rejectedUnits,
        removedSecondaryElements
      }
    };
  }

  return {
    result: {
      status: "valid",
      textUnderstandings
    },
    debug: {
      fallbackScope: "none",
      segments: segmentDebug,
      rejectedUnits,
      removedSecondaryElements
    }
  };
}

export {
  buildFallbackTextUnderstanding,
  formatSupportTextAnalysisOutput,
  formatSupportTextAnalysisOutputWithDebug
};
