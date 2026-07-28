const issueDeepQualificationAskPlannerResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "issue_deep_qualification_ask_plan",
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

export {issueDeepQualificationAskPlannerResponseFormat};
