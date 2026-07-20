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
            required: ["operation", "sourceUnderstandingIds", "targetTopicId", "topicIdentity"],
            properties: {
              operation: {enum: formatCatalogSelection.topicOperations},
              sourceUnderstandingIds: {type: "array", minItems: 1, items: {type: "string"}},
              targetTopicId: {
                anyOf: [{type: "integer", minimum: 1}, {type: "null"}]
              },
              topicIdentity: {
                type: "object",
                additionalProperties: false,
                required: ["title", "supportDomain", "summary"],
                properties: {
                  title: {anyOf: [{type: "string"}, {type: "null"}]},
                  supportDomain: {
                    anyOf: [{enum: formatCatalogSelection.supportDomains}, {type: "null"}]
                  },
                  summary: {anyOf: [{type: "string"}, {type: "null"}]}
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
      "operation": "update",
      "sourceUnderstandingIds": ["text_understanding_1"],
      "targetTopicId": 12,
      "topicIdentity": {
        "title": null,
        "supportDomain": null,
        "summary": "The user has a login problem that is now clarified as happening on Firefox."
      }
    },
    {
      "operation": "create",
      "sourceUnderstandingIds": ["text_understanding_2"],
      "targetTopicId": null,
      "topicIdentity": {
        "title": "Billing issue",
        "supportDomain": "billing",
        "summary": "The user reports a billing issue that should be tracked as a separate support topic."
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
