import {
  readLiveMemoryContext,
  writeLiveMemoryContext
} from "../../infrastructure/live-memory/liveMemoryContextStore";
import {
  parseLiveMemoryTopicId
} from "../../infrastructure/live-memory/normalizeLiveMemoryTopicId";
import {
  mergeSupportKnowledgeSummary,
  normalizeSupportKnowledgeSummary
} from "../support-processing-pipeline-v2/supportKnowledgeSummary";

import type {
  SupportTurnIdentityV2
} from "../build-input/buildSupportTurnIdentityV2";
import type {
  LiveMemoryContext,
  LiveMemoryTopic
} from "../../infrastructure/live-memory/typesLiveMemoryContext.types";
import type {
  LiveMemoryAttemptedAction,
  LiveMemoryCaseDetail,
  LiveMemoryContextUpdate,
  LiveMemoryTopicUpdate
} from "../support-processing-pipeline-v2/typesSupportProcessingPipelineV2.types";

type ApplyLiveMemoryUpdateDeliveryResult = {
  status: "sent" | "failed" | "partial";
  deliveredMessages?: {
    content: string;
  }[];
};

type ApplyLiveMemoryUpdateInput = {
  turnIdentity: SupportTurnIdentityV2;
  liveMemoryUpdate: LiveMemoryContextUpdate;
  deliveryResult?: ApplyLiveMemoryUpdateDeliveryResult;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : null;
}

function nullableSupportKnowledgeSummary(value: unknown): LiveMemoryTopic["supportKnowledgeSummary"] | null {
  return normalizeSupportKnowledgeSummary(value);
}

function sanitizeEvidence(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "" || value === "existing_topic") {
    return "";
  }

  return value;
}

function normalizeCaseDetail(
  detail: LiveMemoryCaseDetail
): LiveMemoryTopic["caseDetails"][number] | null {
  if (!isRecord(detail) || typeof detail.key !== "string" || detail.key.trim() === "") {
    return null;
  }

  const value = detail.value;

  if (
    typeof value !== "string" &&
    typeof value !== "number" &&
    typeof value !== "boolean" &&
    value !== null
  ) {
    return null;
  }

  return {
    key: detail.key.trim(),
    value,
    evidence: sanitizeEvidence(detail.evidence)
  };
}

function normalizeAttemptedAction(
  attemptedAction: LiveMemoryAttemptedAction
): LiveMemoryTopic["attemptedActions"][number] | null {
  if (
    !isRecord(attemptedAction) ||
    typeof attemptedAction.action !== "string" ||
    attemptedAction.action.trim() === ""
  ) {
    return null;
  }

  const outcome = attemptedAction.outcome === "success" ||
    attemptedAction.outcome === "failed" ||
    attemptedAction.outcome === "partial" ||
    attemptedAction.outcome === "unknown"
    ? attemptedAction.outcome
    : "unknown";

  return {
    action: attemptedAction.action.trim(),
    outcome,
    evidence: sanitizeEvidence(attemptedAction.evidence)
  };
}

function toLiveMemoryTopic(topic: LiveMemoryTopicUpdate): LiveMemoryTopic | null {
  const topicRecord = topic as unknown as Record<string, unknown>;
  const topicId = parseLiveMemoryTopicId(topicRecord.topicId);

  if (topicId === null) {
    return null;
  }

  return {
    topicId,
    title: nullableString(topicRecord.title),
    broadCategoryHint: nullableString(topicRecord.broadCategoryHint),
    summary: nullableString(topicRecord.summary),
    caseDetails: Array.isArray(topicRecord.caseDetails)
      ? topicRecord.caseDetails.flatMap((detail) => {
          const normalized = normalizeCaseDetail(detail as LiveMemoryCaseDetail);

          return normalized ? [normalized] : [];
        })
      : [],
    attemptedActions: Array.isArray(topicRecord.attemptedActions)
      ? topicRecord.attemptedActions.flatMap((action) => {
          const normalized = normalizeAttemptedAction(action as LiveMemoryAttemptedAction);

          return normalized ? [normalized] : [];
        })
      : [],
    ...(nullableSupportKnowledgeSummary(topicRecord.supportKnowledgeSummary)
      ? { supportKnowledgeSummary: nullableSupportKnowledgeSummary(topicRecord.supportKnowledgeSummary) as LiveMemoryTopic["supportKnowledgeSummary"] }
      : {})
  };
}

