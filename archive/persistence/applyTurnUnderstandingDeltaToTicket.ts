import type {
  JsonTicket
} from "../repositories/json/typesJsonRepositories.types";
import type {
  SupportTopicKnowledge,
  TurnUnderstandingDelta
} from "../support-processing-pipeline/typesSupportProcessingPipeline.types";

type ExistingTopic = SupportTopicKnowledge["segments_topic"][number];
type TopicDelta = TurnUnderstandingDelta["segments_topic"][number];
type TopicDetails = ExistingTopic["topic_details"];
type TestedAction = NonNullable<ExistingTopic["tested_actions"]>[number];

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function isSameTestedAction(
  first: TestedAction,
  second: TestedAction
): boolean {
  return (
    first.tested_action === second.tested_action &&
    first.outcome_tested_action === second.outcome_tested_action
  );
}

function mergeTestedActions(
  existingActions: TestedAction[] | undefined,
  deltaActions: TestedAction[] | undefined
): TestedAction[] | undefined {
  const mergedActions = [...(existingActions ?? [])];

  for (const deltaAction of deltaActions ?? []) {
    const alreadyExists = mergedActions.some((existingAction) => {
      return isSameTestedAction(existingAction, deltaAction);
    });

    if (!alreadyExists) {
      mergedActions.push(deltaAction);
    }
  }

  return mergedActions.length > 0 ? mergedActions : undefined;
}

function mergeSegmentVerbatims(
  existingVerbatims: string[] | undefined,
  deltaVerbatims: string[] | undefined
): string[] | undefined {
  const mergedVerbatims = uniqueStrings([
    ...(existingVerbatims ?? []),
    ...(deltaVerbatims ?? [])
  ]);

  return mergedVerbatims.length > 0 ? mergedVerbatims : undefined;
}

function topicDeltaToNewTopic(topicDelta: TopicDelta): ExistingTopic | undefined {
  if (topicDelta.matched_historical_topic !== "no") {
    return undefined;
  }

  return {
    id_topic: topicDelta.id_topic,
    topic_category: topicDelta.topic_category,
    ...(topicDelta.tool_or_product
      ? { tool_or_product: topicDelta.tool_or_product }
      : {}),
    ...(topicDelta.topic_action ? { topic_action: topicDelta.topic_action } : {}),
    ...(topicDelta.topic_object ? { topic_object: topicDelta.topic_object } : {}),
    ...(topicDelta.topic_label ? { topic_label: topicDelta.topic_label } : {}),
    ...(topicDelta.linkedKnowledgeIds
      ? { linkedKnowledgeIds: topicDelta.linkedKnowledgeIds }
      : {}),
    ...(topicDelta.segment_verbatims
      ? { segment_verbatims: topicDelta.segment_verbatims }
      : {}),
    topic_details: topicDelta.topic_details,
    ...(topicDelta.tested_actions
      ? { tested_actions: topicDelta.tested_actions }
      : {}),
    user_goal: topicDelta.user_goal,
    blocking_issue: topicDelta.blocking_issue
  };
}

function mergeExistingTopicWithDelta(
  existingTopic: ExistingTopic,
  topicDelta: TopicDelta
): ExistingTopic {
  const topicDetails: TopicDetails = {
    ...existingTopic.topic_details,
    ...(topicDelta.topic_details ?? {})
  };
  const testedActions = mergeTestedActions(
    existingTopic.tested_actions,
    topicDelta.tested_actions
  );
  const segmentVerbatims = mergeSegmentVerbatims(
    existingTopic.segment_verbatims,
    topicDelta.segment_verbatims
  );
  const linkedKnowledgeIds = uniqueStrings([
    ...(existingTopic.linkedKnowledgeIds ?? []),
    ...(topicDelta.linkedKnowledgeIds ?? [])
  ]);

  return {
    ...existingTopic,
    ...(topicDelta.topic_category
      ? { topic_category: topicDelta.topic_category }
      : {}),
    ...(topicDelta.tool_or_product
      ? { tool_or_product: topicDelta.tool_or_product }
      : {}),
    ...(topicDelta.topic_action ? { topic_action: topicDelta.topic_action } : {}),
    ...(topicDelta.topic_object ? { topic_object: topicDelta.topic_object } : {}),
    ...(topicDelta.topic_label ? { topic_label: topicDelta.topic_label } : {}),
    ...(linkedKnowledgeIds.length > 0 ? { linkedKnowledgeIds } : {}),
    topic_details: topicDetails,
    ...(testedActions ? { tested_actions: testedActions } : {}),
    ...(segmentVerbatims ? { segment_verbatims: segmentVerbatims } : {}),
    ...(topicDelta.user_goal ? { user_goal: topicDelta.user_goal } : {}),
    ...(topicDelta.blocking_issue
      ? { blocking_issue: topicDelta.blocking_issue }
      : {})
  };
}

function applyTurnUnderstandingDeltaToTicket(params: {
  ticket: JsonTicket;
  turnUnderstandingDelta: TurnUnderstandingDelta;
  generatedAt: string;
}): JsonTicket {
  const topics = [...params.ticket.supportTopicKnowledge.segments_topic];
  const unmatchedHistoricalTopicDeltas: TopicDelta[] = [];

  for (const topicDelta of params.turnUnderstandingDelta.segments_topic) {
    if (topicDelta.matched_historical_topic === "no") {
      const newTopic = topicDeltaToNewTopic(topicDelta);

      if (newTopic !== undefined) {
        topics.push(newTopic);
      }
      continue;
    }

    const existingTopicIndex = topics.findIndex((topic) => {
      return topic.id_topic === topicDelta.id_topic;
    });

    if (existingTopicIndex === -1) {
      unmatchedHistoricalTopicDeltas.push(topicDelta);
      continue;
    }

    topics[existingTopicIndex] = mergeExistingTopicWithDelta(
      topics[existingTopicIndex],
      topicDelta
    );
  }

  return {
    ...params.ticket,
    supportTopicKnowledge: {
      segments_topic: topics
    },
    metadata: {
      ...params.ticket.metadata,
      ...(unmatchedHistoricalTopicDeltas.length > 0
        ? { unmatchedHistoricalTopicDeltas }
        : {}),
      lastPatchGeneratedAt: params.generatedAt,
      ...(params.turnUnderstandingDelta.user_language
        ? { lastUserLanguage: params.turnUnderstandingDelta.user_language }
        : {})
    },
    updatedAt: params.generatedAt
  };
}

export {
  applyTurnUnderstandingDeltaToTicket
};
