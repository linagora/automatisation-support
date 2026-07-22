const assessIssueSolutionUserFeedbackResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "assess_issue_solution_user_feedback",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["feedbackStatus", "resolutionStatus", "attemptedActionResults", "reason"],
      properties: {
        feedbackStatus: {enum: ["no_feedback", "unclear", "some_tested", "all_tested", "user_declared_unavailable"]},
        resolutionStatus: {enum: ["resolved", "unresolved", "unknown"]},
        attemptedActionResults: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["action", "outcome", "evidence"],
            properties: {
              action: {type: "string"},
              outcome: {enum: ["success", "failed", "partial", "unknown"]},
              evidence: {anyOf: [{type: "string"}, {type: "null"}]}
            }
          }
        },
        reason: {anyOf: [{type: "string"}, {type: "null"}]}
      }
    }
  }
} as const;

export {assessIssueSolutionUserFeedbackResponseFormat};
