import { TOPIC_UPDATE_OPS } from "./proposeTopicUpdates.schema";
import {
  BROAD_CATEGORY_HINTS
} from "../../support-catalog-LEGACY";

import type {
  FormatProposeTopicUpdatesOutputInput,
  ProposeTopicUpdatesValidationResult
} from "./typesProposeTopicUpdates.types";
import type {
  TextUnderstanding,
  TopicItemReference,
  TopicMergeRefs,
  TopicPatchIdentity,
  TopicReplaceRefs,
  TopicUpdateOp,
  TopicUpdateOperation,
  TopicUpdateProposalDebugInfo
} from "../typesSupportProcessingPipelineV2.types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTopicUpdateOperation(value: unknown): value is TopicUpdateOperation {
  return (
    typeof value === "string" &&
    TOPIC_UPDATE_OPS.includes(value as TopicUpdateOperation)
  );
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

const ALLOWED_BROAD_CATEGORY_HINTS = new Set<string>(BROAD_CATEGORY_HINTS);

function normalizeBroadCategoryHint(value: unknown): string | null {
  const normalized = stringOrNull(value);

  if (normalized === null) {
    return null;
  }

  if (normalized === "notifications") {
    return "bug";
  }

  return ALLOWED_BROAD_CATEGORY_HINTS.has(normalized) ? normalized : "other";
}

function parseTopicId(value: unknown): number | null | undefined {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "number" && Number.isInteger(value) && value >= 1) {
    return value;
  }

  return undefined;
}

function parseItems(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value.flatMap((item) => {
    if (typeof item === "number" && Number.isInteger(item) && item >= 0) {
      return [item];
    }

    if (typeof item === "string" && /^\d+$/u.test(item.trim())) {
      return [Number(item.trim())];
    }

    return [];
  });

  return Array.from(new Set(items));
}

function parseRef(value: unknown): TopicItemReference | undefined {
  if (!Array.isArray(value) || value.length !== 2) {
    return undefined;
  }

  const [itemIndex, childIndex] = value;

  if (
    typeof itemIndex === "number" &&
    Number.isInteger(itemIndex) &&
    itemIndex >= 0 &&
    typeof childIndex === "number" &&
    Number.isInteger(childIndex) &&
    childIndex >= 0
  ) {
    return [itemIndex, childIndex];
  }

  return undefined;
}

function parseRefs(value: unknown): TopicItemReference[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const ref = parseRef(item);
    return ref ? [ref] : [];
  });
}

function parseTopic(value: unknown): TopicPatchIdentity | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    title: stringOrNull(value.title),
    broadCategoryHint: normalizeBroadCategoryHint(value.broadCategoryHint),
    summary: stringOrNull(value.summary)
  } as TopicPatchIdentity;
}

function hasCaseDetailRef(
  textUnderstandings: TextUnderstanding[],
  ref: TopicItemReference
): boolean {
  return textUnderstandings[ref[0]]?.caseDetails[ref[1]] !== undefined;
}

function hasAttemptedActionRef(
  textUnderstandings: TextUnderstanding[],
  ref: TopicItemReference
): boolean {
  return textUnderstandings[ref[0]]?.attemptedActions[ref[1]] !== undefined;
}

function hasInvalidRefs(params: {
  op: TopicUpdateOp;
  textUnderstandings: TextUnderstanding[];
}): boolean {
  const mergeCaseDetails = params.op.merge?.caseDetails ?? [];
  const mergeAttemptedActions = params.op.merge?.attemptedActions ?? [];
  const replaceCaseDetails = params.op.replace?.caseDetails ?? [];
  const replaceAttemptedActions = params.op.replace?.attemptedActions ?? [];

  return mergeCaseDetails.some((ref) => {
    return !hasCaseDetailRef(params.textUnderstandings, ref);
  }) ||
    mergeAttemptedActions.some((ref) => {
      return !hasAttemptedActionRef(params.textUnderstandings, ref);
    }) ||
    replaceCaseDetails.some((replacement) => {
      return !hasCaseDetailRef(params.textUnderstandings, replacement.with);
    }) ||
    replaceAttemptedActions.some((replacement) => {
      return !hasAttemptedActionRef(params.textUnderstandings, replacement.with);
    });
}

