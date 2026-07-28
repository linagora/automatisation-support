const outputJsonShapeForPrompt = {
  say: "English message asking the user to try the pending solution action(s) and report the result"
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
