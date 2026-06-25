import {
  JsonKnowledgeRepository
} from "../../../repositories/json/jsonKnowledgeRepository";

import type {
  KnowledgeChunk,
  RetrieveSupportKnowledgeInput
} from "../typesSupportProcessingPipelineV2.types";

function getTopicId(input: RetrieveSupportKnowledgeInput): number {
  const requestedTopicId =
    input.knowledgeEnrichmentPlan.retrievalRequests[0]?.topicId;

  return requestedTopicId ?? 0;
}

async function retrieveSupportKnowledge(
  input: RetrieveSupportKnowledgeInput
): Promise<KnowledgeChunk[]> {
  const selectedFieldNames =
    input.selectedCatalogKnowledge.selectedFields.map((field) => {
      return field.fieldName;
    });
  const matches = await new JsonKnowledgeRepository().searchRelevant({
    topicEvidence: input.topicEvidence,
    selectedFieldNames,
    limit: 3
  });
  const topicId = getTopicId(input);

  return matches.map((match) => ({
    topicId,
    sourceId: match.item.knowledgeId,
    content: JSON.stringify(match.item),
    score: match.score,
    metadata: {
      sourceType: match.item.source.type,
      title: match.item.title
    }
  }));
}

export {
  retrieveSupportKnowledge
};
