import {
  readLiveMemoryContext,
  writeLiveMemoryContext
} from "../../infrastructure/live-memory/liveMemoryContextStore";
import {
  createEmptyLiveMemoryContextOptimized,
  createEmptyLiveMemoryTopicOptimized
} from "../../infrastructure/live-memory/liveMemoryDefaults";
import {
  getNextLiveMemoryTopicId,
  parseLiveMemoryTopicId
} from "../../infrastructure/live-memory/normalizeLiveMemoryTopicId";

import type {
  LiveMemoryContextOptimized,
  LiveMemoryTopicOptimized
} from "../../infrastructure/live-memory/liveMemoryContextOptimized.template";

type ApplyLiveMemoryPatchDeliveryResult = {
  status: "sent" | "failed" | "partial";
  deliveredMessages?: Array<{
    content: string;
  }>;
};

type ApplyLiveMemoryPatchInput = {
  conversationKey: string;
  patches: unknown[];
  deliveryResult?: ApplyLiveMemoryPatchDeliveryResult;
};

type LiveMemoryContextPatch = {
  handover?: LiveMemoryContextOptimized["handover"] | null;
  previousConversationTurn?: LiveMemoryContextOptimized["previousConversationTurn"] | null;
  failedPipelineMessages?: LiveMemoryContextOptimized["failedPipelineMessages"] | null;
  securityAlerts?: LiveMemoryContextOptimized["securityAlerts"] | null;
  userState?: {
    status: null | string;
    flags: string[];
  } | null;
  topics?: LiveMemoryTopicPatch[] | null;
};

type LiveMemoryTopicPatch = {
  status: LiveMemoryTopicOptimized["status"];
  sourceAnalyzeSupportText: LiveMemoryTopicOptimized["sourceAnalyzeSupportText"];
  sourceProposeTopicUpdates: Omit<
    LiveMemoryTopicOptimized["sourceProposeTopicUpdates"],
    "topicId"
  > & {
    topicId: number | null;
  };
  sourceTopicManager: LiveMemoryTopicOptimized["sourceTopicManager"];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compactString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : null;
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const normalized = compactString(value);

    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    output.push(normalized);
  }

  return output;
}

function isLiveMemoryContextPatch(value: unknown): value is LiveMemoryContextPatch {
  return isRecord(value);
}

function isLiveMemoryTopicPatch(value: unknown): value is LiveMemoryTopicPatch {
  return isRecord(value) &&
    isRecord(value.sourceAnalyzeSupportText) &&
    isRecord(value.sourceProposeTopicUpdates) &&
    isRecord(value.sourceTopicManager);
}

function normalizePatches(patches: unknown[]): LiveMemoryContextPatch[] {
  return patches.filter(isLiveMemoryContextPatch);
}

function shouldUseDeliveredBotMessage(
  deliveryResult: ApplyLiveMemoryPatchDeliveryResult | undefined
): boolean {
  return deliveryResult?.status === "sent" ||
    (
      deliveryResult?.status === "partial" &&
      (deliveryResult.deliveredMessages?.length ?? 0) > 0
    );
}

function getDeliveredBotMessage(
  deliveryResult: ApplyLiveMemoryPatchDeliveryResult | undefined
): string | null {
  if (!shouldUseDeliveredBotMessage(deliveryResult)) {
    return null;
  }

  const message = deliveryResult?.deliveredMessages
    ?.map((item) => item.content.trim())
    .filter((content) => content !== "")
    .join("\n\n") ?? "";

  return message === "" ? null : message;
}

function mergeNullableString(params: {
  previous: string | null;
  incoming: string | null | undefined;
}): string | null {
  return compactString(params.incoming) ?? params.previous;
}

