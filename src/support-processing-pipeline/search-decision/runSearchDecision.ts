import type {
  SearchDecisionInput,
  SearchDecisionOutput
} from "../typesSupportProcessingPipeline.types";

const SEARCH_DECISION_STRICTNESS = 2;
const MAX_MISSING_FIELDS_TO_ASK = 2;

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
type OptionalEvidenceRequest =
  NonNullable<TopicDecision["optional_evidence_requested"]>;

const BUG_VISUAL_EVIDENCE_REQUEST: OptionalEvidenceRequest = {
  types: ["screenshot", "video"],
  reason: "bug_visual_context_helpful"
};

const MISSING_FIELD_PRIORITY_BY_CATEGORY: RequiredFieldsByCategory = {
  bug: [
    "observed_result",
    "error_message",
    "trigger_action",
    "platform",
    "expected_result"
  ],
  access_security: [
    "observed_result",
    "access_action",
    "auth_method",
    "platform",
    "account_context"
  ],
  billing: [
    "billing_issue_type",
    "observed_result",
    "billing_provider",
    "amount",
    "currency",
    "billing_date_or_period"
  ],
  request: ["gap_observed", "feature_or_page", "additional_context"],
  question_faq: ["question_intent", "feature_or_page", "additional_context"],
  other: ["additional_context", "observed_result"]
};

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
      "platform",
      "account_context"
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

function selectMissingFieldsToAsk(params: {
  topicCategory: TopicCategory;
  missingFields: string[];
}): string[] {
  const priority =
    MISSING_FIELD_PRIORITY_BY_CATEGORY[params.topicCategory] ?? [];
  const sortedMissingFields = [...params.missingFields].sort(
    (leftField, rightField) => {
      const leftPriority = priority.includes(leftField)
        ? priority.indexOf(leftField)
        : Number.MAX_SAFE_INTEGER;
      const rightPriority = priority.includes(rightField)
        ? priority.indexOf(rightField)
        : Number.MAX_SAFE_INTEGER;

      return leftPriority - rightPriority;
    }
  );

  return sortedMissingFields.slice(0, MAX_MISSING_FIELDS_TO_ASK);
}

function getStringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}

function getStringListValue(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    return typeof item === "string" && item.trim() !== ""
      ? [item.trim()]
      : [];
  });
}

function normalizedIncludesAny(
  value: string | undefined,
  expectedParts: string[]
): boolean {
  const normalizedValue = value?.trim().toLowerCase();

  if (!normalizedValue) {
    return false;
  }

  return expectedParts.some((expectedPart) => {
    return normalizedValue.includes(expectedPart);
  });
}

function normalizedTextIncludesAny(
  values: (string | undefined)[],
  expectedParts: string[]
): boolean {
  return values.some((value) => {
    return normalizedIncludesAny(value, expectedParts);
  });
}

function getAccessSecurityTopicShape(params: {
  topicAction: string | undefined;
  topicObject: string | undefined;
  topicDetails: Record<string, unknown> | undefined;
}): "login" | "password_reset" | "permission_denied" | "fallback" {
  const observedResult = getStringValue(params.topicDetails?.observed_result);
  const errorMessage = getStringValue(params.topicDetails?.error_message);

  if (
    normalizedIncludesAny(params.topicAction, [
      "permission",
      "access denied"
    ]) ||
    normalizedIncludesAny(observedResult, [
      "permission denied",
      "access denied",
      "forbidden",
      "not authorized",
      "unauthorized"
    ]) ||
    normalizedIncludesAny(errorMessage, [
      "permission denied",
      "access denied",
      "forbidden",
      "not authorized",
      "unauthorized"
    ])
  ) {
    return "permission_denied";
  }

  if (
    normalizedIncludesAny(params.topicAction, [
      "reset",
      "password reset"
    ]) ||
    normalizedIncludesAny(params.topicObject, [
      "password",
      "reset email",
      "email"
    ])
  ) {
    return "password_reset";
  }

  if (
    normalizedIncludesAny(params.topicAction, [
      "login",
      "log in",
      "connect",
      "sign in"
    ]) ||
    normalizedIncludesAny(params.topicObject, [
      "account",
      "session"
    ])
  ) {
    return "login";
  }

  return "fallback";
}

