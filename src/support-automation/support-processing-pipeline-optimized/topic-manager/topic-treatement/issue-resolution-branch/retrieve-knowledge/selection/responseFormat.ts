const outputJsonShapeForPrompt = {
  isClearSelected: true,
  clarificationQuestion: null,
  selectedfilteredRagKnowledge: [
    {
      sourceId: "string or null",
      title: "string or null",
      usefulInformation: "string or null"
    }
  ],
  selectionExplanation: "brief explanation of why the selected knowledge is clear or why clarification is needed"
};

const retrieveKnowledgeSelectionResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "retrieve_knowledge_selection",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["isClearSelected", "clarificationQuestion", "selectedfilteredRagKnowledge", "selectionExplanation"],
      properties: {
        isClearSelected: {type: "boolean"},
        clarificationQuestion: {type: ["string", "null"]},
        selectedfilteredRagKnowledge: {
          anyOf: [
            {type: "null"},
            {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["sourceId", "title", "usefulInformation", "whySelected"],
                properties: {
                  sourceId: {type: ["string", "null"]},
                  title: {type: ["string", "null"]},
                  usefulInformation: {type: ["string", "null"]},
                  whySelected: {type: "string"}
                }
              }
            }
          ]
        },
        selectionExplanation: {type: "string"}
      }
    }
  }
} as const;

export {
  outputJsonShapeForPrompt,
  retrieveKnowledgeSelectionResponseFormat
};
