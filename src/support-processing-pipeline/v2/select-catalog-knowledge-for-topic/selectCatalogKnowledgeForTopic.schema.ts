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

const stringSchema = {
  type: "string"
} as const;

const stringArraySchema = {
  type: "array",
  items: stringSchema
} as const;

const selectedCatalogKnowledgeForTopicSchema = objectOf(
  {
    selectedFieldNames: stringArraySchema,
    selectedGenericKnowledgeIds: stringArraySchema,
    scopeReason: stringSchema,
    rejectedFieldNames: stringArraySchema,
    warnings: stringArraySchema
  },
  [
    "selectedFieldNames",
    "selectedGenericKnowledgeIds",
    "scopeReason",
    "rejectedFieldNames",
    "warnings"
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
