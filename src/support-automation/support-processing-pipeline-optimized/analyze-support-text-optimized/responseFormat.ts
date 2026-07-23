import {formatCatalogSelection} from "./catalogSelection";

const outputJsonShapeForPrompt = buildOutputJsonShapeForPrompt();

const responseFormat = {
  type: "json_schema",
  json_schema: {
    name: "support_text_analysis",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["understandings"],
      properties: {
        understandings: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "sourceSegmentIds",
              "caseDetailsExtracted",
              "attemptedActionsExtracted",
              "other",
              "summaryMessage"
            ],
            properties: {
              sourceSegmentIds: {
                type: "array",
                minItems: 1,
                items: {
                  type: "string"
                }
              },
              caseDetailsExtracted: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["key", "value", "evidence", "status"],
                  properties: {
                    key: {
                      enum: formatCatalogSelection.extractableFields
                    },
                    value: {
                      anyOf: [
                        {type: "string"},
                        {type: "number"},
                        {type: "boolean"},
                        {type: "null"}
                      ]
                    },
                    evidence: {
                      type: "string"
                    },
                    status: {
                      enum: ["obtained", "user_declared_unavailable"]
                    }
                  }
                }
              },
              attemptedActionsExtracted: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["action", "outcome", "evidence", "status"],
                  properties: {
                    action: {
                      type: "string"
                    },
                    outcome: {
                      enum: formatCatalogSelection.attemptedActionOutcomes
                    },
                    evidence: {
                      type: "string"
                    },
                    status: {
                      enum: ["obtained", "user_declared_unavailable"]
                    }
                  }
                }
              },
              other: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["key", "value", "evidence"],
                  properties: {
                    key: {
                      enum: formatCatalogSelection.otherKeys
                    },
                    value: {
                      anyOf: [
                        {type: "string"},
                        {type: "number"},
                        {type: "boolean"},
                        {type: "null"}
                      ]
                    },
                    evidence: {
                      type: "string"
                    }
                  }
                }
              },
              summaryMessage: {
                type: "string"
              }
            }
          }
        }
      }
    }
  }
} as const;

function buildOutputJsonShapeForPrompt(): string {
  return `
{
  "understandings": [
    {
      "sourceSegmentIds": ["text_segment_1"],
      "caseDetailsExtracted": [
        {
          "key": "<field key>",
          "value": "<primitive or null>",
          "evidence": "<exact substring>",
          "status": "obtained"
        }
      ],
      "attemptedActionsExtracted": [
        {
          "action": "<short user attempted action>",
          "outcome": "<attempted action outcome>",
          "evidence": "<exact substring>",
          "status": "obtained"
        }
      ],
      "other": [
        {
          "key": "<fact | limitation | attachment_reference | uncertainty | other>",
          "value": "<primitive or null>",
          "evidence": "<exact substring>"
        }
      ],
      "summaryMessage": "<short local understanding of this message/understanding>"
    }
  ]
}
`.trim();
}

export {
  outputJsonShapeForPrompt,
  responseFormat
};