function parseMerge(value: unknown): TopicMergeRefs | null {
  if (!isRecord(value)) {
    return null;
  }

  const merge = {
    caseDetails: parseRefs(value.caseDetails),
    attemptedActions: parseRefs(value.attemptedActions)
  };

  return merge.caseDetails.length > 0 || merge.attemptedActions.length > 0
    ? merge
    : null;
}

function parseReplace(value: unknown): TopicReplaceRefs | null {
  if (!isRecord(value)) {
    return null;
  }

  const caseDetails = Array.isArray(value.caseDetails)
    ? value.caseDetails.flatMap((item) => {
        if (!isRecord(item) || typeof item.key !== "string") {
          return [];
        }

        const ref = parseRef(item.with);
        return ref ? [{ key: item.key.trim(), with: ref }] : [];
      })
    : [];

  const attemptedActions = Array.isArray(value.attemptedActions)
    ? value.attemptedActions.flatMap((item) => {
        if (!isRecord(item) || typeof item.targetIndex !== "number") {
          return [];
        }

        const ref = parseRef(item.with);

        return ref
          ? [{ targetIndex: item.targetIndex, with: ref }]
          : [];
      })
    : [];

  return caseDetails.length > 0 || attemptedActions.length > 0
    ? { caseDetails, attemptedActions }
    : null;
}

function hasPersistableContent(understanding: TextUnderstanding | undefined): boolean {
  if (!understanding) {
    return false;
  }

  return (
    understanding.caseDetails.length > 0 ||
    understanding.attemptedActions.length > 0 ||
    understanding.messageKinds.some((messageKind) => {
      return messageKind.kind !== "support_context";
    })
  );
}

function normalizeOp(params: {
  rawOp: unknown;
  textUnderstandings: TextUnderstanding[];
}): { op?: TopicUpdateOp; reason?: string } {
  if (!isRecord(params.rawOp) || !isTopicUpdateOperation(params.rawOp.op)) {
    return { reason: "invalid_op" };
  }

  const items = parseItems(params.rawOp.items);

  if (!items || items.length === 0) {
    return { reason: "invalid_items" };
  }

  const validItems = items.filter((itemIndex) => {
    return params.textUnderstandings[itemIndex] !== undefined;
  });

  if (validItems.length === 0) {
    return { reason: "invalid_item_index" };
  }

  const topicId = parseTopicId(params.rawOp.topicId);

  if (topicId === undefined) {
    return { reason: "invalidTopicId" };
  }

  const op = {
    op: params.rawOp.op,
    items: validItems,
    topicId,
    topic: parseTopic(params.rawOp.topic),
    merge: parseMerge(params.rawOp.merge),
    replace: parseReplace(params.rawOp.replace),
    review: null
  } as TopicUpdateOp;

  if (hasInvalidRefs({
    op,
    textUnderstandings: params.textUnderstandings
  })) {
    return { reason: "invalid_refs" };
  }

  return {
    op
  };
}

function buildCoverage(params: {
  textUnderstandings: TextUnderstanding[];
  topicUpdateOps: TopicUpdateOp[];
}): TopicUpdateProposalDebugInfo["understandingCoverage"] {
  return params.textUnderstandings.map((understanding, itemIndex) => ({
    itemIndex,
    understandingId: understanding.understandingId,
    persistable: hasPersistableContent(understanding),
    coveredByFormattedOpIndexes: params.topicUpdateOps.flatMap((op, opIndex) => {
      return op.items.includes(itemIndex) ? [opIndex] : [];
    })
  }));
}

