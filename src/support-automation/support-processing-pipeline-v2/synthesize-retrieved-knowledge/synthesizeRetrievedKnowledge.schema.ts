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

const stringSchema = {
  type: "string"
} as const;

const stringArraySchema = arrayOf(stringSchema);

const retrievedKnowledgeSynthesisSchema = objectOf(
  {
    relevantFacts: stringArraySchema,
    applicableInstructions: stringArraySchema,
    possibleFields: stringArraySchema,
    unresolvedPoints: stringArraySchema,
    sourceReferences: stringArraySchema,
    limitations: stringArraySchema,
    doNotClaim: stringArraySchema,
    internalNotes: stringArraySchema,
    retrievedChunkCount: {
      type: "number"
    }
  },
  [
    "relevantFacts",
    "applicableInstructions",
    "possibleFields",
    "unresolvedPoints",
    "sourceReferences",
    "limitations",
    "doNotClaim",
    "internalNotes",
    "retrievedChunkCount"
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
