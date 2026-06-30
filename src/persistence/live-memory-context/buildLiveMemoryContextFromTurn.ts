import type {
  SupportAutomationTurnV2Result
} from "../../orchestration/runSupportAutomationTurnV2";
import type {
  MatrixDeliveryResult
} from "../../channels/matrix/typesMatrixChannel.types";
import type {
  DeliveryMessage
} from "../../orchestration/typesOrchestration.types";
import type {
  MergedTopicSnapshot
} from "../../support-processing-pipeline-v2/typesSupportProcessingPipelineV2.types";
import type {
  LiveMemoryContext,
  LiveMemoryTopic,
  LiveMemoryUserState
} from "./typesLiveMemoryContext.types";
import {
  normalizeLiveMemoryTopicId
} from "./normalizeLiveMemoryTopicId";

type BuildLiveMemoryContextFromTurnInput = {
  previousContext: LiveMemoryContext | null;
  supportAutomationTurnResult: SupportAutomationTurnV2Result;
  matrixDeliveryResults: MatrixDeliveryResult[];
  deliveryMessages?: DeliveryMessage[];
};

type OutputWithRenderedResponse = {
  renderedSupportResponse?: {
    finalResponseText?: unknown;
  };
};

const DEFAULT_USER_STATE: LiveMemoryUserState = {
  status: "normal",
  flags: []
};

const IMPORTANT_DETAIL_KEYS = new Set([
  "product_or_service",
  "operating_system",
  "platform",
  "feature_or_page"
]);

const STRONG_SUBJECT_WORDS = new Set([
  "android",
  "drive",
  "mail",
  "notification",
  "notifications",
  "twake"
]);

function fallbackTopicId(snapshot: MergedTopicSnapshot, index: number): string {
  return snapshot.snapshotId || `topic_snapshot_${index + 1}`;
}

function toLiveMemoryTopic(
  snapshot: MergedTopicSnapshot,
  index: number
): LiveMemoryTopic {
  const topicId = normalizeLiveMemoryTopicId(
    snapshot.topicId ??
      snapshot.temporaryTopicId ??
      fallbackTopicId(snapshot, index)
  ) ?? fallbackTopicId(snapshot, index);

  return {
    topicId,
    title: snapshot.title ?? null,
    broadCategoryHint: snapshot.broadCategoryHint ?? null,
    summary: snapshot.summary ?? null,
    caseDetails: snapshot.caseDetails ?? [],
    attemptedActions: snapshot.attemptedActions ?? []
  };
}

function nonEmptyString(value: string | null): string | null {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : null;
}

function normalizeText(value: unknown): string | null {
  if (
    typeof value !== "string" &&
    typeof value !== "number" &&
    typeof value !== "boolean"
  ) {
    return null;
  }

  const normalized = String(value).trim().toLowerCase();

  return normalized === "" ? null : normalized;
}

function detailMap(topic: LiveMemoryTopic): Map<string, string> {
  const details = new Map<string, string>();

  for (const detail of topic.caseDetails) {
    const normalizedValue = normalizeText(detail.value);

    if (IMPORTANT_DETAIL_KEYS.has(detail.key) && normalizedValue) {
      details.set(detail.key, normalizedValue);
    }
  }

  return details;
}

function topicsHaveConflictingProducts(
  first: LiveMemoryTopic,
  second: LiveMemoryTopic
): boolean {
  const firstProduct = detailMap(first).get("product_or_service");
  const secondProduct = detailMap(second).get("product_or_service");

  return Boolean(firstProduct && secondProduct && firstProduct !== secondProduct);
}

function topicsShareImportantDetails(
  first: LiveMemoryTopic,
  second: LiveMemoryTopic
): boolean {
  const firstDetails = detailMap(first);
  const secondDetails = detailMap(second);
  const firstProduct = firstDetails.get("product_or_service");
  const secondProduct = secondDetails.get("product_or_service");

  if (!firstProduct || !secondProduct || firstProduct !== secondProduct) {
    return false;
  }

  for (const key of ["operating_system", "platform", "feature_or_page"]) {
    const firstValue = firstDetails.get(key);
    const secondValue = secondDetails.get(key);

    if (firstValue && secondValue && firstValue === secondValue) {
      return true;
    }
  }

  return false;
}

function strongSubjectWords(topic: LiveMemoryTopic): Set<string> {
  const text = [
    topic.title,
    topic.summary,
    ...topic.caseDetails.map((detail) => {
      return normalizeText(detail.value);
    })
  ]
    .filter((value): value is string => {
      return typeof value === "string" && value.trim() !== "";
    })
    .join(" ")
    .toLowerCase();

  return new Set(
    text
      .split(/[^a-z0-9]+/g)
      .filter((word) => {
        return STRONG_SUBJECT_WORDS.has(word);
      })
  );
}

function topicsHaveStrongWordOverlap(
  first: LiveMemoryTopic,
  second: LiveMemoryTopic
): boolean {
  if (topicsHaveConflictingProducts(first, second)) {
    return false;
  }

  const firstWords = strongSubjectWords(first);
  const overlapCount = [...strongSubjectWords(second)].filter((word) => {
    return firstWords.has(word);
  }).length;

  return overlapCount >= 2;
}

function shouldMergeLiveMemoryTopics(
  previous: LiveMemoryTopic,
  incoming: LiveMemoryTopic
): boolean {
  return topicsShareImportantDetails(previous, incoming) ||
    topicsHaveStrongWordOverlap(previous, incoming);
}