function filterAccessSecurityCandidateFields(params: {
  candidateFields: string[];
  topicDetails: Record<string, unknown> | undefined;
  topicAction: string | undefined;
}): string[] {
  return params.candidateFields.filter((fieldName) => {
    if (fieldName === "observed_result" && isFilledField(
      params.topicDetails?.error_message
    )) {
      return false;
    }

    if (fieldName === "access_action" && params.topicAction !== undefined) {
      return false;
    }

    return !isFilledField(params.topicDetails?.[fieldName]);
  });
}

function getAccessSecurityFieldsToAsk(params: {
  topicDetails: Record<string, unknown> | undefined;
  topicAction: string | undefined;
  topicObject: string | undefined;
}): string[] {
  const topicShape = getAccessSecurityTopicShape(params);
  const candidateFieldsByShape: Record<typeof topicShape, string[]> = {
    login: ["platform", "error_message", "account_context"],
    password_reset: ["account_context", "platform"],
    permission_denied: [
      "feature_or_page",
      "account_context",
      "observed_result",
      "platform"
    ],
    fallback: [
      "observed_result",
      "access_action",
      "auth_method",
      "platform",
      "account_context"
    ]
  };
  const fieldsToAsk = filterAccessSecurityCandidateFields({
    candidateFields: candidateFieldsByShape[topicShape],
    topicDetails: params.topicDetails,
    topicAction: params.topicAction
  });

  return fieldsToAsk.slice(0, MAX_MISSING_FIELDS_TO_ASK);
}

function removePreviouslyRequestedFields(params: {
  missingFields: string[];
  previouslyRequestedFields: string[];
}): string[] {
  const previouslyRequestedFields = new Set(params.previouslyRequestedFields);

  return params.missingFields.filter((fieldName) => {
    return !previouslyRequestedFields.has(fieldName);
  });
}

function getRecordValue(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : undefined;
}

function findHistoricalTopic(
  input: SearchDecisionInput,
  topicId: number
): SearchDecisionInput["supportTopicKnowledge"]["segments_topic"][number] | undefined {
  return input.supportTopicKnowledge.segments_topic.find((topic) => {
    return topic.id_topic === topicId;
  });
}

function getTopicDetailsForDecision(params: {
  input: SearchDecisionInput;
  topic: SearchDecisionInput["turnUnderstandingDelta"]["segments_topic"][number];
}): Record<string, unknown> | undefined {
  const currentTopicDetails = getRecordValue(params.topic.topic_details);

  if (params.topic.matched_historical_topic !== "yes") {
    return currentTopicDetails;
  }

  const historicalTopic = findHistoricalTopic(
    params.input,
    params.topic.id_topic
  );
  const historicalTopicDetails = getRecordValue(historicalTopic?.topic_details);
  const topicDetailsForDecision = {
    ...(historicalTopicDetails ?? {}),
    ...(currentTopicDetails ?? {})
  };

  return Object.keys(topicDetailsForDecision).length > 0
    ? topicDetailsForDecision
    : undefined;
}

function getTopicCategoryForDecision(params: {
  input: SearchDecisionInput;
  topic: SearchDecisionInput["turnUnderstandingDelta"]["segments_topic"][number];
}): TopicCategory {
  if (isTopicCategory(params.topic.topic_category)) {
    return params.topic.topic_category;
  }

  if (params.topic.matched_historical_topic === "yes") {
    const historicalTopic = findHistoricalTopic(
      params.input,
      params.topic.id_topic
    );

    if (isTopicCategory(historicalTopic?.topic_category)) {
      return historicalTopic.topic_category;
    }
  }

  return "other";
}

function getTopicStringFieldForDecision(params: {
  input: SearchDecisionInput;
  topic: SearchDecisionInput["turnUnderstandingDelta"]["segments_topic"][number];
  fieldName: "tool_or_product" | "topic_action" | "topic_object";
}): string | undefined {
  const currentValue = getStringValue(params.topic[params.fieldName]);

  if (currentValue !== undefined) {
    return currentValue;
  }

  if (params.topic.matched_historical_topic !== "yes") {
    return undefined;
  }

  const historicalTopic = findHistoricalTopic(
    params.input,
    params.topic.id_topic
  );

  return getStringValue(historicalTopic?.[params.fieldName]);
}

