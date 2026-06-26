import {
  BROAD_CATEGORY_HINTS,
  TOPIC_UPDATE_OPS
} from "./proposeTopicUpdates.schema";

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
  TopicUpdateOperation
} from "../typesSupportProcessingPipelineV2.types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isTopicUpdateOperation(value: unknown): value is TopicUpdateOperation {
  return typeof value === "string" &&
    TOPIC_UPDATE_OPS.includes(value as TopicUpdateOperation);
}

function nullableString(value: unknown): string | null | undefined {
  if (value === undefined || value === null) {
    return null;
  }

  return isNonEmptyString(value) ? value.trim() : undefined;
}

function normalizeBroadCategoryHint(
  value: unknown
): string | null | undefined {
  const rawValue = nullableString(value);

  if (rawValue === null || rawValue === undefined) {
    return rawValue;
  }

  if (BROAD_CATEGORY_HINTS.includes(rawValue as typeof BROAD_CATEGORY_HINTS[number])) {
    return rawValue;
  }

  if (rawValue === "notifications") {
    return "bug";
  }

  return undefined;
}

function topicIdFromUnknown(topic: unknown): string | undefined {
  if (!isRecord(topic)) {
    return undefined;
  }

  const topicId =
    topic.id ??
    topic.id_topic ??
    topic.topicId ??
    topic.topic_id;

  if (typeof topicId === "string" && topicId.trim() !== "") {
    return topicId.trim();
  }

  if (typeof topicId === "number" && Number.isFinite(topicId)) {
    return String(topicId);
  }

  return undefined;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function parseItemIndexes(value: unknown): number[] | undefined {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    return undefined;
  }

  const indexes: number[] = [];

  for (const item of value) {
    if (!isNonNegativeInteger(item)) {
      return undefined;
    }

    indexes.push(item);
  }

  return Array.from(new Set(indexes));
}

function parseReferencePair(value: unknown): TopicItemReference | undefined {
  if (!Array.isArray(value) || value.length !== 2) {
    return undefined;
  }

  const [itemIndex, childIndex] = value;

  if (!isNonNegativeInteger(itemIndex) || !isNonNegativeInteger(childIndex)) {
    return undefined;
  }

  return [itemIndex, childIndex];
}

function parseReferencePairs(value: unknown): TopicItemReference[] | undefined {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    return undefined;
  }

  const refs: TopicItemReference[] = [];

  for (const item of value) {
    const ref = parseReferencePair(item);

    if (!ref) {
      return undefined;
    }

    refs.push(ref);
  }

  return refs;
}

