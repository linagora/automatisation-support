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
            required: ["topicId", "sourceUnderstandingIds", "title", "summaryTopic", "supportDomain"],
            properties: {
              topicId: {
                anyOf: [{type: "integer", minimum: 1}, {type: "null"}]
              },
              sourceUnderstandingIds: {type: "array", minItems: 1, items: {type: "string"}},
              title: {anyOf: [{type: "string"}, {type: "null"}]},
              summaryTopic: {anyOf: [{type: "string"}, {type: "null"}]},
              supportDomain: {
                type: "object",
                additionalProperties: false,
                required: ["value", "reason"],
                properties: {
                  value: {
                    anyOf: [{enum: formatCatalogSelection.supportDomains}, {type: "null"}]
                  },
                  reason: {anyOf: [{type: "string"}, {type: "null"}]}
                }
              },
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
      "sourceUnderstandingIds": ["text_understanding_1"],
      "title": "Login problem",
      "summaryTopic": "The user has a login problem that is now clarified as happening on Firefox.",
      "supportDomain": {
        "value": "access_security",
        "reason": "The current understanding and previous topic concern login access."
      }
    },
    {
      "topicId": null,
      "sourceUnderstandingIds": ["text_understanding_2"],
      "title": "Billing issue",
      "summaryTopic": "The user reports a billing issue that should be tracked as a separate support topic.",
      "supportDomain": {
        "value": "billing",
        "reason": "The current understanding is about billing."
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
