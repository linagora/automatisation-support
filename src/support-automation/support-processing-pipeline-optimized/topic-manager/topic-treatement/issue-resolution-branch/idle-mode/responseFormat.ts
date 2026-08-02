const idleModeResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "issue_idle_mode_decision",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["topicStatus", "topicHandoverRequest", "say"],
      properties: {
        topicStatus: {
          enum: ["solved_by_bot", "unsolved"]
        },
        topicHandoverRequest: {
          type: "object",
          additionalProperties: false,
          required: ["isRequested", "reason"],
          properties: {
            isRequested: {
              type: "boolean"
            },
            reason: {
              type: ["string", "null"]
            }
          }
        },
        say: {
          type: ["string", "null"]
        }
      }
    }
  }
} as const;

export {idleModeResponseFormat};
