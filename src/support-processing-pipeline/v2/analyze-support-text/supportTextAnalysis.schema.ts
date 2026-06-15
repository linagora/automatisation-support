import {
  BROAD_CATEGORY_HINTS,
  CANDIDATE_FACT_SUPPORT_VALUES,
  CONTEXT_DEPENDENCIES,
  PRIMARY_USER_EXPECTATIONS,
  SUPPORT_NEEDS,
  TESTED_ACTION_OUTCOMES,
  TEXT_UNCERTAINTY_REASONS
} from "./supportTextAnalysis.taxonomy";

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

const candidateFactValueSchema = {
  anyOf: [
    { type: "string" },
    { type: "number" },
    { type: "boolean" },
    { type: "null" }
  ]
} as const;

const explicitUserRequestSchema = objectOf(
  {
    request: stringSchema,
    evidence: stringSchema
  },
  ["request", "evidence"]
);

const contextualAnswerSchema = objectOf(
  {
    type: {
      enum: ["affirmative", "negative", "value", "reference"]
    },
    value: candidateFactValueSchema,
    evidence: stringSchema
  },
  ["type", "value", "evidence"]
);

const cataloguedFieldFactSchema = objectOf(
  {
    type: {
      const: "catalogued_field"
    },
    fieldName: stringSchema,
    value: candidateFactValueSchema,
    evidence: stringSchema
  },
  ["type", "fieldName", "value", "evidence"]
);

const openFactSchema = objectOf(
  {
    type: {
      const: "open_fact"
    },
    kind: stringSchema,
    value: candidateFactValueSchema,
    evidence: stringSchema,
    support: {
      enum: CANDIDATE_FACT_SUPPORT_VALUES
    }
  },
  ["type", "kind", "value", "evidence", "support"]
);

const supportFactSchema = {
  oneOf: [
    cataloguedFieldFactSchema,
    openFactSchema
  ]
} as const;

const testedActionSchema = objectOf(
  {
    label: stringSchema,
    outcome: {
      enum: TESTED_ACTION_OUTCOMES
    },
    evidence: stringSchema
  },
  ["label", "outcome", "evidence"]
);

const uncertaintySchema = objectOf(
  {
    reason: {
      enum: TEXT_UNCERTAINTY_REASONS
    },
    detail: stringSchema,
    evidence: nullableStringSchema
  },
  ["reason", "detail", "evidence"]
);

const supportTextItemSchema = objectOf(
  {
    sourceSegmentId: stringSchema,
    sourceVerbatims: arrayOf(stringSchema),
    summary: stringSchema,
    primaryUserExpectation: {
      enum: PRIMARY_USER_EXPECTATIONS
    },
    explicitUserRequest: {
      anyOf: [
        explicitUserRequestSchema,
        { type: "null" }
      ]
    },
    supportNeeds: {
      type: "array",
      items: {
        enum: SUPPORT_NEEDS
      }
    },
    broadCategoryHint: {
      anyOf: [
        { enum: BROAD_CATEGORY_HINTS },
        { type: "null" }
      ]
    },
    contextDependency: {
      enum: CONTEXT_DEPENDENCIES
    },
    contextualAnswer: {
      anyOf: [
        contextualAnswerSchema,
        { type: "null" }
      ]
    },
    facts: arrayOf(supportFactSchema),
    testedActions: arrayOf(testedActionSchema),
    uncertainties: arrayOf(uncertaintySchema)
  },
  [
    "sourceSegmentId",
    "sourceVerbatims",
    "summary",
    "primaryUserExpectation",
    "explicitUserRequest",
    "supportNeeds",
    "broadCategoryHint",
    "contextDependency",
    "contextualAnswer",
    "facts",
    "testedActions",
    "uncertainties"
  ]
);

const supportTextAnalysisResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "support_text_analysis",
    strict: true,
    schema: objectOf(
      {
        items: arrayOf(supportTextItemSchema)
      },
      ["items"]
    )
  }
} as const;

export {
  BROAD_CATEGORY_HINTS,
  CANDIDATE_FACT_SUPPORT_VALUES,
  CONTEXT_DEPENDENCIES,
  PRIMARY_USER_EXPECTATIONS,
  SUPPORT_NEEDS,
  TESTED_ACTION_OUTCOMES,
  TEXT_UNCERTAINTY_REASONS,
  supportTextAnalysisResponseFormat
};
