import type {
  SupportAutomationTurnV2Result
} from "../../support-automation/runSupportAutomationPipelineV2";
import type {
  MatrixDeliveryResult
} from "../../infrastructure/matrix/typesMatrixChannel.types";
import type {
  DeliveryMessage
} from "../orchestration/typesOrchestration.types";
import type {
  LiveMemoryContext,
  LiveMemoryTopic,
  LiveMemoryUserState
} from "../../infrastructure/live-memory/typesLiveMemoryContext.types";
import {
  parseLiveMemoryTopicId
} from "../../infrastructure/live-memory/normalizeLiveMemoryTopicId";
import {
  topicSnapshotsToLiveMemoryTopics
} from "../../support-automation/support-processing-pipeline-v2/build-persistence-effects/buildSupportProcessingPersistenceEffectsV2";
import {
  normalizeSupportKnowledgeSummary
} from "../../support-automation/support-processing-pipeline-v2/supportKnowledgeSummary";
import type {
  LiveMemoryTopicUpdate
} from "../../support-automation/support-processing-pipeline-v2/typesSupportProcessingPipelineV2.types";

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

function firstNonEmpty(values: Array<string | undefined>): string | null {
  const value = values.find((candidate) => {
    return typeof candidate === "string" && candidate.trim() !== "";
  });

  return value ?? null;
}

function toLiveMemoryTopic(update: LiveMemoryTopicUpdate): LiveMemoryTopic | null {
  const record = update as unknown as Record<string, unknown>;
  const topicId = parseLiveMemoryTopicId(record.topicId);

  if (topicId === null) {
    return null;
  }

  return {
    topicId,
    title: typeof record.title === "string" && record.title.trim() !== ""
      ? record.title
      : null,
    broadCategoryHint:
      typeof record.broadCategoryHint === "string" && record.broadCategoryHint.trim() !== ""
        ? record.broadCategoryHint
        : null,
    summary: typeof record.summary === "string" && record.summary.trim() !== ""
      ? record.summary
      : null,
    caseDetails: Array.isArray(record.caseDetails)
      ? record.caseDetails as LiveMemoryTopic["caseDetails"]
      : [],
    attemptedActions: Array.isArray(record.attemptedActions)
      ? record.attemptedActions as LiveMemoryTopic["attemptedActions"]
      : [],
    ...(normalizeSupportKnowledgeSummary(record.supportKnowledgeSummary)
      ? {
          supportKnowledgeSummary: normalizeSupportKnowledgeSummary(
            record.supportKnowledgeSummary
          ) as LiveMemoryTopic["supportKnowledgeSummary"]
        }
      : {})
  };
}

function overlayTopicsByExactId(params: {
  previousTopics: LiveMemoryTopic[];
  incomingTopics: LiveMemoryTopic[];
}): LiveMemoryTopic[] {
  const topicsById = new Map<number, LiveMemoryTopic>();

  for (const topic of params.previousTopics) {
    topicsById.set(topic.topicId, topic);
  }

  for (const topic of params.incomingTopics) {
    topicsById.set(topic.topicId, topic);
  }

  return [...topicsById.values()].sort((first, second) => first.topicId - second.topicId);
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

/**
 * Legacy compatibility helper.
 *
 * Matrix V2 should not use this path anymore. The official write path is:
 * persistenceEffects.liveMemoryUpdate -> applyLiveMemoryUpdate.
 * This function is kept only so older imports/tests still compile, and it uses
 * the same exact-id overlay semantics as applyLiveMemoryUpdate.
 */
function buildLiveMemoryContextFromTurn(
  input: BuildLiveMemoryContextFromTurnInput
): LiveMemoryContext {
  const incomingTopics = topicSnapshotsToLiveMemoryTopics(
    input.supportAutomationTurnResult.supportProcessingOutput
      .mergedTopicSnapshots ?? []
  ).flatMap((topic) => {
    const normalized = toLiveMemoryTopic(topic);

    return normalized ? [normalized] : [];
  });

  return {
    topics: overlayTopicsByExactId({
      previousTopics: input.previousContext?.topics ?? [],
      incomingTopics
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
  overlayTopicsByExactId,
  parseLiveMemoryTopicId as normalizeLiveMemoryTopicId
};

export type {
  BuildLiveMemoryContextFromTurnInput
};
