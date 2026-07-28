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

const outputJsonShapeForPrompt = `
{
  "finalResponseText": "final customer-facing response"
}
`.trim();

const responseFormat = {
  type: "json_schema",
  json_schema: {
    name: "render_support_response",
    strict: true,
    schema: objectOf(
      {
        finalResponseText: {type: "string"}
      },
      ["finalResponseText"]
    )
  }
} as const;

export {
  outputJsonShapeForPrompt,
  responseFormat
};