function shouldWriteLastBotVerbatim(
  deliveryResult: ApplyLiveMemoryUpdateDeliveryResult | undefined
): boolean {
  if (!deliveryResult) {
    return true;
  }

  if (deliveryResult.status === "sent") {
    return true;
  }

  return deliveryResult.status === "partial" &&
    (deliveryResult.deliveredMessages?.length ?? 0) > 0;
}

function firstNonEmptyString(values: Array<string | null | undefined>): string | null {
  const value = values.find((candidate) => {
    return typeof candidate === "string" && candidate.trim() !== "";
  });

  return value ?? null;
}

function resolveLastBotVerbatim(params: {
  previousContext: LiveMemoryContext | null;
  liveMemoryUpdate: LiveMemoryContextUpdate;
  deliveryResult?: ApplyLiveMemoryUpdateDeliveryResult;
}): string | null {
  if (!shouldWriteLastBotVerbatim(params.deliveryResult)) {
    return params.previousContext?.lastBotVerbatim ?? null;
  }

  const deliveredText = params.deliveryResult?.deliveredMessages
    ?.map((message) => message.content)
    .filter((content) => content.trim() !== "")
    .join("\n\n");

  const updateRecord = params.liveMemoryUpdate as unknown as Record<string, unknown>;

  return firstNonEmptyString([
    deliveredText,
    nullableString(updateRecord.lastBotVerbatim),
    params.previousContext?.lastBotVerbatim
  ]);
}

function applyTopicsByExactId(params: {
  previousTopics: LiveMemoryTopic[];
  incomingTopics: LiveMemoryTopic[];
}): LiveMemoryTopic[] {
  const topicsById = new Map<number, LiveMemoryTopic>();

  for (const topic of params.previousTopics) {
    topicsById.set(topic.topicId, topic);
  }

  for (const topic of params.incomingTopics) {
    const previous = topicsById.get(topic.topicId);
    const supportKnowledgeSummary = mergeSupportKnowledgeSummary({
      existing: previous?.supportKnowledgeSummary,
      next: topic.supportKnowledgeSummary
    });

    topicsById.set(topic.topicId, {
      ...topic,
      ...(supportKnowledgeSummary ? { supportKnowledgeSummary } : {})
    });
  }

  return [...topicsById.values()].sort((first, second) => {
    return first.topicId - second.topicId;
  });
}

async function applyLiveMemoryUpdate(
  input: ApplyLiveMemoryUpdateInput
): Promise<LiveMemoryContext> {
  const previousContext =
    await readLiveMemoryContext(input.turnIdentity.conversationKey);
  const updateRecord = input.liveMemoryUpdate as unknown as Record<string, unknown>;
  const incomingTopics = Array.isArray(updateRecord.topics)
    ? updateRecord.topics.flatMap((topic) => {
        const normalized = toLiveMemoryTopic(topic as LiveMemoryTopicUpdate);

        return normalized ? [normalized] : [];
      })
    : [];

  const nextContext: LiveMemoryContext = {
    topics: applyTopicsByExactId({
      previousTopics: previousContext?.topics ?? [],
      incomingTopics
    }),
    lastUserVerbatim: firstNonEmptyString([
      nullableString(updateRecord.lastUserVerbatim),
      previousContext?.lastUserVerbatim
    ]),
    lastBotVerbatim: resolveLastBotVerbatim({
      previousContext,
      liveMemoryUpdate: input.liveMemoryUpdate,
      deliveryResult: input.deliveryResult
    }),
    userState: input.liveMemoryUpdate.userState
  };

  await writeLiveMemoryContext(input.turnIdentity.conversationKey, nextContext);

  return nextContext;
}

export {
  applyLiveMemoryUpdate,
  applyTopicsByExactId
};

export type {
  ApplyLiveMemoryUpdateDeliveryResult,
  ApplyLiveMemoryUpdateInput
};
