import type {
  KnowledgeEnrichmentPlan,
  PlanKnowledgeEnrichmentInput
} from "../typesSupportProcessingPipelineV2.types";
import {
  JsonKnowledgeRepository
} from "../../../repositories/json/jsonKnowledgeRepository";

function getTopicId(input: PlanKnowledgeEnrichmentInput): number {
  const match = input.topicEvidence.topicId?.match(/\d+/);

  return match ? Number(match[0]) : 0;
}

async function planKnowledgeEnrichment(
  input: PlanKnowledgeEnrichmentInput
): Promise<KnowledgeEnrichmentPlan> {
  const matches = await new JsonKnowledgeRepository().searchRelevant({
    topicEvidence: input.topicEvidence,
    limit: 1
  });

  if (matches.length > 0) {
    return {
      route: "retrieve_knowledge",
      retrievalRequests: [
        {
          topicId: getTopicId(input),
          query: matches[0].matchedTerms.join(" "),
          filters: {
            knowledgeIds: matches.map((match) => match.item.knowledgeId)
          }
        }
      ],
      reason: "matching_mock_knowledge_available"
    };
  }

  return {
    route: "no_retrieval",
    retrievalRequests: [],
    reason: "no_matching_mock_knowledge"
  };
}

export {
  planKnowledgeEnrichment
};
