import {formatCatalogSelection} from "./catalogSelection";

const outputJsonShapeForPrompt = buildOutputJsonShapeForPrompt();

const responseFormat = {
  type: "json_schema",
  json_schema: {
    name: "propose_topic_updates",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["topicUpdatePlans"],
      properties: {
        topicUpdatePlans: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "topicId",
              "sourceCaseDetailIds",
              "sourceAttemptedActionIds",
              "sourceOtherIds",
              "title",
              "summaryTopic",
              "supportDomain"
            ],
            properties: {
              topicId: {
                anyOf: [
                  {type: "integer", minimum: 1},
                  {type: "null"}
                ]
              },
              sourceCaseDetailIds: {
                type: "array",
                items: {type: "string"}
              },
              sourceAttemptedActionIds: {
                type: "array",
                items: {type: "string"}
              },
              sourceOtherIds: {
                type: "array",
                items: {type: "string"}
              },
              title: {
                anyOf: [
                  {type: "string"},
                  {type: "null"}
                ]
              },
              summaryTopic: {
                anyOf: [
                  {type: "string"},
                  {type: "null"}
                ]
              },
              supportDomain: {
                type: "object",
                additionalProperties: false,
                required: ["value", "reason"],
                properties: {
                  value: {
                    anyOf: [
                      {enum: formatCatalogSelection.supportDomains},
                      {type: "null"}
                    ]
                  },
                  reason: {
                    anyOf: [
                      {type: "string"},
                      {type: "null"}
                    ]
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

function buildOutputJsonShapeForPrompt(): string {
  return `
{
  "topicUpdatePlans": [
    {
      "topicId": 12,
      "sourceCaseDetailIds": ["case_detail_1"],
      "sourceAttemptedActionIds": [],
      "sourceOtherIds": [],
      "title": "Login problem",
      "summaryTopic": "The user has a login problem that is now clarified as happening on Firefox.",
      "supportDomain": {
        "value": "access_security",
        "reason": "The routed facts concern login access."
      }
    },
    {
      "topicId": null,
      "sourceCaseDetailIds": ["case_detail_2"],
      "sourceAttemptedActionIds": [],
      "sourceOtherIds": [],
      "title": "Billing issue",
      "summaryTopic": "The user reports a billing issue that should be tracked as a separate support topic.",
      "supportDomain": {
        "value": "billing",
        "reason": "The routed facts concern billing."
      }
    }
  ]
}
`.trim();
}

export {
  outputJsonShapeForPrompt,
  responseFormat
};