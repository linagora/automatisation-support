import {
  readLiveMemoryContext,
  writeLiveMemoryContext
} from "./liveMemoryContextStore";

import type {
  SupportTurnIdentityV2
} from "../../orchestration/v2/buildSupportTurnIdentityV2";
import type {
  LiveMemoryContext,
  LiveMemoryTopic
} from "./typesLiveMemoryContext.types";
import type {
  LiveMemoryAttemptedAction,
  LiveMemoryCaseDetail,
  LiveMemoryContextUpdate,
  LiveMemoryTopicUpdate
} from "../../support-processing-pipeline-v2/typesSupportProcessingPipelineV2.types";

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

function normalizeCaseDetail(
  detail: LiveMemoryCaseDetail
): LiveMemoryTopic["caseDetails"][number] {
  return {
    key: detail.key,
    value: detail.value,
    evidence: detail.evidence ?? ""
  };
}

function normalizeAttemptedAction(
  attemptedAction: LiveMemoryAttemptedAction
): LiveMemoryTopic["attemptedActions"][number] {
  return {
    action: attemptedAction.action,
    outcome: attemptedAction.outcome ?? "unknown",
    evidence: attemptedAction.evidence ?? ""
  };
}

function toLiveMemoryTopic(topic: LiveMemoryTopicUpdate): LiveMemoryTopic {
  return {
    topicId: topic.topicId,
    title: topic.title,
    broadCategoryHint: topic.broadCategoryHint,
    summary: topic.summary,
    caseDetails: topic.caseDetails.map(normalizeCaseDetail),
    attemptedActions: topic.attemptedActions.map(normalizeAttemptedAction)
  };
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

function firstNonEmptyString(values: Array<string | null | undefined>):
  string | null {
  const value = values.find((candidate) => {
    return typeof candidate === "string" && candidate.trim() !== "";
  });

  return value ?? null;
}

function mergeTopic(
  previous: LiveMemoryTopic | undefined,
  incoming: LiveMemoryTopic
): LiveMemoryTopic {
  if (!previous) {
    return incoming;
  }

  return {
    topicId: previous.topicId,
    title: firstNonEmptyString([incoming.title, previous.title]),
    broadCategoryHint: firstNonEmptyString([
      incoming.broadCategoryHint,
      previous.broadCategoryHint
    ]),
    summary: firstNonEmptyString([incoming.summary, previous.summary]),
    caseDetails: mergeCaseDetails(previous.caseDetails, incoming.caseDetails),
    attemptedActions: mergeAttemptedActions(
      previous.attemptedActions,
      incoming.attemptedActions
    )
  };
}

function mergeTopics(params: {
  previousTopics: LiveMemoryTopic[];
  incomingTopics: LiveMemoryTopic[];
}): LiveMemoryTopic[] {
  const topicsById = new Map(params.previousTopics.map((topic) => {
    return [topic.topicId, topic];
  }));

  for (const incomingTopic of params.incomingTopics) {
    topicsById.set(
      incomingTopic.topicId,
      mergeTopic(topicsById.get(incomingTopic.topicId), incomingTopic)
    );
  }

  return [...topicsById.values()];
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

  return firstNonEmptyString([
    deliveredText,
    params.liveMemoryUpdate.lastBotVerbatim,
    params.previousContext?.lastBotVerbatim
  ]);
}

async function applyLiveMemoryUpdate(
  input: ApplyLiveMemoryUpdateInput
): Promise<LiveMemoryContext> {
  const previousContext =
    await readLiveMemoryContext(input.turnIdentity.conversationKey);
  const liveMemoryUpdate = input.liveMemoryUpdate;
  const nextContext: LiveMemoryContext = {
    topics: mergeTopics({
      previousTopics: previousContext?.topics ?? [],
      incomingTopics: liveMemoryUpdate.topics.map(toLiveMemoryTopic)
    }),
    lastUserVerbatim: firstNonEmptyString([
      liveMemoryUpdate.lastUserVerbatim,
      previousContext?.lastUserVerbatim
    ]),
    lastBotVerbatim: resolveLastBotVerbatim({
      previousContext,
      liveMemoryUpdate,
      deliveryResult: input.deliveryResult
    }),
    userState: liveMemoryUpdate.userState
  };

  await writeLiveMemoryContext(input.turnIdentity.conversationKey, nextContext);

  return nextContext;
}

export {
  applyLiveMemoryUpdate
};

export type {
  ApplyLiveMemoryUpdateDeliveryResult,
  ApplyLiveMemoryUpdateInput
};
