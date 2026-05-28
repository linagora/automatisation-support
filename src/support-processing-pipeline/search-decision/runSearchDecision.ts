import type {
  SearchDecisionInput,
  SearchDecisionOutput
} from "../typesSupportProcessingPipeline.types";

const SEARCH_DECISION_STRICTNESS = 2;

type TopicCategory =
  | "billing"
  | "access_security"
  | "bug"
  | "request"
  | "question_faq"
  | "other";

type RequiredFieldsByCategory = Record<TopicCategory, string[]>;

const REQUIRED_FIELDS_BY_STRICTNESS: Record<
  1 | 2 | 3,
  RequiredFieldsByCategory
> = {
  1: {
    bug: ["observed_result", "trigger_action"],
    access_security: ["access_action", "observed_result"],
    billing: ["billing_issue_type", "observed_result"],
    request: ["gap_observed"],
    question_faq: ["question_intent"],
    other: ["additional_context"]
  },
  2: {
    bug: ["observed_result", "expected_result", "trigger_action", "platform"],
    access_security: [
      "access_action",
      "auth_method",
      "observed_result",
      "expected_result"
    ],
    billing: [
      "billing_issue_type",
      "billing_provider",
      "observed_result",
      "amount",
      "currency",
      "billing_date_or_period"
    ],
    request: ["gap_observed", "feature_or_page", "additional_context"],
    question_faq: ["question_intent", "feature_or_page"],
    other: ["additional_context"]
  },
  3: {
    bug: [
      "feature_or_page",
      "observed_result",
      "expected_result",
      "trigger_action",
      "platform",
      "os",
      "frequency",
      "affected_scope"
    ],
    access_security: [
      "access_action",
      "auth_method",
      "observed_result",
      "expected_result",
      "platform",
      "account_context"
    ],
    billing: [
      "billing_issue_type",
      "billing_provider",
      "offer_or_plan",
      "amount",
      "currency",
      "billing_date_or_period",
      "observed_result"
    ],
    request: [
      "gap_observed",
      "feature_or_page",
      "affected_scope",
      "additional_context"
    ],
    question_faq: ["question_intent", "feature_or_page", "additional_context"],
    other: ["additional_context", "observed_result"]
  }
};

function isTopicCategory(value: unknown): value is TopicCategory {
  return (
    value === "billing" ||
    value === "access_security" ||
    value === "bug" ||
    value === "request" ||
    value === "question_faq" ||
    value === "other"
  );
}

function isFilledField(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === "string") {
    return value.trim() !== "";
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return true;
}

function getMissingFields(params: {
  topicCategory: TopicCategory;
  topicDetails: Record<string, unknown> | undefined;
}): string[] {
  const requiredFields =
    REQUIRED_FIELDS_BY_STRICTNESS[SEARCH_DECISION_STRICTNESS][
      params.topicCategory
    ];

  return requiredFields.filter((fieldName) => {
    return !isFilledField(params.topicDetails?.[fieldName]);
  });
}

async function runSearchDecision(
  input: SearchDecisionInput
): Promise<SearchDecisionOutput> {
  const topicDecisions = input.turnUnderstandingDelta.segments_topic.map(
    (topic) => {
      const topicCategory = isTopicCategory(topic.topic_category)
        ? topic.topic_category
        : "other";
      const topicDetails =
        typeof topic.topic_details === "object" &&
        topic.topic_details !== null
          ? topic.topic_details
          : undefined;
      const missingFields = getMissingFields({
        topicCategory,
        topicDetails
      });

      return {
        topic_id: topic.id_topic,
        type:
          missingFields.length > 0
            ? "ask_more_info"
            : "acknowledgement",
        missing_fields: missingFields
      } as const;
    }
  );

  return {
    decision: {
      route: "continue",
      topics: topicDecisions
    },
    detected: {
      topicsQualificationResult:
        topicDecisions.length > 0 ? "not_evaluated" : "no_topic",
      solutionLikelihoodResult: "not_evaluated"
    },
    history: {
      checked: [
        "turn_understanding_delta_received",
        "topics_presence_checked",
        "forced_acknowledgement_mode"
      ],
      failed: []
    }
  } as SearchDecisionOutput;
}

export {
  runSearchDecision
};
