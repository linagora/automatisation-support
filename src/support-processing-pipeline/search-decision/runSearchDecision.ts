import type {
  SearchDecisionInput,
  SearchDecisionOutput
} from "../typesSupportProcessingPipeline.types";

const SEARCH_DECISION_STRICTNESS = 2;

const RAG_ELIGIBLE_TOPIC_CATEGORIES = [
  "bug",
  "question_faq",
  "access_security"
] as const;

const MAX_FAILED_RAG_SOLUTION_ATTEMPTS_BEFORE_HANDOVER = 2;

const HANDOVER_SIGNAL_TYPES = [
  "handover_request"
] as const;

const FAILED_RAG_OUTCOMES = [
  "failed",
  "partially_worked"
] as const;

type TopicCategory =
  | "billing"
  | "access_security"
  | "bug"
  | "request"
  | "question_faq"
  | "other";

type RequiredFieldsByCategory = Record<TopicCategory, string[]>;

type TopicDecision = SearchDecisionOutput["decision"]["topics"][number];

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

function isRagEligibleTopicCategory(topicCategory: TopicCategory): boolean {
  return RAG_ELIGIBLE_TOPIC_CATEGORIES.includes(
    topicCategory as (typeof RAG_ELIGIBLE_TOPIC_CATEGORIES)[number]
  );
}

function hasStringInList(value: unknown, expectedValues: string[]): boolean {
  if (!Array.isArray(value)) {
    return false;
  }

  return value.some((item) => {
    return typeof item === "string" && expectedValues.includes(item);
  });
}

function hasExplicitHandoverRequest(input: SearchDecisionInput): boolean {
  return input.turnUnderstandingDelta.segments_signal.some((signalSegment) => {
    return hasStringInList(signalSegment.signal_types, [
      ...HANDOVER_SIGNAL_TYPES
    ]);
  });
}

function hasProposedSolutionForTopic(
  responsePlan: unknown,
  topicId: number
): boolean {
  if (typeof responsePlan !== "object" || responsePlan === null) {
    return false;
  }

  const messagesPlan = (responsePlan as Record<string, unknown>).messagesPlan;

  if (typeof messagesPlan !== "object" || messagesPlan === null) {
    return false;
  }

  const topicPlanMessages = (messagesPlan as Record<string, unknown>)
    .topicPlanMessages;

  if (!Array.isArray(topicPlanMessages)) {
    return false;
  }

  return topicPlanMessages.some((topicPlanMessage) => {
    if (typeof topicPlanMessage !== "object" || topicPlanMessage === null) {
      return false;
    }

    const topicsResponses = (topicPlanMessage as Record<string, unknown>)
      .topics_responses;

    if (!Array.isArray(topicsResponses)) {
      return false;
    }

    return topicsResponses.some((topicResponseWrapper) => {
      if (
        typeof topicResponseWrapper !== "object" ||
        topicResponseWrapper === null
      ) {
        return false;
      }

      const topicResponse = (
        topicResponseWrapper as Record<string, unknown>
      ).topic_response;

      if (typeof topicResponse !== "object" || topicResponse === null) {
        return false;
      }

      const topicResponseRecord = topicResponse as Record<string, unknown>;
      const title = topicResponseRecord.title;
      const mainResponse = topicResponseRecord.main_response;

      return (
        typeof title === "object" &&
        title !== null &&
        (title as Record<string, unknown>).topic_id === topicId &&
        typeof mainResponse === "object" &&
        mainResponse !== null &&
        (mainResponse as Record<string, unknown>).type === "propose_solution"
      );
    });
  });
}

