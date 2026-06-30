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

function topicIdFromUnknown(topic: unknown): string | null {
  if (!isRecord(topic)) {
    return null;
  }

  return stringValue(
    topic.topicId ??
      topic.topic_id ??
      topic.id_topic ??
      topic.id
  );
}

function topicTitleFromUnknown(topic: unknown): string | null {
  if (!isRecord(topic)) {
    return null;
  }

  return stringValue(topic.title ?? topic.topic_title);
}

function topicCategoryFromUnknown(topic: unknown): string | null {
  if (!isRecord(topic)) {
    return null;
  }

  return stringValue(topic.broadCategoryHint ?? topic.topic_category);
}

function topicSummaryFromUnknown(topic: unknown): string | null {
  if (!isRecord(topic)) {
    return null;
  }

  return stringValue(topic.summary);
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
    evidence: typeof value.evidence === "string" ? value.evidence : ""
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
    evidence: typeof value.evidence === "string" ? value.evidence : ""
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

  const topicDetails = topic.topic_details ?? topic.knownFacts;

  if (!isRecord(topicDetails)) {
    return [];
  }

  return Object.entries(topicDetails).flatMap(([key, value]) => {
    if (
      typeof value !== "string" &&
      typeof value !== "number" &&
      typeof value !== "boolean" &&
      value !== null
    ) {
      return [];
    }

    return [{
      key,
      value,
      evidence: "existing_topic"
    }];
  });
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

  return detail ? { ...detail } : null;
}

function resolveAttemptedAction(params: {
  textUnderstandings: TextUnderstanding[];
  ref: [number, number];
}): SupportAttemptedAction | null {
  const [itemIndex, childIndex] = params.ref;
  const action =
    params.textUnderstandings[itemIndex]?.attemptedActions[childIndex];

  return action ? { ...action } : null;
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

function topicDetailsFromCaseDetails(
  caseDetails: SupportCaseDetail[]
): Record<string, string | number | boolean | null> {
  return caseDetails.reduce<Record<string, string | number | boolean | null>>(
    (topicDetails, detail) => {
      topicDetails[detail.key] = detail.value;

      return topicDetails;
    },
    {}
  );
}

function normalizeAction(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function mergeCaseDetail(
  caseDetails: SupportCaseDetail[],
  detail: SupportCaseDetail
): SupportCaseDetail[] {
  const next = caseDetails.filter((existing) => {
    return existing.key !== detail.key;
  });

  next.push(detail);

  return next;
}

function mergeAttemptedAction(
  attemptedActions: SupportAttemptedAction[],
  action: SupportAttemptedAction
): SupportAttemptedAction[] {
  const normalizedAction = normalizeAction(action.action);
  const existingIndex = attemptedActions.findIndex((existing) => {
    return normalizeAction(existing.action) === normalizedAction;
  });

  if (existingIndex === -1) {
    return [...attemptedActions, action];
  }

  return attemptedActions.map((existing, index) => {
    return index === existingIndex ? action : existing;
  });
}

function applyTopicIdentity(params: {
  base: {
    title: string | null;
    broadCategoryHint: string | null;
    summary: string | null;
  };
  topic: TopicPatchIdentity | null;
}): {
  title: string | null;
  broadCategoryHint: string | null;
  summary: string | null;
} {
  return {
    title: params.topic?.title ?? params.base.title,
    broadCategoryHint:
      params.topic?.broadCategoryHint ?? params.base.broadCategoryHint,
    summary: params.topic?.summary ?? params.base.summary
  };
}

function findExistingTopic(params: {
  existingTopics: unknown[];
  topicId: string | null;
}): unknown | null {
  if (params.topicId === null) {
    return null;
  }

  return params.existingTopics.find((topic) => {
    return topicIdFromUnknown(topic) === params.topicId;
  }) ?? null;
}

function buildPatch(params: {
  op: TopicUpdateOp;
  opIndex: number;
  temporaryTopicId: string | null;
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
    topicId: params.op.topicId,
    temporaryTopicId: params.temporaryTopicId,
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
  };
}

function buildSnapshot(params: {
  op: TopicUpdateOp;
  patch: TopicPatch;
  existingTopic: unknown | null;
  opIndex: number;
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
    topic: params.op.topic
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
    snapshotId: params.patch.temporaryTopicId ?? params.patch.patchId,
    topicId: params.patch.topicId,
    temporaryTopicId: params.patch.temporaryTopicId,
    isNewTopic: params.op.op === "create",
    title: identity.title,
    broadCategoryHint: identity.broadCategoryHint,
    summary: identity.summary,
    caseDetails,
    attemptedActions,
    topic_details: topicDetailsFromCaseDetails(caseDetails),
    sourceUnderstandingIds: params.patch.sourceUnderstandingIds,
    sourceVerbatims: params.patch.selectedSourceVerbatims,
    sourceOpIndex: params.opIndex,
    baseTopic: params.existingTopic
  };
}

function buildTopicPatchesAndSnapshots(
  input: BuildTopicPatchesAndSnapshotsInput
): BuildTopicPatchesAndSnapshotsOutput {
  const topicPatches: TopicPatch[] = [];
  const mergedTopicSnapshots: MergedTopicSnapshot[] = [];
  let newTopicIndex = 1;

  input.topicUpdateOps.forEach((op, opIndex) => {
    const temporaryTopicId = op.op === "create"
      ? `new_topic_${newTopicIndex}`
      : null;

    if (op.op === "create") {
      newTopicIndex += 1;
    }

    const patch = buildPatch({
      op,
      opIndex,
      temporaryTopicId,
      textUnderstandings: input.textUnderstandings
    });

    topicPatches.push(patch);

    if (op.op === "update" || op.op === "create") {
      const existingTopic = findExistingTopic({
        existingTopics: input.existingTopics,
        topicId: op.topicId
      });

      mergedTopicSnapshots.push(buildSnapshot({
        op,
        patch,
        existingTopic,
        opIndex
      }));
    }
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
