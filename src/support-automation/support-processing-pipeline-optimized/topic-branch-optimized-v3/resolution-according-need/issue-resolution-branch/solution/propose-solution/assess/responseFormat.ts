const proposeIssueSolutionResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "propose_issue_solution",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["status", "customerFacingSolution", "supportFacingSummary", "confidence", "attemptedActionsToTry"],
      properties: {
        status: {enum: ["available", "not_found", "not_relevant"]},
        customerFacingSolution: {anyOf: [{type: "string"}, {type: "null"}]},
        supportFacingSummary: {anyOf: [{type: "string"}, {type: "null"}]},
        confidence: {anyOf: [{type: "number"}, {type: "null"}]},
        attemptedActionsToTry: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["action", "evidence"],
            properties: {
              action: {type: "string"},
              evidence: {anyOf: [{type: "string"}, {type: "null"}]}
            }
          }
        }
      }
    }
  }
} as const;

export {proposeIssueSolutionResponseFormat};
