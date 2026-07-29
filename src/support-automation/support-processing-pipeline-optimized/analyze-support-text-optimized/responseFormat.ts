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
      required: [
        "summaryMessage",
        "userLanguage",
        "caseDetailsExtracted",
        "attemptedActionsExtracted",
        "otherExtracted"
      ],
      properties: {
        summaryMessage: {
          anyOf: [
            {type: "string"},
            {type: "null"}
          ]
        },
        userLanguage: {
          type: "string"
        },
        caseDetailsExtracted: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "key",
              "value",
              "evidence",
              "status",
              "sourceSegmentIds"
            ],
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
              },
              sourceSegmentIds: {
                type: "array",
                minItems: 1,
                items: {
                  type: "string"
                }
              }
            }
          }
        },
        attemptedActionsExtracted: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "action",
              "outcome",
              "evidence",
              "status",
              "sourceSegmentIds"
            ],
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
              },
              sourceSegmentIds: {
                type: "array",
                minItems: 1,
                items: {
                  type: "string"
                }
              }
            }
          }
        },
        otherExtracted: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "key",
              "value",
              "evidence",
              "sourceSegmentIds"
            ],
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
              },
              sourceSegmentIds: {
                type: "array",
                minItems: 1,
                items: {
                  type: "string"
                }
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
  "summaryMessage": "<short neutral summary of the latest support message, or null>",
  "userLanguage": "<detected user language, for example fr or en>",
  "caseDetailsExtracted": [
    {
      "key": "<field key>",
      "value": "<primitive or null>",
      "evidence": "<exact substring from one support segment>",
      "status": "obtained",
      "sourceSegmentIds": ["text_segment_1"]
    }
  ],
  "attemptedActionsExtracted": [
    {
      "action": "<short user attempted action, or exact requested action when answering a pending action>",
      "outcome": "<success | failed | partial | unknown>",
      "evidence": "<exact substring from one support segment>",
      "status": "obtained",
      "sourceSegmentIds": ["text_segment_1"]
    }
  ],
  "otherExtracted": [
    {
      "key": "<fact | limitation | attachment_reference | uncertainty | other>",
      "value": "<primitive or null>",
      "evidence": "<exact substring from one support segment>",
      "sourceSegmentIds": ["text_segment_1"]
    }
  ]
}
`.trim();
}

export {
  outputJsonShapeForPrompt,
  responseFormat
};
