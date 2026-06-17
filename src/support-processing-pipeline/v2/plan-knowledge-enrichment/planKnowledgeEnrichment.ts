import type {
  KnowledgeEnrichmentPlan,
  PlanKnowledgeEnrichmentInput
} from "../typesSupportProcessingPipelineV2.types";

function planKnowledgeEnrichment(
  _input: PlanKnowledgeEnrichmentInput
): KnowledgeEnrichmentPlan {
  return {
    route: "no_retrieval",
    retrievalRequests: [],
    reason: "rag_not_enabled_yet"
  };
}

export {
  planKnowledgeEnrichment
};
