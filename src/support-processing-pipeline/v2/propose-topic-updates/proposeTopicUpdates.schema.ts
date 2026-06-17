const TOPIC_UPDATE_ACTIONS = [
  "update_existing_topic",
  "create_new_topic",
  "no_topic_update",
  "needs_review"
] as const;

const TOPIC_UPDATE_RELATIONSHIPS = [
  "continues_existing_issue",
  "adds_new_information",
  "answers_requested_field",
  "reports_test_result",
  "reports_resolution",
  "reports_partial_resolution",
  "corrects_previous_information",
  "reopens_or_persists_issue",
  "creates_distinct_topic",
  "unclear"
] as const;

const TOPIC_STATUS_HINTS = [
  "open",
  "resolved",
  "partially_resolved",
  "unclear"
] as const;

const BLOCKING_ISSUE_VALUES = [
  "yes",
  "no",
  "unknown"
] as const;

function objectOf(
  properties: Record<string, unknown>,
  required: string[]
): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    properties,
    required
  };
}

function arrayOf(items: Record<string, unknown>): Record<string, unknown> {
  return {
    type: "array",
    items
  };
}

function nonEmptyArrayOf(items: Record<string, unknown>): Record<string, unknown> {
  return {
    type: "array",
    minItems: 1,
    items
  };
}

const stringSchema = {
  type: "string"
} as const;

const nullableStringSchema = {
  anyOf: [
    { type: "string" },
    { type: "null" }
  ]
} as const;

const updateIntentSchema = objectOf(
  {
    relationship: {
      enum: TOPIC_UPDATE_RELATIONSHIPS
    },
    blockingIssue: {
      enum: BLOCKING_ISSUE_VALUES
    },
    statusHint: {
      enum: TOPIC_STATUS_HINTS
    },
    userGoal: nullableStringSchema,
    correctionNote: nullableStringSchema
  },
  [
    "relationship",
    "blockingIssue",
    "statusHint",
    "userGoal",
    "correctionNote"
  ]
);

const newTopicSchema = objectOf(
  {
    title: stringSchema,
    broadCategoryHint: nullableStringSchema,
    userGoal: nullableStringSchema,
    blockingIssue: {
      enum: BLOCKING_ISSUE_VALUES
    }
  },
  [
    "title",
    "broadCategoryHint",
    "userGoal",
    "blockingIssue"
  ]
);

const proposalSchema = objectOf(
  {
    action: {
      enum: TOPIC_UPDATE_ACTIONS
    },
    fromUnderstandingIds: nonEmptyArrayOf(stringSchema),
    topicId: nullableStringSchema,
    selectedSourceVerbatims: arrayOf(stringSchema),
    updateIntent: {
      anyOf: [
        updateIntentSchema,
        { type: "null" }
      ]
    },
    newTopic: {
      anyOf: [
        newTopicSchema,
        { type: "null" }
      ]
    },
    reason: stringSchema
  },
  [
    "action",
    "fromUnderstandingIds",
    "topicId",
    "selectedSourceVerbatims",
    "updateIntent",
    "newTopic",
    "reason"
  ]
);

const proposeTopicUpdatesResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "propose_topic_updates",
    strict: true,
    schema: objectOf(
      {
        proposals: arrayOf(proposalSchema)
      },
      ["proposals"]
    )
  }
} as const;

export {
  BLOCKING_ISSUE_VALUES,
  TOPIC_STATUS_HINTS,
  TOPIC_UPDATE_ACTIONS,
  TOPIC_UPDATE_RELATIONSHIPS,
  proposeTopicUpdatesResponseFormat
};
