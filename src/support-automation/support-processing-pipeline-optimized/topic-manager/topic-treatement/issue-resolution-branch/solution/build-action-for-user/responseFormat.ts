const outputJsonShapeForPrompt = {
  attemptedActionsToAskBecauseOfSolutionFound: [
    {
      action: "concrete, detailed, atomic action the user should try",
      reason: "why this action may help, or null",
      status: "asking"
    }
  ]
};

const buildActionForUserResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "issue_solution_build_action_for_user",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["attemptedActionsToAskBecauseOfSolutionFound"],
      properties: {
        attemptedActionsToAskBecauseOfSolutionFound: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["action", "reason", "status"],
            properties: {
              action: {type: "string"},
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
  buildActionForUserResponseFormat,
  outputJsonShapeForPrompt
};
