const extractIssueSolutionResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "extract_issue_solution",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["status", "customerFacingSolution", "supportFacingSummary", "confidence"],
      properties: {
        status: {
          enum: ["available", "not_found", "not_relevant"]
        },
        customerFacingSolution: {
          anyOf: [{type: "string"}, {type: "null"}]
        },
        supportFacingSummary: {
          anyOf: [{type: "string"}, {type: "null"}]
        },
        confidence: {
          anyOf: [{type: "number"}, {type: "null"}]
        }
      }
    }
  }
} as const;

export {extractIssueSolutionResponseFormat};