function mergeCaseDetails(
  previous: LiveMemoryTopic["caseDetails"],
  incoming: LiveMemoryTopic["caseDetails"]
): LiveMemoryTopic["caseDetails"] {
  const detailsByKey = new Map(previous.map((detail) => {
    return [detail.key, detail];
  }));

  for (const detail of incoming) {
    if (detail.key.trim() === "") {
      continue;
    }

    detailsByKey.set(detail.key, detail);
  }

  return [...detailsByKey.values()];
}

function normalizeAction(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function mergeAttemptedActions(
  previous: LiveMemoryTopic["attemptedActions"],
  incoming: LiveMemoryTopic["attemptedActions"]
): LiveMemoryTopic["attemptedActions"] {
  const actionsByKey = new Map(previous.map((action) => {
    return [normalizeAction(action.action), action];
  }));

  for (const action of incoming) {
    const key = normalizeAction(action.action);

    if (key === "") {
      continue;
    }

    actionsByKey.set(key, action);
  }

  return [...actionsByKey.values()];
}

function mergeLiveMemoryTopic(
  previous: LiveMemoryTopic | undefined,
  incoming: LiveMemoryTopic
): LiveMemoryTopic {
  const normalizedIncomingId =
    normalizeLiveMemoryTopicId(incoming.topicId) ?? incoming.topicId;

  if (!previous) {
    return {
      ...incoming,
      topicId: normalizedIncomingId
    };
  }

  return {
    topicId:
      normalizeLiveMemoryTopicId(previous.topicId) ??
      normalizedIncomingId,
    title: nonEmptyString(incoming.title) ?? previous.title,
    broadCategoryHint:
      nonEmptyString(incoming.broadCategoryHint) ?? previous.broadCategoryHint,
    summary: nonEmptyString(incoming.summary) ?? previous.summary,
    caseDetails: mergeCaseDetails(previous.caseDetails, incoming.caseDetails),
    attemptedActions: mergeAttemptedActions(
      previous.attemptedActions,
      incoming.attemptedActions
    )
  };
}

function overlayTopics(params: {
  previousTopics: LiveMemoryTopic[];
  snapshots: MergedTopicSnapshot[];
}): LiveMemoryTopic[] {
  const topicsById = new Map<string, LiveMemoryTopic>();

  for (const topic of params.previousTopics) {
    const normalizedTopicId =
      normalizeLiveMemoryTopicId(topic.topicId) ?? topic.topicId;
    topicsById.set(normalizedTopicId, {
      ...topic,
      topicId: normalizedTopicId
    });
  }

  for (const [index, snapshot] of params.snapshots.entries()) {
    const topic = toLiveMemoryTopic(snapshot, index);
    const existingTopicBySubject = [...topicsById.values()].find((previous) => {
      return shouldMergeLiveMemoryTopics(previous, topic);
    });
    const mergeTarget = topicsById.get(topic.topicId) ?? existingTopicBySubject;
    const mergedTopic = mergeLiveMemoryTopic(mergeTarget, topic);

    if (mergeTarget && mergeTarget.topicId !== mergedTopic.topicId) {
      topicsById.delete(mergeTarget.topicId);
    }

    topicsById.set(mergedTopic.topicId, mergedTopic);
  }

  return [...topicsById.values()];
}

function firstNonEmpty(values: Array<string | undefined>): string | null {
  const value = values.find((candidate) => {
    return typeof candidate === "string" && candidate.trim() !== "";
  });

  return value ?? null;
}

function resolveLastBotVerbatim(params: {
  supportAutomationTurnResult: SupportAutomationTurnV2Result;
  matrixDeliveryResults: MatrixDeliveryResult[];
  deliveryMessages?: DeliveryMessage[];
}): string | null {
  const deliveredContent = params.matrixDeliveryResults.flatMap((result) => {
    return result.deliveredMessages.map((message) => message.content);
  });
  const deliveryContent = (
    params.deliveryMessages ??
    params.supportAutomationTurnResult.deliveryMessages
  ).map((message) => message.content);
  const output = params.supportAutomationTurnResult.supportProcessingOutput as
    OutputWithRenderedResponse;
  const renderedResponseText =
    typeof output.renderedSupportResponse?.finalResponseText === "string"
      ? output.renderedSupportResponse.finalResponseText
      : undefined;

  return firstNonEmpty([
    deliveredContent.join("\n\n"),
    deliveryContent.join("\n\n"),
    renderedResponseText
  ]);
}

function buildLiveMemoryContextFromTurn(
  input: BuildLiveMemoryContextFromTurnInput
): LiveMemoryContext {
  return {
    topics: overlayTopics({
      previousTopics: input.previousContext?.topics ?? [],
      snapshots:
        input.supportAutomationTurnResult.supportProcessingOutput
          .mergedTopicSnapshots ?? []
    }),
    lastUserVerbatim:
      input.supportAutomationTurnResult.supportProcessingInput
        .latestUserMessage.content || null,
    lastBotVerbatim: resolveLastBotVerbatim({
      supportAutomationTurnResult: input.supportAutomationTurnResult,
      matrixDeliveryResults: input.matrixDeliveryResults,
      deliveryMessages: input.deliveryMessages
    }),
    userState: input.previousContext?.userState ?? DEFAULT_USER_STATE
  };
}

export {
  buildLiveMemoryContextFromTurn,
  mergeLiveMemoryTopic,
  normalizeLiveMemoryTopicId
};

export type {
  BuildLiveMemoryContextFromTurnInput
};
