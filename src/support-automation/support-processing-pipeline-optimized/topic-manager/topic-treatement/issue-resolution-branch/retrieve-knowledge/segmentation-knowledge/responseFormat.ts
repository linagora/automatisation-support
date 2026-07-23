const outputJsonShapeForPrompt = {
  userFacingInformation: "string or null",
  supportFacingInformation: "string or null"
};

const segmentationKnowledgeResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "retrieve_knowledge_segmentation",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["userFacingInformation", "supportFacingInformation"],
      properties: {
        userFacingInformation: {type: ["string", "null"]},
        supportFacingInformation: {type: ["string", "null"]}
      }
    }
  }
} as const;

export {
  outputJsonShapeForPrompt,
  segmentationKnowledgeResponseFormat
};
