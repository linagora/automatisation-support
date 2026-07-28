const outputJsonShapeForPrompt = {
  filteredRagKnowledge: [
    {
      sourceId: "string or null",
      title: "string or null",
      summary: "string or null",
      usefulInformation: "string or null",
      rawExcerpt: "string or null",
      keepReason: "why this candidate may help"
    }
  ],
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
      required: ["filteredRagKnowledge", "filterExplanation"],
      properties: {
        filteredRagKnowledge: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["sourceId", "title", "summary", "usefulInformation", "rawExcerpt", "keepReason"],
            properties: {
              sourceId: {type: ["string", "null"]},
              title: {type: ["string", "null"]},
              summary: {type: ["string", "null"]},
              usefulInformation: {type: ["string", "null"]},
              rawExcerpt: {type: ["string", "null"]},
              keepReason: {type: "string"}
            }
          }
        },
        filterExplanation: {
          type: "string"
        }
      }
    }
  }
} as const;

export {
  outputJsonShapeForPrompt,
  retrieveKnowledgeFilterResponseFormat
};
