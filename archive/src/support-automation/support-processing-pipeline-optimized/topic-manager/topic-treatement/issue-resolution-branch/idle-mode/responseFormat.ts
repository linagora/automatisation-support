const idleModeResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "issue_idle_mode_decision",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["resolutionStatus", "handover", "say"],
      properties: {
        resolutionStatus: {
          type: "object",
          additionalProperties: false,
          required: ["value", "reason"],
          properties: {
            value: {
              enum: ["solved_by_bot", "unsolved"]
            },
            reason: {
              type: ["string", "null"]
            }
          }
        },
        handover: {
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
