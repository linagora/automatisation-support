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

const knowledgeEnrichmentResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "knowledge_enrichment_decision",
    strict: true,
    schema: objectOf(
      {
        route: {
          enum: ["none", "catalog_only", "rag_only", "catalog_and_rag"],
          description:
            "Whether this topic should use no enrichment, catalog selection only, RAG only, or both catalog selection and RAG."
        },
        reason: {
          type: "string",
          description:
            "Short internal reason. Use snake_case or a concise internal phrase."
        }
      },
      ["route", "reason"]
    )
  }
} as const;

export {
  knowledgeEnrichmentResponseFormat
};
