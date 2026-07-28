function objectOf(
  properties: Record<string, unknown>,
  required: string[]
): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    properties,
    required
  };
}

function arrayOf(items: Record<string, unknown>): Record<string, unknown> {
  return {
    type: "array",
    items
  };
}

const outputJsonShapeForPrompt = `
{
  "messageIntent": "support_reply | standard_reply | mixed_reply | handover_reply | review_reply",
  "topicIds": [1, 2, null],
  "say": ["compact renderer instruction"],
  "review": "short internal composition note or null"
}
`.trim();

const responseFormat = {
  type: "json_schema",
  json_schema: {
    name: "compose_support_response_plan",
    strict: true,
    schema: objectOf(
      {
        messageIntent: {
          enum: [
            "support_reply",
            "standard_reply",
            "mixed_reply",
            "handover_reply",
            "review_reply"
          ]
        },
        topicIds: arrayOf({
          anyOf: [
            {type: "number"},
            {type: "null"}
          ]
        }),
        say: arrayOf({type: "string"}),
        review: {
          anyOf: [
            {type: "string"},
            {type: "null"}
          ]
        }
      },
      ["messageIntent", "topicIds", "say", "review"]
    )
  }
} as const;

export {
  outputJsonShapeForPrompt,
  responseFormat
};
