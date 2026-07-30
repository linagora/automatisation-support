const outputJsonShapeForPrompt = {
  segmentedKnowledge: [
    {
      rawKnowledgeId: "raw_knowledge_1",
      userFacingKnowledge: [
        {
          text: "A faithful user-facing excerpt or detail.",
          sourceHint: "github_issue_123.md",
          sourceSpan: "lines 10-18"
        }
      ],
      supportFacingKnowledge: [
        {
          text: "A faithful support-facing excerpt or detail.",
          sourceHint: "github_issue_123.md",
          sourceSpan: "lines 19-28"
        }
      ]
    }
  ]
};

const segmentationKnowledgeResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "retrieve_knowledge_segmentation",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["segmentedKnowledge"],
      properties: {
        segmentedKnowledge: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["rawKnowledgeId", "userFacingKnowledge", "supportFacingKnowledge"],
            properties: {
              rawKnowledgeId: {type: "string"},
              userFacingKnowledge: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["text", "sourceHint", "sourceSpan"],
                  properties: {
                    text: {type: "string"},
                    sourceHint: {type: ["string", "null"]},
                    sourceSpan: {type: ["string", "null"]}
                  }
                }
              },
              supportFacingKnowledge: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["text", "sourceHint", "sourceSpan"],
                  properties: {
                    text: {type: "string"},
                    sourceHint: {type: ["string", "null"]},
                    sourceSpan: {type: ["string", "null"]}
                  }
                }
              }
            }
          }
        }
      }
    }
  }
} as const;

export {
  outputJsonShapeForPrompt,
  segmentationKnowledgeResponseFormat
};
