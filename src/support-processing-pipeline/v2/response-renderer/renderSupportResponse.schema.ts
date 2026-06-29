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

const stringSchema = {
  type: "string"
} as const;

const renderedSupportResponseSchema = objectOf(
  {
    finalResponseText: stringSchema
  },
  [
    "finalResponseText"
  ]
);

const renderSupportResponseResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "render_support_response",
    strict: true,
    schema: renderedSupportResponseSchema
  }
} as const;

export {
  renderSupportResponseResponseFormat,
  renderedSupportResponseSchema
};