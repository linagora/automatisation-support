const outputJsonShapeForPrompt = `
{
  "translatedMessage": "<the exact translated message, preserving line breaks and meaning>"
}
`.trim();

const responseFormat = {
  type: "json_schema",
  json_schema: {
    name: "translate_support_message",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["translatedMessage"],
      properties: {
        translatedMessage: {type: "string"}
      }
    }
  }
} as const;

export {outputJsonShapeForPrompt, responseFormat};
