import {
  BROAD_INTENT_MODES
} from "../../../archive/support-catalog-LEGACY";

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
        broadIntent: objectOf(
          {
            mode: {
              enum: BROAD_INTENT_MODES,
              description:
                "Operational intent for this support topic. This is not the topic broadCategoryHint."
            },
            reason: {
              type: "string",
              description:
                "Short internal reason explaining why this broad intent was selected."
            }
          },
          ["mode", "reason"]
        ),
        rag: objectOf(
          {
            shouldRetrieve: {
              type: "boolean",
              description:
                "Whether RAG/support-knowledge retrieval is likely useful now."
            },
            mode: {
              enum: ["answer", "answer_and_soft_probe", null],
              description:
                "Use answer_and_soft_probe when answering a clear FAQ that may hide an issue. Use null when shouldRetrieve is false."
            },
            reason: {
              type: "string",
              description:
                "Short internal reason for the RAG decision."
            }
          },
          ["shouldRetrieve", "mode", "reason"]
        )
      },
      ["broadIntent", "rag"]
    )
  }
} as const;

export {
  knowledgeEnrichmentResponseFormat
};