function mergeCaseDetailsExtracted(params: {
  previous: LiveMemoryTopicOptimized["sourceAnalyzeSupportText"]["caseDetailsExtracted"];
  incoming: LiveMemoryTopicOptimized["sourceAnalyzeSupportText"]["caseDetailsExtracted"];
}): LiveMemoryTopicOptimized["sourceAnalyzeSupportText"]["caseDetailsExtracted"] {
  const bySignature = new Map<
    string,
    LiveMemoryTopicOptimized["sourceAnalyzeSupportText"]["caseDetailsExtracted"][number]
  >();

  for (const detail of [...params.previous, ...params.incoming]) {
    bySignature.set(JSON.stringify([
      detail.key,
      detail.value,
      detail.evidence,
      detail.status
    ]), detail);
  }

  return [...bySignature.values()];
}

function mergeAttemptedActionsExtracted(params: {
  previous: LiveMemoryTopicOptimized["sourceAnalyzeSupportText"]["attemptedActionsExtracted"];
  incoming: LiveMemoryTopicOptimized["sourceAnalyzeSupportText"]["attemptedActionsExtracted"];
}): LiveMemoryTopicOptimized["sourceAnalyzeSupportText"]["attemptedActionsExtracted"] {
  const bySignature = new Map<
    string,
    LiveMemoryTopicOptimized["sourceAnalyzeSupportText"]["attemptedActionsExtracted"][number]
  >();

  for (const action of [...params.previous, ...params.incoming]) {
    bySignature.set(JSON.stringify([
      action.action,
      action.outcome,
      action.evidence,
      action.status
    ]), action);
  }

  return [...bySignature.values()];
}

function getTopicId(topic: LiveMemoryTopicOptimized): number {
  return topic.sourceProposeTopicUpdates.topicId;
}

function findTopicById(
  topics: LiveMemoryTopicOptimized[],
  topicId: number
): LiveMemoryTopicOptimized | null {
  return topics.find((topic) => {
    return getTopicId(topic) === topicId;
  }) ?? null;
}

function buildTopicFromPatch(params: {
  patch: LiveMemoryTopicPatch;
  previousTopic: LiveMemoryTopicOptimized | null;
  topicId: number;
}): LiveMemoryTopicOptimized {
  const previousTopic =
    params.previousTopic ?? createEmptyLiveMemoryTopicOptimized(params.topicId);

  return {
    status: params.patch.status ?? previousTopic.status,

    sourceAnalyzeSupportText: {
      caseDetailsExtracted: mergeCaseDetailsExtracted({
        previous: previousTopic.sourceAnalyzeSupportText.caseDetailsExtracted,
        incoming: params.patch.sourceAnalyzeSupportText.caseDetailsExtracted
      }),
      attemptedActionsExtracted: mergeAttemptedActionsExtracted({
        previous: previousTopic.sourceAnalyzeSupportText.attemptedActionsExtracted,
        incoming: params.patch.sourceAnalyzeSupportText.attemptedActionsExtracted
      })
    },

    sourceProposeTopicUpdates: {
      topicId: params.topicId,
      title: mergeNullableString({
        previous: previousTopic.sourceProposeTopicUpdates.title,
        incoming: params.patch.sourceProposeTopicUpdates.title
      }),
      summaryTopic: mergeNullableString({
        previous: previousTopic.sourceProposeTopicUpdates.summaryTopic,
        incoming: params.patch.sourceProposeTopicUpdates.summaryTopic
      }),
      supportDomain: {
        value: mergeNullableString({
          previous: previousTopic.sourceProposeTopicUpdates.supportDomain.value,
          incoming: params.patch.sourceProposeTopicUpdates.supportDomain.value
        }),
        reason: mergeNullableString({
          previous: previousTopic.sourceProposeTopicUpdates.supportDomain.reason,
          incoming: params.patch.sourceProposeTopicUpdates.supportDomain.reason
        })
      }
    },

    sourceTopicManager: params.patch.sourceTopicManager
  };
}

