const outputJsonShapeForPrompt = {
  caseDetailsToAskBecauseOfSolutionFound: [
    {
      key: "browser",
      question: "Which browser and version are you using?",
      reason: "A similar issue depended on browser/version differences.",
      status: "asking"
    }
  ]
};

const buildCaseDetailsForSolutionResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "issue_solution_build_case_details",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["caseDetailsToAskBecauseOfSolutionFound"],
      properties: {
        caseDetailsToAskBecauseOfSolutionFound: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["key", "question", "reason", "status"],
            properties: {
              key: {type: "string"},
              question: {type: "string"},
              reason: {type: ["string", "null"]},
              status: {enum: ["asking"]}
            }
          }
        }
      }
    }
  }
} as const;

export {
  buildCaseDetailsForSolutionResponseFormat,
  outputJsonShapeForPrompt
};
