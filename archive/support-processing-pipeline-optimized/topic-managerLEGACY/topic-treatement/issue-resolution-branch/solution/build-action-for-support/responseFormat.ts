const outputJsonShapeForPrompt = {
  actionToTakeForSupport: "internal support action with reason, or null"
};

const buildActionForSupportResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "issue_solution_build_action_for_support",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["actionToTakeForSupport"],
      properties: {
        actionToTakeForSupport: {
          type: ["string", "null"]
        }
      }
    }
  }
} as const;

export {
  buildActionForSupportResponseFormat,
  outputJsonShapeForPrompt
};
