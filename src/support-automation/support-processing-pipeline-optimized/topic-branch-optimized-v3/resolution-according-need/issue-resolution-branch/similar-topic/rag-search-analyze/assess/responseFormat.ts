const analyzeSimilarIssueTopicsResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "analyze_similar_issue_topics",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["status", "confirmedTopicIds", "disambiguationQuestion", "reason"],
      properties: {
        status: {
          enum: ["identified", "unclear", "absent"]
        },
        confirmedTopicIds: {
          type: "array",
          items: {type: "string"}
        },
        disambiguationQuestion: {
          anyOf: [{type: "string"}, {type: "null"}]
        },
        reason: {
          type: "string"
        }
      }
    }
  }
} as const;

export {analyzeSimilarIssueTopicsResponseFormat};
