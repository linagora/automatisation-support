import type {
  BroadCategoryHint
} from "../../support-processing-pipeline-v2/typesSupportProcessingPipelineV2.types";
import type {
  LiveMemoryContext,
  LiveMemoryTopic
} from "./typesLiveMemoryContext.types";
import type {
  SupportTopicKnowledge
} from "../../support-processing-pipeline/typesSupportProcessingPipeline.types";
import {
  normalizeLiveMemoryTopicId
} from "./normalizeLiveMemoryTopicId";

type TopicCategory =
  SupportTopicKnowledge["segments_topic"][number]["topic_category"];
type TopicDetails =
  SupportTopicKnowledge["segments_topic"][number]["topic_details"];
type OutcomeTestedAction =
  NonNullable<
    SupportTopicKnowledge["segments_topic"][number]["tested_actions"]
  >[number]["outcome_tested_action"];

const CATEGORY_MAP: Partial<Record<BroadCategoryHint, TopicCategory>> = {
  access_security: "access_security",
  accessibility: "bug",
  availability: "bug",
  billing: "billing",
  bug: "bug",
  configuration: "request",
  data_migration: "request",
  feature_request: "request",
  integration_sync: "bug",
  other: "other",
  performance: "bug",
  product_feedback: "request",
  question_faq: "question_faq",
  support_action: "request",
  support_experience_issue: "other"
};

function toTopicCategory(value: string | null): TopicCategory {
  if (value && value in CATEGORY_MAP) {
    return CATEGORY_MAP[value as BroadCategoryHint] ?? "other";
  }

  return "other";
}

function stableNumericTopicId(topicId: string): number {
  let hash = 0;

  for (const character of topicId) {
    hash = (hash * 31 + character.charCodeAt(0)) % 900000;
  }

  return 100000 + hash;
}

function parseTopicId(topicId: string): number {
  const normalizedTopicId = normalizeLiveMemoryTopicId(topicId) ?? topicId;
  const match = normalizedTopicId.match(/\d+/);

  if (!match) {
    return stableNumericTopicId(normalizedTopicId);
  }

  const parsed = Number(match[0]);

  return Number.isFinite(parsed) ? parsed : stableNumericTopicId(normalizedTopicId);
}

function allocateTopicIds(topics: LiveMemoryTopic[]): number[] {
  const usedIds = new Set<number>();
  const parsedIds = topics.map((topic) => {
    const parsedId = parseTopicId(topic.topicId);

    if (usedIds.has(parsedId)) {
      return null;
    }

    usedIds.add(parsedId);

    return parsedId;
  });
  let nextGeneratedId = 1;

  return parsedIds.map((parsedId) => {
    if (parsedId !== null) {
      return parsedId;
    }

    while (usedIds.has(nextGeneratedId)) {
      nextGeneratedId += 1;
    }

    const generatedId = nextGeneratedId;

    usedIds.add(generatedId);
    nextGeneratedId += 1;

    return generatedId;
  });
}

function toTopicDetails(topic: LiveMemoryTopic): TopicDetails {
  const topicDetails: TopicDetails = {};

  for (const detail of topic.caseDetails) {
    const value = detail.value === null ? "" : String(detail.value);

    if (detail.key.trim() === "" || value.trim() === "") {
      continue;
    }

    topicDetails[detail.key as keyof TopicDetails] = value as never;
  }

  return topicDetails;
}

function toOutcomeTestedAction(
  outcome: LiveMemoryTopic["attemptedActions"][number]["outcome"]
): OutcomeTestedAction {
  if (outcome === "success") {
    return "worked";
  }

  if (outcome === "failed") {
    return "failed";
  }

  if (outcome === "partial") {
    return "partially_worked";
  }

  return "unclear";
}

function toTestedActions(topic: LiveMemoryTopic):
  SupportTopicKnowledge["segments_topic"][number]["tested_actions"] {
  const testedActions = topic.attemptedActions.flatMap((attemptedAction) => {
    if (attemptedAction.action.trim() === "") {
      return [];
    }

    return [
      {
        tested_action: attemptedAction.action,
        outcome_tested_action: toOutcomeTestedAction(attemptedAction.outcome)
      }
    ];
  });

  return testedActions.length > 0 ? testedActions : undefined;
}

function toUserGoal(topic: LiveMemoryTopic): string {
  return topic.summary?.trim() || topic.title?.trim() || "Support topic";
}

function convertLiveMemoryContextToSupportTopicKnowledge(
  liveMemoryContext: LiveMemoryContext
): SupportTopicKnowledge {
  const topicIds = allocateTopicIds(liveMemoryContext.topics);

  return {
    segments_topic: liveMemoryContext.topics.map((topic, index) => {
      const testedActions = toTestedActions(topic);

      return {
        id_topic: topicIds[index],
        topic_category: toTopicCategory(topic.broadCategoryHint),
        ...(topic.title?.trim()
          ? {
              topic_label: topic.title.trim()
            }
          : {}),
        topic_details: toTopicDetails(topic),
        ...(testedActions
          ? {
              tested_actions: testedActions
            }
          : {}),
        user_goal: toUserGoal(topic),
        blocking_issue: "no"
      };
    })
  };
}

export {
  convertLiveMemoryContextToSupportTopicKnowledge
};