function hasFailedTestedSolutionForTopic(
  turnUnderstandingDelta: unknown,
  topicId: number
): boolean {
  if (
    typeof turnUnderstandingDelta !== "object" ||
    turnUnderstandingDelta === null
  ) {
    return false;
  }

  const segmentsTopic = (turnUnderstandingDelta as Record<string, unknown>)
    .segments_topic;

  if (!Array.isArray(segmentsTopic)) {
    return false;
  }

  return segmentsTopic.some((topicSegment) => {
    if (typeof topicSegment !== "object" || topicSegment === null) {
      return false;
    }

    const topicSegmentRecord = topicSegment as Record<string, unknown>;

    if (topicSegmentRecord.id_topic !== topicId) {
      return false;
    }

    const testedSolutions = topicSegmentRecord.tested_solutions;

    if (!Array.isArray(testedSolutions)) {
      return false;
    }

    return testedSolutions.some((testedSolution) => {
      if (typeof testedSolution !== "object" || testedSolution === null) {
        return false;
      }

      return hasStringInList(
        [(testedSolution as Record<string, unknown>).outcome],
        [...FAILED_RAG_OUTCOMES]
      );
    });
  });
}

function hasTooManyFailedRagAttemptsForTopic(
  input: SearchDecisionInput,
  topicId: number
): boolean {
  const conversationHistory = input.conversationHistory ?? [];
  let proposedSolutionCount = 0;
  let failedRagAttemptCount = 0;

  for (const conversationEvent of conversationHistory) {
    if (
      conversationEvent.role === "bot" &&
      hasProposedSolutionForTopic(conversationEvent.responsePlan, topicId)
    ) {
      proposedSolutionCount += 1;
      continue;
    }

    // Expected shape: a user event after a bot propose_solution can contain
    // turnUnderstandingDelta.segments_topic[].tested_solutions[].outcome.
    if (
      proposedSolutionCount > failedRagAttemptCount &&
      conversationEvent.role === "user" &&
      hasFailedTestedSolutionForTopic(
        conversationEvent.turnUnderstandingDelta,
        topicId
      )
    ) {
      failedRagAttemptCount += 1;
    }
  }

  return (
    failedRagAttemptCount >= MAX_FAILED_RAG_SOLUTION_ATTEMPTS_BEFORE_HANDOVER
  );
}

function isUserLikelyNotHelpedByBot(input: SearchDecisionInput): boolean {
  return input.accountInteractionTraits?.likelyToBeHelpedByBot === false;
}

function shouldAvoidRagBecauseOfHumanSupportContext(params: {
  input: SearchDecisionInput;
  topicId: number;
}): boolean {
  return (
    hasExplicitHandoverRequest(params.input) ||
    hasTooManyFailedRagAttemptsForTopic(params.input, params.topicId) ||
    isUserLikelyNotHelpedByBot(params.input)
  );
}

function shouldSearchSolution(params: {
  input: SearchDecisionInput;
  topicId: number;
  topicCategory: TopicCategory;
}): boolean {
  if (!isRagEligibleTopicCategory(params.topicCategory)) {
    return false;
  }

  return !shouldAvoidRagBecauseOfHumanSupportContext({
    input: params.input,
    topicId: params.topicId
  });
}

async function runSearchDecision(
  input: SearchDecisionInput
): Promise<SearchDecisionOutput> {
  const topicDecisions = input.turnUnderstandingDelta.segments_topic.map(
    (topic): TopicDecision => {
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

      if (missingFields.length > 0) {
        return {
          topic_id: topic.id_topic,
          type: "ask_more_info",
          missing_fields: missingFields
        };
      }

      return {
        topic_id: topic.id_topic,
        type: shouldSearchSolution({
          input,
          topicId: topic.id_topic,
          topicCategory
        })
          ? "solution_searching"
          : "acknowledgement",
        missing_fields: []
      };
    }
  );
  const hasSolutionSearchingTopic = topicDecisions.some((topicDecision) => {
    return topicDecision.type === "solution_searching";
  });

  return {
    decision: {
      route: "continue",
      topics: topicDecisions
    },
    detected: {
      topicsQualificationResult:
        topicDecisions.length > 0 ? "evaluated" : "no_topic",
      solutionLikelihoodResult:
        topicDecisions.length === 0
          ? "no_topic"
          : hasSolutionSearchingTopic
            ? "rag_relevant"
            : "rag_not_relevant"
    },
    history: {
      checked: [
        "turn_understanding_delta_received",
        "topics_presence_checked",
        "topic_required_fields_checked",
        "rag_eligible_categories_checked",
        "rag_helpfulness_context_checked"
      ],
      failed: []
    }
  };
}

export {
  runSearchDecision
};
