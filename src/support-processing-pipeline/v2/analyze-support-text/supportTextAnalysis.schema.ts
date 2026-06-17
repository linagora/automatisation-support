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

const primitiveOrNullSchema = {
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

const noContextualAnswerSchema = objectOf(
  {
    type: { const: "none" },
    value: { type: "null" },
    evidence: { type: "null" }
  },
  ["type", "value", "evidence"]
);

const contextualAnswerSchema = objectOf(
  {
    type: {
      enum: ["affirmative", "negative", "value", "reference"]
    },
    value: primitiveOrNullSchema,
    evidence: stringSchema
  },
  ["type", "value", "evidence"]
);

const cataloguedFieldFactSchema = objectOf(
  {
    type: { const: "catalogued_field" },
    fieldName: stringSchema,
    value: primitiveOrNullSchema,
    evidence: stringSchema
  },
  ["type", "fieldName", "value", "evidence"]
);

const openFactSchema = objectOf(
  {
    type: { const: "open_fact" },
    kind: stringSchema,
    value: primitiveOrNullSchema,
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

const sharedItemProperties = {
  sourceSegmentIds: nonEmptyArrayOf(stringSchema),
  sourceVerbatims: nonEmptyArrayOf(stringSchema),
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
  facts: arrayOf(supportFactSchema),
  testedActions: arrayOf(testedActionSchema),
  uncertainties: arrayOf(uncertaintySchema)
};

const requiredItemProperties = [
  "sourceSegmentIds",
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
];

const standaloneItemSchema = objectOf(
  {
    ...sharedItemProperties,
    contextDependency: {
      enum: [
        "standalone_complete",
        "standalone_but_may_match_existing"
      ]
    },
    contextualAnswer: noContextualAnswerSchema
  },
  requiredItemProperties
);

const contextDependentItemSchema = objectOf(
  {
    ...sharedItemProperties,
    contextDependency: {
      enum: [
        "needs_context_to_interpret",
        "needs_context_to_place"
      ]
    },
    contextualAnswer: contextualAnswerSchema
  },
  requiredItemProperties
);

const supportTextItemSchema = {
  oneOf: [
    standaloneItemSchema,
    contextDependentItemSchema
  ]
} as const;

const supportResponseCueSchema = objectOf(
  {
    sourceSegmentIds: nonEmptyArrayOf(stringSchema),
    relatedUnderstandingIds: nonEmptyArrayOf(stringSchema),
    verbatim: stringSchema,
    cueNote: stringSchema
  },
  [
    "sourceSegmentIds",
    "relatedUnderstandingIds",
    "verbatim",
    "cueNote"
  ]
);

const supportTextAnalysisResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "support_text_analysis",
    strict: true,
    schema: objectOf(
      {
        items: arrayOf(supportTextItemSchema),
        supportResponseCues: arrayOf(supportResponseCueSchema)
      },
      ["items", "supportResponseCues"]
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
