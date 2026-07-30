const outputJsonShapeForPrompt = {
  keptRawKnowledgeIds: ["raw_knowledge_1"],
  filterExplanation: "brief explanation of what was kept or removed"
};

const retrieveKnowledgeFilterResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "retrieve_knowledge_filter",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["keptRawKnowledgeIds", "filterExplanation"],
      properties: {
        keptRawKnowledgeIds: {
          type: "array",
          items: {type: "string"}
        },
        filterExplanation: {
          type: ["string", "null"]
        }
      }
    }
  }
} as const;

export {
  outputJsonShapeForPrompt,
  retrieveKnowledgeFilterResponseFormat
};
