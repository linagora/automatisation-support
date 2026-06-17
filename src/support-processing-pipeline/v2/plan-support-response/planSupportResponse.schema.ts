import {
  ALLOWED_RESPONSE_MOVE_VALUES,
  KNOWLEDGE_MODE_VALUES
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

const booleanSchema = {
  type: "boolean"
} as const;

const nullableStringSchema = {
  anyOf: [
    { type: "string" },
    { type: "null" }
  ]
} as const;

const stringArraySchema = arrayOf(stringSchema);

const knowledgeGateSchema = objectOf(
  {
    knowledgeMode: {
      enum: KNOWLEDGE_MODE_VALUES
    },
    solutionAllowed: booleanSchema,
    allowedMoves: arrayOf({
      enum: ALLOWED_RESPONSE_MOVE_VALUES
    }),
    reason: stringSchema
  },
  [
    "knowledgeMode",
    "solutionAllowed",
    "allowedMoves",
    "reason"
  ]
);

const questionDecisionSchema = objectOf(
  {
    shouldAskQuestion: booleanSchema,
    plannedQuestionCount: numberSchema,
    fieldNames: stringArraySchema,
    questionInstruction: nullableStringSchema,
    reason: stringSchema
  },
  [
    "shouldAskQuestion",
    "plannedQuestionCount",
    "fieldNames",
    "questionInstruction",
    "reason"
  ]
);

const rendererTaskSchema = objectOf(
  {
    targetLanguage: stringSchema,
    prompt: stringSchema,
    questionFieldNames: stringArraySchema,
    forbiddenClaims: stringArraySchema
  },
  [
    "targetLanguage",
    "prompt",
    "questionFieldNames",
    "forbiddenClaims"
  ]
);

const supportResponsePlanSchema = objectOf(
  {
    responsePlanId: stringSchema,
    knowledgeGate: knowledgeGateSchema,
    questionDecision: questionDecisionSchema,
    rendererTask: rendererTaskSchema,
    internalRationale: stringSchema
  },
  [
    "responsePlanId",
    "knowledgeGate",
    "questionDecision",
    "rendererTask",
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
