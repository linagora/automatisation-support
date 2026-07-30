const outputJsonShapeForPrompt = {
  say: "English message asking the user to try pending solution action(s) and/or answer specific case-detail question(s)"
};

const issueSolutionAskResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "issue_solution_ask_user_action",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["say"],
      properties: {
        say: {
          type: "string"
        }
      }
    }
  }
} as const;

export {
  issueSolutionAskResponseFormat,
  outputJsonShapeForPrompt
};