function buildDebugInfo(params: {
  input: FormatProposeTopicUpdatesOutputInput;
  rawOps: unknown[];
  status: "valid" | "invalid";
  reason?: string;
  topicUpdateOps: TopicUpdateOp[];
  rejectedOps: TopicUpdateProposalDebugInfo["rejectedOps"];
}): TopicUpdateProposalDebugInfo {
  const understandingCoverage = buildCoverage({
    textUnderstandings: params.input.textUnderstandings,
    topicUpdateOps: params.topicUpdateOps
  });

  return {
    ...(params.input.rawProposeTopicUpdates.rawResponse
      ? { rawResponse: params.input.rawProposeTopicUpdates.rawResponse }
      : {}),
    rawParsedResponse: params.input.rawProposeTopicUpdates.parsedResponse,
    rawOpsCount: params.rawOps.length,
    formattedStatus: params.status,
    ...(params.reason ? { formattedReason: params.reason } : {}),
    formattedTopicUpdateOps: params.topicUpdateOps,
    rejectedOps: params.rejectedOps,
    understandingCoverage,
    uncoveredPersistableItemIndexes: understandingCoverage.flatMap((item) => {
      return item.persistable && item.coveredByFormattedOpIndexes.length === 0
        ? [item.itemIndex]
        : [];
    })
  };
}

function buildResult(params: {
  input: FormatProposeTopicUpdatesOutputInput;
  rawOps: unknown[];
  status: "valid" | "invalid";
  reason?: string;
  topicUpdateOps: TopicUpdateOp[];
  rejectedOps: TopicUpdateProposalDebugInfo["rejectedOps"];
}): ProposeTopicUpdatesValidationResult {
  const debug = buildDebugInfo(params);

  if (params.status === "invalid") {
    return {
      status: "invalid",
      reason: params.reason ?? "invalid_ops",
      topicUpdateOps: params.topicUpdateOps,
      debug
    };
  }

  return {
    status: "valid",
    topicUpdateOps: params.topicUpdateOps,
    debug
  };
}

function buildFallbackOps(_textUnderstandings: TextUnderstanding[]): TopicUpdateOp[] {
  return [];
}

function analyzeProposeTopicUpdatesOutput(
  input: FormatProposeTopicUpdatesOutputInput
): ProposeTopicUpdatesValidationResult {
  if (input.rawProposeTopicUpdates.status !== "completed") {
    return buildResult({
      input,
      rawOps: [],
      status: "invalid",
      reason: "llm_call_failed",
      topicUpdateOps: [],
      rejectedOps: []
    });
  }

  const parsedResponse = input.rawProposeTopicUpdates.parsedResponse;

  if (!isRecord(parsedResponse) || !Array.isArray(parsedResponse.ops)) {
    return buildResult({
      input,
      rawOps: [],
      status: "invalid",
      reason: "invalid_json",
      topicUpdateOps: [],
      rejectedOps: []
    });
  }

  const topicUpdateOps: TopicUpdateOp[] = [];
  const rejectedOps: TopicUpdateProposalDebugInfo["rejectedOps"] = [];

  for (const [rawOpIndex, rawOp] of parsedResponse.ops.entries()) {
    const normalized = normalizeOp({
      rawOp,
      textUnderstandings: input.textUnderstandings
    });

    if (!normalized.op) {
      rejectedOps.push({
        rawOpIndex,
        reason: normalized.reason ?? "invalid_op",
        rawOp
      });
      continue;
    }

    topicUpdateOps.push(normalized.op);
  }

  return buildResult({
    input,
    rawOps: parsedResponse.ops,
    status: rejectedOps.length > 0 ? "invalid" : "valid",
    reason: rejectedOps.length > 0 ? "some_ops_rejected" : undefined,
    topicUpdateOps,
    rejectedOps
  });
}

function formatProposeTopicUpdatesOutput(
  input: FormatProposeTopicUpdatesOutputInput
): ProposeTopicUpdatesValidationResult {
  return analyzeProposeTopicUpdatesOutput(input);
}

export {
  analyzeProposeTopicUpdatesOutput,
  buildFallbackOps,
  formatProposeTopicUpdatesOutput
};
