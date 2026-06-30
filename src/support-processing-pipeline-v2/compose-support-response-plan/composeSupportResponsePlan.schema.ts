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

const stringSchema = {
  type: "string"
} as const;

const nullableStringSchema = {
  anyOf: [
    { type: "string" },
    { type: "null" }
  ]
} as const;

const nullSchema = {
  type: "null"
} as const;

const stringArraySchema = arrayOf(stringSchema);

const messageIntentSchema = {
  enum: [
    "support_reply",
    "standard_reply",
    "mixed_reply",
    "handover_reply",
    "review_reply"
  ]
} as const;

const answerSupportSchema = {
  enum: [
    "standard_fragment",
    "topic_plan",
    "support_cue",
    "policy"
  ]
} as const;

const answerSchema = objectOf(
  {
    point: stringSchema,
    support: answerSupportSchema
  },
  [
    "point",
    "support"
  ]
);

const askSchema = objectOf(
  {
    goal: stringSchema,
    sourceTopicIds: stringArraySchema
  },
  [
    "goal",
    "sourceTopicIds"
  ]
);

const composedSupportResponsePlanSchema = objectOf(
  {
    topicId: nullSchema,
    messageIntent: messageIntentSchema,
    acknowledge: stringArraySchema,
    answer: arrayOf(answerSchema),
    ask: arrayOf(askSchema),
    say: stringArraySchema,
    review: nullableStringSchema
  },
  [
    "topicId",
    "messageIntent",
    "acknowledge",
    "answer",
    "ask",
    "say",
    "review"
  ]
);

const composeSupportResponsePlanResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "compose_support_response_plan",
    strict: true,
    schema: composedSupportResponsePlanSchema
  }
} as const;

export {
  composeSupportResponsePlanResponseFormat,
  composedSupportResponsePlanSchema
};