function parseTopic(value: unknown): TopicPatchIdentity | null | undefined {
  if (value === undefined || value === null) {
    return null;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  const title = nullableString(value.title);
  const broadCategoryHint = normalizeBroadCategoryHint(value.broadCategoryHint);
  const summary = nullableString(value.summary);

  if (
    title === undefined ||
    broadCategoryHint === undefined ||
    summary === undefined
  ) {
    return undefined;
  }

  return {
    title,
    broadCategoryHint,
    summary
  };
}

function parseMerge(value: unknown): TopicMergeRefs | null | undefined {
  if (value === undefined || value === null) {
    return null;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  const caseDetails = parseReferencePairs(value.caseDetails);
  const attemptedActions = parseReferencePairs(value.attemptedActions);

  if (!caseDetails || !attemptedActions) {
    return undefined;
  }

  return {
    caseDetails,
    attemptedActions
  };
}

function parseReplace(value: unknown): TopicReplaceRefs | null | undefined {
  if (value === undefined || value === null) {
    return null;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  if (
    !Array.isArray(value.caseDetails) ||
    !Array.isArray(value.attemptedActions)
  ) {
    return undefined;
  }

  const caseDetails: TopicReplaceRefs["caseDetails"] = [];
  const attemptedActions: TopicReplaceRefs["attemptedActions"] = [];

  for (const item of value.caseDetails) {
    if (!isRecord(item) || !isNonEmptyString(item.key)) {
      return undefined;
    }

    const withRef = parseReferencePair(item.with);

    if (!withRef) {
      return undefined;
    }

    caseDetails.push({
      key: item.key.trim(),
      with: withRef
    });
  }

  for (const item of value.attemptedActions) {
    if (!isRecord(item) || !isNonNegativeInteger(item.targetIndex)) {
      return undefined;
    }

    const withRef = parseReferencePair(item.with);

    if (!withRef) {
      return undefined;
    }

    attemptedActions.push({
      targetIndex: item.targetIndex,
      with: withRef
    });
  }

  return {
    caseDetails,
    attemptedActions
  };
}

function hasUsefulMergeOrReplace(
  merge: TopicMergeRefs | null,
  replace: TopicReplaceRefs | null
): boolean {
  return Boolean(
    merge?.caseDetails.length ||
      merge?.attemptedActions.length ||
      replace?.caseDetails.length ||
      replace?.attemptedActions.length
  );
}

function referenceExists(params: {
  ref: TopicItemReference;
  textUnderstandings: TextUnderstanding[];
  childKey: "caseDetails" | "attemptedActions";
}): boolean {
  const [itemIndex, childIndex] = params.ref;
  const understanding = params.textUnderstandings[itemIndex];

  return Boolean(understanding?.[params.childKey]?.[childIndex]);
}

function validateReferences(params: {
  op: TopicUpdateOp;
  textUnderstandings: TextUnderstanding[];
}): boolean {
  const mergeCaseDetails = params.op.merge?.caseDetails ?? [];
  const mergeAttemptedActions = params.op.merge?.attemptedActions ?? [];
  const replaceCaseDetails = params.op.replace?.caseDetails.map((item) => {
    return item.with;
  }) ?? [];
  const replaceAttemptedActions = params.op.replace?.attemptedActions.map((item) => {
    return item.with;
  }) ?? [];

  return mergeCaseDetails.every((ref) => {
    return referenceExists({
      ref,
      textUnderstandings: params.textUnderstandings,
      childKey: "caseDetails"
    });
  }) &&
    replaceCaseDetails.every((ref) => {
      return referenceExists({
        ref,
        textUnderstandings: params.textUnderstandings,
        childKey: "caseDetails"
      });
    }) &&
    mergeAttemptedActions.every((ref) => {
      return referenceExists({
        ref,
        textUnderstandings: params.textUnderstandings,
        childKey: "attemptedActions"
      });
    }) &&
    replaceAttemptedActions.every((ref) => {
      return referenceExists({
        ref,
        textUnderstandings: params.textUnderstandings,
        childKey: "attemptedActions"
      });
    });
}

function buildReviewOp(params: {
  items: number[];
  reason: string;
}): TopicUpdateOp {
  return {
    op: "review",
    items: params.items,
    topicId: null,
    topic: null,
    merge: null,
    replace: null,
    review: params.reason
  };
}

function normalizeOp(params: {
  rawOp: unknown;
  textUnderstandings: TextUnderstanding[];
  existingTopicIds: Set<string>;
}): TopicUpdateOp | undefined {
  if (!isRecord(params.rawOp) || !isTopicUpdateOperation(params.rawOp.op)) {
    return undefined;
  }

  const items = parseItemIndexes(params.rawOp.items);
  const topicId = nullableString(params.rawOp.topicId);
  const topic = parseTopic(params.rawOp.topic);
  const merge = parseMerge(params.rawOp.merge);
  const replace = parseReplace(params.rawOp.replace);
  const review = nullableString(params.rawOp.review);

  if (
    !items ||
    topicId === undefined ||
    topic === undefined ||
    merge === undefined ||
    replace === undefined ||
    review === undefined
  ) {
    return undefined;
  }

  if (!items.every((itemIndex) => {
    return params.textUnderstandings[itemIndex] !== undefined;
  })) {
    return undefined;
  }

  const op: TopicUpdateOp = {
    op: params.rawOp.op,
    items,
    topicId,
    topic,
    merge,
    replace,
    review
  };

  if (!validateReferences({
    op,
    textUnderstandings: params.textUnderstandings
  })) {
    return buildReviewOp({
      items,
      reason: "Invalid topic update references."
    });
  }

  if (op.op === "update") {
    if (op.topicId === null || !params.existingTopicIds.has(op.topicId)) {
      return buildReviewOp({
        items,
        reason: "Update operation does not reference an existing topic."
      });
    }
  }

  if (op.op === "create") {
    if (op.topicId !== null || op.topic === null || op.replace !== null) {
      return buildReviewOp({
        items,
        reason: "Create operation must use topicId null, include topic, and omit replace."
      });
    }
  }

  if (
    (op.op === "none" || op.op === "review") &&
    hasUsefulMergeOrReplace(op.merge, op.replace)
  ) {
    return buildReviewOp({
      items,
      reason: `${op.op} operation cannot include merge or replace references.`
    });
  }

  return op;
}

function buildFallbackOps(
  textUnderstandings: TextUnderstanding[]
): TopicUpdateOp[] {
  return textUnderstandings.map((_understanding, index) => {
    return buildReviewOp({
      items: [index],
      reason: "No valid topic update op covered this understanding."
    });
  });
}

function formatProposeTopicUpdatesOutput(
  input: FormatProposeTopicUpdatesOutputInput
): ProposeTopicUpdatesValidationResult {
  if (input.rawProposeTopicUpdates.status !== "completed") {
    return {
      status: "invalid",
      reason: "llm_call_failed",
      topicUpdateOps: buildFallbackOps(input.textUnderstandings)
    };
  }

  const parsedResponse = input.rawProposeTopicUpdates.parsedResponse;

  if (!isRecord(parsedResponse) || !Array.isArray(parsedResponse.ops)) {
    return {
      status: "invalid",
      reason: "invalid_json",
      topicUpdateOps: buildFallbackOps(input.textUnderstandings)
    };
  }

  const existingTopicIds = new Set(
    input.existingTopics.flatMap((topic) => {
      const topicId = topicIdFromUnknown(topic);

      return topicId ? [topicId] : [];
    })
  );
  const topicUpdateOps: TopicUpdateOp[] = [];
  const coveredItems = new Set<number>();
  let rejectedOpCount = 0;
  let convertedReviewCount = 0;

  for (const rawOp of parsedResponse.ops) {
    const op = normalizeOp({
      rawOp,
      textUnderstandings: input.textUnderstandings,
      existingTopicIds
    });

    if (!op) {
      rejectedOpCount += 1;
      continue;
    }

    if (
      op.op === "review" &&
      op.review !== null &&
      op.review !== (isRecord(rawOp) && typeof rawOp.review === "string"
        ? rawOp.review.trim()
        : null)
    ) {
      convertedReviewCount += 1;
    }

    topicUpdateOps.push(op);

    for (const itemIndex of op.items) {
      coveredItems.add(itemIndex);
    }
  }

  for (let index = 0; index < input.textUnderstandings.length; index += 1) {
    if (!coveredItems.has(index)) {
      topicUpdateOps.push(buildReviewOp({
        items: [index],
        reason: "No valid topic update op covered this understanding."
      }));
    }
  }

  if (
    rejectedOpCount > 0 ||
    convertedReviewCount > 0 ||
    topicUpdateOps.some((op) => {
      return op.op === "review" &&
        op.review === "No valid topic update op covered this understanding.";
    })
  ) {
    return {
      status: "invalid",
      reason: "invalid_ops",
      topicUpdateOps
    };
  }

  return {
    status: "valid",
    topicUpdateOps
  };
}

export {
  buildFallbackOps,
  formatProposeTopicUpdatesOutput
};
