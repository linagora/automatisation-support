import {formatCatalogSelection} from "./catalogSelection";

const supportDomainValues = [
  ...formatCatalogSelection.supportDomains,
  "unknown"
] as const;

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
              "messageAct",
              "extractedFields",
              "attemptedActions",
              "other",
              "summary",
              "supportDomain"
            ],
            properties: {
              sourceSegmentIds: {
                type: "array",
                minItems: 1,
                items: {
                  type: "string"
                }
              },
              messageAct: {
                enum: formatCatalogSelection.messageActs
              },
              extractedFields: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["key", "value", "evidence"],
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
                    }
                  }
                }
              },
              attemptedActions: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["action", "outcome", "evidence"],
                  properties: {
                    action: {
                      type: "string"
                    },
                    outcome: {
                      enum: formatCatalogSelection.attemptedActionOutcomes
                    },
                    evidence: {
                      type: "string"
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
              summary: {
                type: "string"
              },
              supportDomain: {
                enum: supportDomainValues
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
      "messageAct": "<catalogued message act>",
      "extractedFields": [
        {
          "key": "<field key>",
          "value": "<primitive or null>",
          "evidence": "<exact substring>"
        }
      ],
      "attemptedActions": [
        {
          "action": "<short user attempted action>",
          "outcome": "<attempted action outcome>",
          "evidence": "<exact substring>"
        }
      ],
      "other": [
        {
          "key": "<fact | support_context | limitation | attachment_reference | uncertainty | other>",
          "value": "<primitive or null>",
          "evidence": "<exact substring>"
        }
      ],
      "summary": "<short local understanding>",
      "supportDomain": "<support domain or unknown>"
    }
  ]
}
`.trim();
}

export {
  outputJsonShapeForPrompt,
  responseFormat
};
