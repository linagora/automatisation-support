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

const stringArraySchema = arrayOf(stringSchema);

const questionSchema = objectOf(
  {
    fieldName: stringSchema,
    goal: stringSchema
  },
  [
    "fieldName",
    "goal"
  ]
);

const globalQuestionSchema = objectOf(
  {
    fieldName: stringSchema,
    goal: stringSchema,
    sourceTopicIds: stringArraySchema
  },
  [
    "fieldName",
    "goal",
    "sourceTopicIds"
  ]
);

const sectionSchema = objectOf(
  {
    kind: {
      enum: [
        "standard_fragment",
        "topic",
        "handover",
        "safety",
        "review"
      ]
    },
    topicId: nullableStringSchema,
    purpose: stringSchema,
    say: stringArraySchema,
    ask: arrayOf(questionSchema),
    forbid: stringArraySchema
  },
  [
    "kind",
    "topicId",
    "purpose",
    "say",
    "ask",
    "forbid"
  ]
);

const composedSupportResponsePlanSchema = objectOf(
  {
    targetLanguage: stringSchema,
    channel: stringSchema,
    messageIntent: {
      enum: [
        "support_reply",
        "standard_reply",
        "mixed_reply",
        "handover_reply",
        "review_reply"
      ]
    },
    globalTone: objectOf(
      {
        opening: {
          enum: [
            "none",
            "brief_acknowledgement",
            "empathetic_acknowledgement"
          ]
        },
        empathy: {
          enum: [
            "none",
            "light",
            "strong"
          ]
        },
        formality: {
          enum: [
            "standard",
            "friendly",
            "formal"
          ]
        }
      },
      [
        "opening",
        "empathy",
        "formality"
      ]
    ),
    sections: arrayOf(sectionSchema),
    globalQuestions: arrayOf(globalQuestionSchema),
    globalForbid: stringArraySchema,
    rendererInstructions: stringArraySchema
  },
  [
    "targetLanguage",
    "channel",
    "messageIntent",
    "globalTone",
    "sections",
    "globalQuestions",
    "globalForbid",
    "rendererInstructions"
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