function applyTopicPatches(params: {
  previousTopics: LiveMemoryTopicOptimized[];
  topicPatches: LiveMemoryTopicPatch[] | null | undefined;
}): LiveMemoryTopicOptimized[] {
  if (!params.topicPatches || params.topicPatches.length === 0) {
    return params.previousTopics;
  }

  const topicsById = new Map<number, LiveMemoryTopicOptimized>();

  for (const topic of params.previousTopics) {
    topicsById.set(getTopicId(topic), topic);
  }

  let nextTopicId = getNextLiveMemoryTopicId(params.previousTopics);

  for (const incomingTopicPatch of params.topicPatches) {
    if (!isLiveMemoryTopicPatch(incomingTopicPatch)) {
      continue;
    }

    const parsedTopicId = parseLiveMemoryTopicId(
      incomingTopicPatch.sourceProposeTopicUpdates.topicId
    );
    const topicId = parsedTopicId ?? nextTopicId++;
    const previousTopic = findTopicById(params.previousTopics, topicId);

    topicsById.set(topicId, buildTopicFromPatch({
      patch: incomingTopicPatch,
      previousTopic,
      topicId
    }));
  }

  return [...topicsById.values()].sort((first, second) => {
    return getTopicId(first) - getTopicId(second);
  });
}

function mergeGlobalPatch(params: {
  previousContext: LiveMemoryContextOptimized;
  patch: LiveMemoryContextPatch;
  deliveryResult?: ApplyLiveMemoryPatchDeliveryResult;
}): LiveMemoryContextOptimized {
  const deliveredBotMessage = getDeliveredBotMessage(params.deliveryResult);

  return {
    ...params.previousContext,

    handover: params.patch.handover ?? params.previousContext.handover,

    previousConversationTurn: params.patch.previousConversationTurn
      ? {
          previousUserMessage:
            params.patch.previousConversationTurn.previousUserMessage ??
            params.previousContext.previousConversationTurn.previousUserMessage,
          previousBotMessage:
            deliveredBotMessage ??
            params.patch.previousConversationTurn.previousBotMessage ??
            params.previousContext.previousConversationTurn.previousBotMessage
        }
      : {
          ...params.previousContext.previousConversationTurn,
          previousBotMessage:
            deliveredBotMessage ??
            params.previousContext.previousConversationTurn.previousBotMessage
        },

    failedPipelineMessages: params.patch.failedPipelineMessages
      ? [
          ...params.previousContext.failedPipelineMessages,
          ...params.patch.failedPipelineMessages
        ]
      : params.previousContext.failedPipelineMessages,

    securityAlerts: params.patch.securityAlerts
      ? [
          ...params.previousContext.securityAlerts,
          ...params.patch.securityAlerts
        ]
      : params.previousContext.securityAlerts,

    userState: params.patch.userState
      ? {
          status:
            compactString(params.patch.userState.status) ??
            params.previousContext.userState.status,
          flags: uniqueStrings([
            ...params.previousContext.userState.flags,
            ...params.patch.userState.flags
          ])
        }
      : params.previousContext.userState
  };
}

function applyOnePatch(params: {
  previousContext: LiveMemoryContextOptimized;
  patch: LiveMemoryContextPatch;
  deliveryResult?: ApplyLiveMemoryPatchDeliveryResult;
}): LiveMemoryContextOptimized {
  const contextWithGlobalPatch = mergeGlobalPatch(params);
  const previousTopics = contextWithGlobalPatch.topics ?? [];
  const topics = applyTopicPatches({
    previousTopics,
    topicPatches: params.patch.topics
  });

  return {
    ...contextWithGlobalPatch,
    topics: topics.length > 0 ? topics : null
  };
}

async function applyLiveMemoryPatch(
  input: ApplyLiveMemoryPatchInput
): Promise<LiveMemoryContextOptimized> {
  const previousContext =
    await readLiveMemoryContext(input.conversationKey) ??
    createEmptyLiveMemoryContextOptimized();

  const updatedContext = normalizePatches(input.patches).reduce<LiveMemoryContextOptimized>(
    (currentContext, patch) => {
      return applyOnePatch({
        previousContext: currentContext,
        patch,
        deliveryResult: input.deliveryResult
      });
    },
    previousContext
  );

  await writeLiveMemoryContext(input.conversationKey, updatedContext);

  return updatedContext;
}

export {
  applyLiveMemoryPatch
};

export type {
  ApplyLiveMemoryPatchDeliveryResult,
  ApplyLiveMemoryPatchInput,
  LiveMemoryContextPatch,
  LiveMemoryTopicPatch
};
