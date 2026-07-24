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

const stringArraySchema = {
  type: "array",
  items: {
    type: "string"
  }
} as const;

const directQuestionGuidanceSchema = {
  anyOf: [
    {
      type: "null"
    },
    objectOf(
      {
        fieldNames: stringArraySchema,
        guidance: {
          type: "string"
        },
        reason: {
          type: "string"
        }
      },
      [
        "fieldNames",
        "guidance",
        "reason"
      ]
    )
  ]
} as const;

const diagnosticFlowSchema = {
  anyOf: [
    {
      type: "null"
    },
    objectOf(
      {
        name: {
          type: "string"
        },
        targetFieldNames: stringArraySchema,
        attemptedActionsRelevant: {
          type: "boolean"
        },
        guidance: {
          type: "string"
        },
        reason: {
          type: "string"
        }
      },
      [
        "name",
        "targetFieldNames",
        "attemptedActionsRelevant",
        "guidance",
        "reason"
      ]
    )
  ]
} as const;

const selectedCatalogKnowledgeForTopicSchema = objectOf(
  {
    selectedFieldNames: stringArraySchema,
    directQuestionGuidance: directQuestionGuidanceSchema,
    diagnosticFlow: diagnosticFlowSchema,
    sufficientlyQualified: {
      type: "boolean"
    },
    reason: {
      type: "string"
    }
  },
  [
    "selectedFieldNames",
    "directQuestionGuidance",
    "diagnosticFlow",
    "sufficientlyQualified",
    "reason"
  ]
);

const selectCatalogKnowledgeForTopicResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "select_catalog_knowledge_for_topic",
    strict: true,
    schema: selectedCatalogKnowledgeForTopicSchema
  }
} as const;

export {
  selectCatalogKnowledgeForTopicResponseFormat,
  selectedCatalogKnowledgeForTopicSchema
};
