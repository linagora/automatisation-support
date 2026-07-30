const outputJsonShapeForPrompt = {
  isClearSelected: true,
  selectedRawKnowledgeIds: ["raw_knowledge_1"],
  clarificationQuestion: null,
  selectionExplanation: "The selected candidates clearly match the user's issue."
};

const retrieveKnowledgeSelectionResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "retrieve_knowledge_selection",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["isClearSelected", "selectedRawKnowledgeIds", "clarificationQuestion", "selectionExplanation"],
      properties: {
        isClearSelected: {type: "boolean"},
        selectedRawKnowledgeIds: {
          type: "array",
          items: {type: "string"}
        },
        clarificationQuestion: {type: ["string", "null"]},
        selectionExplanation: {type: ["string", "null"]}
      }
    }
  }
} as const;

export {
  outputJsonShapeForPrompt,
  retrieveKnowledgeSelectionResponseFormat
};
