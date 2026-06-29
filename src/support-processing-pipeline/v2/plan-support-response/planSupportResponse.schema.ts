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

const plannedAnswerSupportSchema = {
  enum: [
    "retrieved_knowledge",
    "selected_catalog_knowledge",
    "topic",
    "attachment",
    "policy"
  ]
} as const;

const plannedAnswerPointSchema = objectOf(
  {
    point: stringSchema,
    support: plannedAnswerSupportSchema
  },
  [
    "point",
    "support"
  ]
);

const plannedAskFieldSchema = objectOf(
  {
    fieldName: stringSchema,
    goal: stringSchema
  },
  [
    "fieldName",
    "goal"
  ]
);

const supportResponsePlanSchema = objectOf(
  {
    topicId: nullableStringSchema,
    acknowledge: arrayOf(stringSchema),
    answer: arrayOf(plannedAnswerPointSchema),
    ask: arrayOf(plannedAskFieldSchema),
    say: arrayOf(stringSchema),
    review: nullableStringSchema
  },
  [
    "topicId",
    "acknowledge",
    "answer",
    "ask",
    "say",
    "review"
  ]
);

const planSupportResponseResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "plan_support_response",
    strict: true,
    schema: supportResponsePlanSchema
  }
} as const;

export {
  planSupportResponseResponseFormat,
  supportResponsePlanSchema
};