function isClearQuestionFaqTopic(params: {
  input: SearchDecisionInput;
  topic: SearchDecisionInput["turnUnderstandingDelta"]["segments_topic"][number];
  topicDetails: Record<string, unknown> | undefined;
}): boolean {
  return (
    isFilledField(params.topicDetails?.question_intent) &&
    getTopicStringFieldForDecision({
      input: params.input,
      topic: params.topic,
      fieldName: "tool_or_product"
    }) !== undefined &&
    getTopicStringFieldForDecision({
      input: params.input,
      topic: params.topic,
      fieldName: "topic_action"
    }) !== undefined &&
    getTopicStringFieldForDecision({
      input: params.input,
      topic: params.topic,
      fieldName: "topic_object"
    }) !== undefined
  );
}

function getTopicSegmentVerbatims(
  topic: SearchDecisionInput["turnUnderstandingDelta"]["segments_topic"][number]
): string[] {
  return getStringListValue(topic.segment_verbatims);
}

function getTopicUserGoal(
  topic: SearchDecisionInput["turnUnderstandingDelta"]["segments_topic"][number]
): string | undefined {
  return getStringValue(topic.user_goal);
}

function hasBugUsefulContext(params: {
  input: SearchDecisionInput;
  topic: SearchDecisionInput["turnUnderstandingDelta"]["segments_topic"][number];
  topicDetails: Record<string, unknown> | undefined;
}): boolean {
  return (
    getTopicStringFieldForDecision({
      input: params.input,
      topic: params.topic,
      fieldName: "topic_action"
    }) !== undefined ||
    isFilledField(params.topicDetails?.feature_or_page) ||
    isFilledField(params.topicDetails?.error_message) ||
    getTopicSegmentVerbatims(params.topic).length > 0
  );
}

function isBugObservedResultUseful(
  topicDetails: Record<string, unknown> | undefined
): boolean {
  const observedResult = getStringValue(topicDetails?.observed_result);

  if (!observedResult) {
    return false;
  }

  return !normalizedIncludesAny(observedResult, [
    "does not work",
    "doesn't work",
    "not working",
    "ne marche pas",
    "ça ne marche pas",
    "ca ne marche pas",
    "bug",
    "problem",
    "problème",
    "probleme"
  ]);
}

function getBugFieldsToAsk(params: {
  input: SearchDecisionInput;
  topic: SearchDecisionInput["turnUnderstandingDelta"]["segments_topic"][number];
  topicDetails: Record<string, unknown> | undefined;
  missingFields: string[];
}): string[] {
  if (
    isBugObservedResultUseful(params.topicDetails) &&
    hasBugUsefulContext({
      input: params.input,
      topic: params.topic,
      topicDetails: params.topicDetails
    })
  ) {
    return params.missingFields.includes("platform") &&
      !isFilledField(params.topicDetails?.platform)
      ? ["platform"]
      : [];
  }

  return selectMissingFieldsToAsk({
    topicCategory: "bug",
    missingFields: params.missingFields
  });
}

function isClearRequestTopic(params: {
  input: SearchDecisionInput;
  topic: SearchDecisionInput["turnUnderstandingDelta"]["segments_topic"][number];
  topicDetails: Record<string, unknown> | undefined;
}): boolean {
  const hasStructuredTitle =
    getTopicStringFieldForDecision({
      input: params.input,
      topic: params.topic,
      fieldName: "tool_or_product"
    }) !== undefined ||
    getTopicStringFieldForDecision({
      input: params.input,
      topic: params.topic,
      fieldName: "topic_action"
    }) !== undefined ||
    getTopicStringFieldForDecision({
      input: params.input,
      topic: params.topic,
      fieldName: "topic_object"
    }) !== undefined;

  return (
    getTopicSegmentVerbatims(params.topic).length > 0 &&
    (getTopicUserGoal(params.topic) !== undefined ||
      isFilledField(params.topicDetails?.gap_observed)) &&
    hasStructuredTitle
  );
}

