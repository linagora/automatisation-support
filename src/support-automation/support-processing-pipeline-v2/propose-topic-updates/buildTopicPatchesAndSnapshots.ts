import type {
  MergedTopicSnapshot,
  SupportAttemptedAction,
  SupportCaseDetail,
  TextUnderstanding,
  TopicPatch,
  TopicPatchIdentity,
  TopicUpdateOp
} from "../typesSupportProcessingPipelineV2.types";

type BuildTopicPatchesAndSnapshotsInput = {
  existingTopics: unknown[];
  textUnderstandings: TextUnderstanding[];
  topicUpdateOps: TopicUpdateOp[];
};

type BuildTopicPatchesAndSnapshotsOutput = {
  topicPatches: TopicPatch[];
  mergedTopicSnapshots: MergedTopicSnapshot[];
};

type NumericTopicUpdateOp = Omit<TopicUpdateOp, "topicId"> & {
  topicId: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim() !== "") {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function topicIdFromExistingTopic(topic: unknown): number | null {
  if (!isRecord(topic)) {
    return null;
  }

  const rawTopicId = topic.topicId;

  if (typeof rawTopicId === "number" && Number.isInteger(rawTopicId) && rawTopicId >= 1) {
    return rawTopicId;
  }

  return null;
}

function topicIdFromOp(op: TopicUpdateOp): number | null {
  const topicId = (op as unknown as NumericTopicUpdateOp).topicId;

  return typeof topicId === "number" && Number.isInteger(topicId) && topicId >= 1
    ? topicId
    : null;
}

function topicTitleFromUnknown(topic: unknown): string | null {
  if (!isRecord(topic)) {
    return null;
  }

  return stringValue(topic.title);
}

function topicCategoryFromUnknown(topic: unknown): string | null {
  if (!isRecord(topic)) {
    return null;
  }

  return stringValue(topic.broadCategoryHint);
}

function topicSummaryFromUnknown(topic: unknown): string | null {
  if (!isRecord(topic)) {
    return null;
  }

  return stringValue(topic.summary);
}

function supportKnowledgeSummaryFromUnknown(topic: unknown): string | null {
  if (!isRecord(topic)) {
    return null;
  }

  return stringValue(topic.supportKnowledgeSummary);
}

function cleanEvidence(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value === "existing_topic" ? "" : value;
}

function copyCaseDetail(value: unknown): SupportCaseDetail | null {
  if (!isRecord(value) || typeof value.key !== "string") {
    return null;
  }

  const key = value.key.trim();

  if (key === "") {
    return null;
  }

  return {
    key,
    value: typeof value.value === "string" ||
      typeof value.value === "number" ||
      typeof value.value === "boolean" ||
      value.value === null
      ? value.value
      : String(value.value ?? ""),
    evidence: cleanEvidence(value.evidence)
  };
}

function copyAttemptedAction(value: unknown): SupportAttemptedAction | null {
  if (!isRecord(value) || typeof value.action !== "string") {
    return null;
  }

  const action = value.action.trim();

  if (action === "") {
    return null;
  }

  const outcome = value.outcome === "success" ||
    value.outcome === "failed" ||
    value.outcome === "partial" ||
    value.outcome === "unknown"
    ? value.outcome
    : "unknown";

  return {
    action,
    outcome,
    evidence: cleanEvidence(value.evidence)
  };
}

function caseDetailsFromTopic(topic: unknown): SupportCaseDetail[] {
  if (!isRecord(topic)) {
    return [];
  }

  if (Array.isArray(topic.caseDetails)) {
    return topic.caseDetails.flatMap((detail) => {
      const copied = copyCaseDetail(detail);

      return copied ? [copied] : [];
    });
  }

  return [];
}

function attemptedActionsFromTopic(topic: unknown): SupportAttemptedAction[] {
  if (!isRecord(topic) || !Array.isArray(topic.attemptedActions)) {
    return [];
  }

  return topic.attemptedActions.flatMap((action) => {
    const copied = copyAttemptedAction(action);

    return copied ? [copied] : [];
  });
}

function resolveCaseDetail(params: {
  textUnderstandings: TextUnderstanding[];
  ref: [number, number];
}): SupportCaseDetail | null {
  const [itemIndex, childIndex] = params.ref;
  const detail = params.textUnderstandings[itemIndex]?.caseDetails[childIndex];

  return detail ? { ...detail, evidence: cleanEvidence(detail.evidence) } : null;
}

function resolveAttemptedAction(params: {
  textUnderstandings: TextUnderstanding[];
  ref: [number, number];
}): SupportAttemptedAction | null {
  const [itemIndex, childIndex] = params.ref;
  const action =
    params.textUnderstandings[itemIndex]?.attemptedActions[childIndex];

  return action ? { ...action, evidence: cleanEvidence(action.evidence) } : null;
}

function selectedUnderstandings(params: {
  textUnderstandings: TextUnderstanding[];
  itemIndexes: number[];
}): TextUnderstanding[] {
  return params.itemIndexes.flatMap((index) => {
    const understanding = params.textUnderstandings[index];

    return understanding ? [understanding] : [];
  });
}

function sourceVerbatimsFromUnderstandings(
  understandings: TextUnderstanding[]
): string[] {
  const values = understandings.flatMap((understanding) => {
    const legacySourceVerbatims = understanding.sourceVerbatims;

    if (Array.isArray(legacySourceVerbatims)) {
      return legacySourceVerbatims.flatMap((value) => {
        return typeof value === "string" && value.trim() !== ""
          ? [value.trim()]
          : [];
      });
    }

    return understanding.summary.trim() !== ""
      ? [understanding.summary.trim()]
      : [];
  });

  return Array.from(new Set(values));
}

function normalizeAction(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function mergeCaseDetail(
  caseDetails: SupportCaseDetail[],
  detail: SupportCaseDetail
): SupportCaseDetail[] {
  const incoming = {
    ...detail,
    evidence: cleanEvidence(detail.evidence)
  };

  const next = caseDetails.filter((existing) => {
    return existing.key !== incoming.key;
  });

  next.push(incoming);

  return next;
}

function mergeAttemptedAction(
  attemptedActions: SupportAttemptedAction[],
  action: SupportAttemptedAction
): SupportAttemptedAction[] {
  const incoming = {
    ...action,
    evidence: cleanEvidence(action.evidence)
  };
  const normalizedAction = normalizeAction(incoming.action);
  const existingIndex = attemptedActions.findIndex((existing) => {
    return normalizeAction(existing.action) === normalizedAction;
  });

  if (existingIndex === -1) {
    return [...attemptedActions, incoming];
  }

  return attemptedActions.map((existing, index) => {
    return index === existingIndex ? incoming : existing;
  });
}

function applyTopicIdentity(params: {
  base: {
    title: string | null;
    broadCategoryHint: string | null;
    summary: string | null;
  };
  topic: TopicPatchIdentity | null;
  isCreate: boolean;
}): {
  title: string | null;
  broadCategoryHint: string | null;
  summary: string | null;
} {
  if (params.isCreate) {
    return {
      title: params.topic?.title ?? params.base.title,
      broadCategoryHint:
        params.topic?.broadCategoryHint ?? params.base.broadCategoryHint,
      summary: params.topic?.summary ?? params.base.summary
    };
  }

  // For updates, null means "do not change". This prevents accidental deletion.
  return {
    title: params.topic?.title ?? params.base.title,
    broadCategoryHint:
      params.topic?.broadCategoryHint ?? params.base.broadCategoryHint,
    summary: params.topic?.summary ?? params.base.summary
  };
}

function findExistingTopic(params: {
  existingTopics: unknown[];
  topicId: number | null;
}): unknown | null {
  if (params.topicId === null) {
    return null;
  }

  return params.existingTopics.find((topic) => {
    return topicIdFromExistingTopic(topic) === params.topicId;
  }) ?? null;
}

function maxTopicIdFromTopics(topics: unknown[]): number {
  return topics.reduce<number>((maxTopicId, topic) => {
    const topicId = topicIdFromExistingTopic(topic);

    return topicId !== null && topicId > maxTopicId ? topicId : maxTopicId;
  }, 0);
}

function buildPatch(params: {
  op: TopicUpdateOp;
  opIndex: number;
  finalTopicId: number;
  textUnderstandings: TextUnderstanding[];
}): TopicPatch {
  const understandings = selectedUnderstandings({
    textUnderstandings: params.textUnderstandings,
    itemIndexes: params.op.items
  });
  const mergeCaseDetails =
    params.op.merge?.caseDetails.flatMap((ref) => {
      const detail = resolveCaseDetail({
        textUnderstandings: params.textUnderstandings,
        ref
      });

      return detail ? [detail] : [];
    }) ?? [];
  const mergeAttemptedActions =
    params.op.merge?.attemptedActions.flatMap((ref) => {
      const action = resolveAttemptedAction({
        textUnderstandings: params.textUnderstandings,
        ref
      });

      return action ? [action] : [];
    }) ?? [];
  const replaceCaseDetails =
    params.op.replace?.caseDetails.flatMap((replacement) => {
      const detail = resolveCaseDetail({
        textUnderstandings: params.textUnderstandings,
        ref: replacement.with
      });

      return detail
        ? [{
            key: replacement.key,
            with: detail
          }]
        : [];
    }) ?? [];
  const replaceAttemptedActions =
    params.op.replace?.attemptedActions.flatMap((replacement) => {
      const action = resolveAttemptedAction({
        textUnderstandings: params.textUnderstandings,
        ref: replacement.with
      });

      return action
        ? [{
            targetIndex: replacement.targetIndex,
            with: action
          }]
        : [];
    }) ?? [];

  return {
    patchId: `topic_patch_${params.opIndex + 1}`,
    op: params.op.op,
    items: params.op.items,
    topicId: params.finalTopicId,
    temporaryTopicId: null,
    topic: params.op.topic,
    merge: {
      caseDetails: mergeCaseDetails,
      attemptedActions: mergeAttemptedActions
    },
    replace: {
      caseDetails: replaceCaseDetails,
      attemptedActions: replaceAttemptedActions
    },
    review: params.op.review,
    sourceUnderstandingIds: understandings.map((understanding) => {
      return understanding.understandingId;
    }),
    selectedSourceVerbatims: sourceVerbatimsFromUnderstandings(understandings)
  } as unknown as TopicPatch;
}

function buildSnapshot(params: {
  op: TopicUpdateOp;
  patch: TopicPatch;
  existingTopic: unknown | null;
  opIndex: number;
  finalTopicId: number;
}): MergedTopicSnapshot {
  const base = {
    title: params.op.op === "create"
      ? null
      : topicTitleFromUnknown(params.existingTopic),
    broadCategoryHint: params.op.op === "create"
      ? null
      : topicCategoryFromUnknown(params.existingTopic),
    summary: params.op.op === "create"
      ? null
      : topicSummaryFromUnknown(params.existingTopic)
  };
  const identity = applyTopicIdentity({
    base,
    topic: params.op.topic,
    isCreate: params.op.op === "create"
  });
  let caseDetails = params.op.op === "create"
    ? []
    : caseDetailsFromTopic(params.existingTopic);
  let attemptedActions = params.op.op === "create"
    ? []
    : attemptedActionsFromTopic(params.existingTopic);

  for (const replacement of params.patch.replace.caseDetails) {
    caseDetails = caseDetails.filter((detail) => {
      return detail.key !== replacement.key;
    });
    caseDetails = mergeCaseDetail(caseDetails, replacement.with);
  }

  for (const detail of params.patch.merge.caseDetails) {
    caseDetails = mergeCaseDetail(caseDetails, detail);
  }

  for (const replacement of params.patch.replace.attemptedActions) {
    if (
      replacement.targetIndex >= 0 &&
      replacement.targetIndex < attemptedActions.length
    ) {
      attemptedActions = attemptedActions.map((action, index) => {
        return index === replacement.targetIndex ? replacement.with : action;
      });
    } else {
      attemptedActions = mergeAttemptedAction(
        attemptedActions,
        replacement.with
      );
    }
  }

  for (const action of params.patch.merge.attemptedActions) {
    attemptedActions = mergeAttemptedAction(attemptedActions, action);
  }

  return {
    snapshotId: `topic_${params.finalTopicId}`,
    topicId: params.finalTopicId,
    temporaryTopicId: null,
    isNewTopic: params.op.op === "create",
    title: identity.title,
    broadCategoryHint: identity.broadCategoryHint,
    summary: identity.summary,
    caseDetails,
    attemptedActions,
    ...(params.op.op === "create"
      ? {}
      : {
          supportKnowledgeSummary:
            supportKnowledgeSummaryFromUnknown(params.existingTopic)
        }),
    sourceUnderstandingIds: params.patch.sourceUnderstandingIds,
    sourceVerbatims: params.patch.selectedSourceVerbatims,
    sourceOpIndex: params.opIndex,
    baseTopic: params.existingTopic
  } as unknown as MergedTopicSnapshot;
}

function buildTopicPatchesAndSnapshots(
  input: BuildTopicPatchesAndSnapshotsInput
): BuildTopicPatchesAndSnapshotsOutput {
  const topicPatches: TopicPatch[] = [];
  const mergedTopicSnapshots: MergedTopicSnapshot[] = [];
  let nextTopicId = maxTopicIdFromTopics(input.existingTopics) + 1;

  input.topicUpdateOps.forEach((op, opIndex) => {
    const opTopicId = topicIdFromOp(op);
    const finalTopicId = op.op === "create"
      ? nextTopicId
      : opTopicId;

    if (finalTopicId === null) {
      return;
    }

    if (op.op === "create") {
      nextTopicId += 1;
    }

    const existingTopic = op.op === "update"
      ? findExistingTopic({
          existingTopics: input.existingTopics,
          topicId: finalTopicId
        })
      : null;

    if (op.op === "update" && existingTopic === null) {
      return;
    }

    const patch = buildPatch({
      op,
      opIndex,
      finalTopicId,
      textUnderstandings: input.textUnderstandings
    });

    topicPatches.push(patch);

    mergedTopicSnapshots.push(buildSnapshot({
      op,
      patch,
      existingTopic,
      opIndex,
      finalTopicId
    }));
  });

  return {
    topicPatches,
    mergedTopicSnapshots
  };
}

export {
  buildTopicPatchesAndSnapshots
};

export type {
  BuildTopicPatchesAndSnapshotsInput,
  BuildTopicPatchesAndSnapshotsOutput
};
