import {
  BROAD_CATEGORY_HINTS
} from "../../support-catalog";

const TOPIC_UPDATE_OPS = [
  "update",
  "create"
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

const nonNegativeIntegerSchema = {
  type: "integer",
  minimum: 0
} as const;

const positiveIntegerSchema = {
  type: "integer",
  minimum: 1
} as const;

const stringSchema = {
  type: "string"
} as const;

const nullableStringSchema = {
  anyOf: [
    { type: "string" },
    { type: "null" }
  ]
} as const;

const nullablePositiveIntegerSchema = {
  anyOf: [
    positiveIntegerSchema,
    { type: "null" }
  ]
} as const;

const nullableBroadCategoryHintSchema = {
  anyOf: [
    { enum: BROAD_CATEGORY_HINTS },
    { type: "null" }
  ]
} as const;

const referencePairSchema = {
  type: "array",
  prefixItems: [
    nonNegativeIntegerSchema,
    nonNegativeIntegerSchema
  ],
  minItems: 2,
  maxItems: 2
} as const;

const topicPatchIdentitySchema = objectOf(
  {
    title: nullableStringSchema,
    broadCategoryHint: nullableBroadCategoryHintSchema,
    summary: nullableStringSchema
  },
  [
    "title",
    "broadCategoryHint",
    "summary"
  ]
);

const topicMergeRefsSchema = objectOf(
  {
    caseDetails: arrayOf(referencePairSchema),
    attemptedActions: arrayOf(referencePairSchema)
  },
  [
    "caseDetails",
    "attemptedActions"
  ]
);

const topicReplaceRefsSchema = objectOf(
  {
    caseDetails: arrayOf(objectOf(
      {
        key: stringSchema,
        with: referencePairSchema
      },
      [
        "key",
        "with"
      ]
    )),
    attemptedActions: arrayOf(objectOf(
      {
        targetIndex: nonNegativeIntegerSchema,
        with: referencePairSchema
      },
      [
        "targetIndex",
        "with"
      ]
    ))
  },
  [
    "caseDetails",
    "attemptedActions"
  ]
);

const topicUpdateOpSchema = objectOf(
  {
    op: {
      enum: TOPIC_UPDATE_OPS
    },
    items: arrayOf(nonNegativeIntegerSchema),
    // Important: topicId is now an integer id, never a string.
    // update => existing integer topicId
    // create => null, application code assigns max(existing topicId) + 1
    topicId: nullablePositiveIntegerSchema,
    topic: {
      anyOf: [
        topicPatchIdentitySchema,
        { type: "null" }
      ]
    },
    merge: {
      anyOf: [
        topicMergeRefsSchema,
        { type: "null" }
      ]
    },
    replace: {
      anyOf: [
        topicReplaceRefsSchema,
        { type: "null" }
      ]
    }
  },
  [
    "op",
    "items",
    "topicId",
    "topic",
    "merge",
    "replace"
  ]
);

const proposeTopicUpdatesResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "propose_topic_updates",
    strict: true,
    schema: objectOf(
      {
        ops: arrayOf(topicUpdateOpSchema)
      },
      ["ops"]
    )
  }
} as const;

export {
  BROAD_CATEGORY_HINTS,
  TOPIC_UPDATE_OPS,
  proposeTopicUpdatesResponseFormat
};