function selectUsefulMissingFields(params: {
  input: SearchDecisionInput;
  topic: SearchDecisionInput["turnUnderstandingDelta"]["segments_topic"][number];
  topicCategory: TopicCategory;
  topicDetails: Record<string, unknown> | undefined;
  missingFields: string[];
}): string[] {
  if (params.topicCategory === "access_security") {
    return getAccessSecurityFieldsToAsk({
      topicDetails: params.topicDetails,
      topicAction: getTopicStringFieldForDecision({
        input: params.input,
        topic: params.topic,
        fieldName: "topic_action"
      }),
      topicObject: getTopicStringFieldForDecision({
        input: params.input,
        topic: params.topic,
        fieldName: "topic_object"
      })
    });
  }

  if (params.topicCategory === "bug") {
    return getBugFieldsToAsk({
      input: params.input,
      topic: params.topic,
      topicDetails: params.topicDetails,
      missingFields: params.missingFields
    });
  }

  if (
    params.topicCategory === "request" &&
    isClearRequestTopic({
      input: params.input,
      topic: params.topic,
      topicDetails: params.topicDetails
    })
  ) {
    return [];
  }

  if (
    params.topicCategory === "question_faq" &&
    isClearQuestionFaqTopic({
      input: params.input,
      topic: params.topic,
      topicDetails: params.topicDetails
    })
  ) {
    return [];
  }

  return selectMissingFieldsToAsk({
    topicCategory: params.topicCategory,
    missingFields: params.missingFields
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

function getFieldsRequestedFromTopicResponse(
  topicResponse: unknown,
  topicId: number
): string[] {
  const topicResponseRecord = getRecordValue(topicResponse);
  const title = getRecordValue(topicResponseRecord?.title);

  if (title?.topic_id !== topicId) {
    return [];
  }

  const mainResponse = getRecordValue(topicResponseRecord?.main_response);

  if (mainResponse?.type !== "ask_fields") {
    return [];
  }

  const details = getRecordValue(mainResponse.details);
  const fieldsRequested = details?.fields_requested;

  if (!Array.isArray(fieldsRequested)) {
    return [];
  }

  return fieldsRequested.filter((fieldName): fieldName is string => {
    return typeof fieldName === "string";
  });
}

function getPreviouslyRequestedFieldsForTopic(
  input: SearchDecisionInput,
  topicId: number
): string[] {
  const previouslyRequestedFields = new Set<string>();

  for (const conversationEvent of input.conversationHistory ?? []) {
    if (conversationEvent.role !== "bot") {
      continue;
    }

    const topicPlanMessages =
      conversationEvent.responsePlan.messagesPlan.topicPlanMessages;

    for (const topicPlanMessage of topicPlanMessages) {
      for (const topicResponseWrapper of topicPlanMessage.topics_responses) {
        const fieldsRequested = getFieldsRequestedFromTopicResponse(
          topicResponseWrapper.topic_response,
          topicId
        );

        for (const fieldName of fieldsRequested) {
          previouslyRequestedFields.add(fieldName);
        }
      }
    }
  }

  return [...previouslyRequestedFields];
}

function hasVisualAttachment(input: SearchDecisionInput): boolean {
  const attachments = input.turnUnderstandingDelta.attachments;

  return (
    (attachments?.images.length ?? 0) > 0 ||
    (attachments?.videos.length ?? 0) > 0
  );
}

function hasPreviouslyRequestedVisualEvidenceForTopic(
  input: SearchDecisionInput,
  topicId: number
): boolean {
  for (const conversationEvent of input.conversationHistory ?? []) {
    if (conversationEvent.role !== "bot") {
      continue;
    }

    const topicPlanMessages =
      conversationEvent.responsePlan.messagesPlan.topicPlanMessages;

    for (const topicPlanMessage of topicPlanMessages) {
      for (const topicResponseWrapper of topicPlanMessage.topics_responses) {
        const topicResponse = topicResponseWrapper.topic_response;

        if (
          topicResponse.title.topic_id === topicId &&
          topicResponse.optional_evidence_requested !== undefined
        ) {
          return true;
        }
      }
    }
  }

  return false;
}

function getTopicSearchText(params: {
  topic: SearchDecisionInput["turnUnderstandingDelta"]["segments_topic"][number];
  topicDetails: Record<string, unknown> | undefined;
}): string[] {
  return [
    getStringValue(params.topic.tool_or_product),
    getStringValue(params.topic.topic_action),
    getStringValue(params.topic.topic_object),
    getStringValue(params.topic.user_goal),
    ...getTopicSegmentVerbatims(params.topic),
    ...Object.values(params.topicDetails ?? {}).flatMap((value) => {
      return getStringValue(value) ?? [];
    })
  ].filter((value): value is string => {
    return value !== undefined;
  });
}

function isResolvedBugTopic(params: {
  topic: SearchDecisionInput["turnUnderstandingDelta"]["segments_topic"][number];
  topicDetails: Record<string, unknown> | undefined;
}): boolean {
  return normalizedTextIncludesAny(getTopicSearchText(params), [
    "works now",
    "now works",
    "is now created",
    "now created",
    "fixed",
    "resolved",
    "marche maintenant",
    "fonctionne maintenant",
    "c'est resolu",
    "c'est résolu",
    "ca marche maintenant",
    "ça marche maintenant"
  ]);
}

function isAccessibilityNonVisualBug(params: {
  topic: SearchDecisionInput["turnUnderstandingDelta"]["segments_topic"][number];
  topicDetails: Record<string, unknown> | undefined;
}): boolean {
  return normalizedTextIncludesAny(getTopicSearchText(params), [
    "voiceover",
    "screen reader",
    "lecteur d'écran",
    "lecteur d ecran",
    "accessibility",
    "accessibilite",
    "accessibilité"
  ]);
}

function isConnectorUnavailableBug(params: {
  topic: SearchDecisionInput["turnUnderstandingDelta"]["segments_topic"][number];
  topicDetails: Record<string, unknown> | undefined;
}): boolean {
  return normalizedTextIncludesAny(getTopicSearchText(params), [
    "connector",
    "connecteur",
    "connecteurs",
    "bank connector",
    "bank connectors",
    "ensap",
    "unavailable",
    "indisponible",
    "indisponibles"
  ]);
}

function shouldRequestOptionalVisualEvidence(params: {
  topic: SearchDecisionInput["turnUnderstandingDelta"]["segments_topic"][number];
  topicDetails: Record<string, unknown> | undefined;
}): boolean {
  if (isResolvedBugTopic(params)) {
    return false;
  }

  if (isAccessibilityNonVisualBug(params)) {
    return false;
  }

  if (isConnectorUnavailableBug(params)) {
    return false;
  }

  return true;
}

function getOptionalEvidenceRequestForTopic(params: {
  input: SearchDecisionInput;
  topic: SearchDecisionInput["turnUnderstandingDelta"]["segments_topic"][number];
  topicId: number;
  topicCategory: TopicCategory;
  topicDetails: Record<string, unknown> | undefined;
}): OptionalEvidenceRequest | undefined {
  if (params.topicCategory !== "bug") {
    return undefined;
  }

  if (hasVisualAttachment(params.input)) {
    return undefined;
  }

  if (
    hasPreviouslyRequestedVisualEvidenceForTopic(
      params.input,
      params.topicId
    )
  ) {
    return undefined;
  }

  if (
    !shouldRequestOptionalVisualEvidence({
      topic: params.topic,
      topicDetails: params.topicDetails
    })
  ) {
    return undefined;
  }

  return BUG_VISUAL_EVIDENCE_REQUEST;
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
  topic: SearchDecisionInput["turnUnderstandingDelta"]["segments_topic"][number];
  topicDetails: Record<string, unknown> | undefined;
}): boolean {
  if (!isRagEligibleTopicCategory(params.topicCategory)) {
    return false;
  }

  if (
    params.topicCategory === "bug" &&
    isResolvedBugTopic({
      topic: params.topic,
      topicDetails: params.topicDetails
    })
  ) {
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
      const topicCategory = getTopicCategoryForDecision({
        input,
        topic
      });
      const topicDetails = getTopicDetailsForDecision({
        input,
        topic
      });
      const missingFields = getMissingFields({
        topicCategory,
        topicDetails
      });
      const usefulMissingFields = selectUsefulMissingFields({
        input,
        topic,
        topicCategory,
        topicDetails,
        missingFields
      });
      const previouslyRequestedFields = getPreviouslyRequestedFieldsForTopic(
        input,
        topic.id_topic
      );
      const fieldsToAsk = removePreviouslyRequestedFields({
        missingFields: usefulMissingFields,
        previouslyRequestedFields
      });
      const optionalEvidenceRequest = getOptionalEvidenceRequestForTopic({
        input,
        topic,
        topicId: topic.id_topic,
        topicCategory,
        topicDetails
      });
      const optionalEvidenceFields =
        optionalEvidenceRequest === undefined
          ? {}
          : { optional_evidence_requested: optionalEvidenceRequest };

      if (fieldsToAsk.length > 0) {
        return {
          topic_id: topic.id_topic,
          type: "ask_more_info",
          missing_fields: fieldsToAsk,
          ...optionalEvidenceFields
        };
      }

      return {
        topic_id: topic.id_topic,
        type: shouldSearchSolution({
          input,
          topicId: topic.id_topic,
          topicCategory,
          topic,
          topicDetails
        })
          ? "solution_searching"
          : "acknowledgement",
        missing_fields: [],
        ...optionalEvidenceFields
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
