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

const nullableStringSchema = {
  type: ["string", "null"]
} as const;

const retrievedKnowledgeSynthesisSchema = objectOf(
  {
    summary: nullableStringSchema,
    customerFacing: nullableStringSchema,
    supportFacing: nullableStringSchema
  },
  [
    "summary",
    "customerFacing",
    "supportFacing"
  ]
);

const synthesizeRetrievedKnowledgeResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "synthesize_retrieved_knowledge",
    strict: true,
    schema: retrievedKnowledgeSynthesisSchema
  }
} as const;

export {
  retrievedKnowledgeSynthesisSchema,
  synthesizeRetrievedKnowledgeResponseFormat
};
