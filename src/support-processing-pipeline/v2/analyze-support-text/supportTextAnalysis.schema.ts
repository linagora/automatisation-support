import {
  ATTEMPTED_ACTION_OUTCOME_VALUES,
  MESSAGE_KIND_VALUES
} from "../support-text-analysis.catalog";

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

const primitiveOrNullSchema = {
  anyOf: [
    { type: "string" },
    { type: "number" },
    { type: "boolean" },
    { type: "null" }
  ]
} as const;

const messageKindSchema = objectOf(
  {
    kind: {
      enum: MESSAGE_KIND_VALUES
    },
    evidence: stringSchema
  },
  ["kind", "evidence"]
);

const caseDetailSchema = objectOf(
  {
    key: stringSchema,
    value: primitiveOrNullSchema,
    evidence: stringSchema
  },
  ["key", "value", "evidence"]
);

const attemptedActionSchema = objectOf(
  {
    action: stringSchema,
    outcome: {
      enum: ATTEMPTED_ACTION_OUTCOME_VALUES
    },
    evidence: stringSchema
  },
  ["action", "outcome", "evidence"]
);

const supportMetadataSchema = objectOf(
  {
    key: stringSchema,
    value: primitiveOrNullSchema,
    evidence: stringSchema
  },
  ["key", "value", "evidence"]
);

const supportTextItemSchema = objectOf(
  {
    sourceSegmentIds: nonEmptyArrayOf(stringSchema),
    messageKinds: arrayOf(messageKindSchema),
    caseDetails: arrayOf(caseDetailSchema),
    attemptedActions: arrayOf(attemptedActionSchema),
    supportMetadata: arrayOf(supportMetadataSchema),
    summary: stringSchema
  },
  [
    "sourceSegmentIds",
    "messageKinds",
    "caseDetails",
    "attemptedActions",
    "supportMetadata",
    "summary"
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
  supportTextAnalysisResponseFormat
};
