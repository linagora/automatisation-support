import {
  KNOWLEDGE_STATUS_VALUES,
  PLANNED_MESSAGE_ROLE_VALUES,
  QUESTION_PRIORITY_VALUES,
  RESPONSE_MODE_VALUES,
  RESPONSE_STRATEGY_VALUES
} from "./planSupportResponse.taxonomy";

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

const numberSchema = {
  type: "number"
} as const;

const nullableStringSchema = {
  anyOf: [
    { type: "string" },
    { type: "null" }
  ]
} as const;

const stringArraySchema = arrayOf(stringSchema);

const plannedMessageSchema = objectOf(
  {
    messageOrder: numberSchema,
    messageRole: {
      enum: PLANNED_MESSAGE_ROLE_VALUES
    },
    relatedTopicIds: stringArraySchema,
    relatedProposalIds: stringArraySchema,
    relatedUnderstandingIds: stringArraySchema,
    goal: stringSchema,
    instructionsToRenderer: stringSchema,
    mustMention: stringArraySchema,
    mustAsk: stringArraySchema,
    mustAvoid: stringArraySchema,
    knowledgeStatus: {
      enum: KNOWLEDGE_STATUS_VALUES
    },
    internalRationale: stringSchema
  },
  [
    "messageOrder",
    "messageRole",
    "relatedTopicIds",
    "relatedProposalIds",
    "relatedUnderstandingIds",
    "goal",
    "instructionsToRenderer",
    "mustMention",
    "mustAsk",
    "mustAvoid",
    "knowledgeStatus",
    "internalRationale"
  ]
);

const plannedQuestionSchema = objectOf(
  {
    questionId: stringSchema,
    appliesToTopicIds: stringArraySchema,
    fieldNames: stringArraySchema,
    wordingInstruction: stringSchema,
    reason: stringSchema,
    priority: {
      enum: QUESTION_PRIORITY_VALUES
    }
  },
  [
    "questionId",
    "appliesToTopicIds",
    "fieldNames",
    "wordingInstruction",
    "reason",
    "priority"
  ]
);

const supportResponsePlanSchema = objectOf(
  {
    responsePlanId: stringSchema,
    responseStrategy: {
      enum: RESPONSE_STRATEGY_VALUES
    },
    responseMode: {
      enum: RESPONSE_MODE_VALUES
    },
    rendererInstructions: stringSchema,
    plannedMessages: arrayOf(plannedMessageSchema),
    commonQuestions: arrayOf(plannedQuestionSchema),
    topicSpecificQuestions: arrayOf(plannedQuestionSchema),
    globalMustInclude: stringArraySchema,
    globalMustAvoid: stringArraySchema,
    standardHandlingInstructions: nullableStringSchema,
    cueHandlingInstructions: nullableStringSchema,
    internalRationale: stringSchema
  },
  [
    "responsePlanId",
    "responseStrategy",
    "responseMode",
    "rendererInstructions",
    "plannedMessages",
    "commonQuestions",
    "topicSpecificQuestions",
    "globalMustInclude",
    "globalMustAvoid",
    "standardHandlingInstructions",
    "cueHandlingInstructions",
    "internalRationale"
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
