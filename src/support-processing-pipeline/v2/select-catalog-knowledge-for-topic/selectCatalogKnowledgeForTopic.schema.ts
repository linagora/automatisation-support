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

const selectedCatalogKnowledgeForTopicSchema = objectOf(
  {
    selectedFieldNames: stringArraySchema
  },
  [
    "selectedFieldNames"
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
