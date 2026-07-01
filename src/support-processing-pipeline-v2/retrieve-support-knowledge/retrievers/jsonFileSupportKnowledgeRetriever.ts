import {
  JsonKnowledgeRepository
} from "../../../repositories/json/jsonKnowledgeRepository";

import type {
  KnowledgeChunk,
  RetrieveSupportKnowledgeInput,
  SupportKnowledgeRetriever,
  TextUnderstanding,
  TopicEvidence
} from "../../typesSupportProcessingPipelineV2.types";

function buildQueryTopicEvidence(input: RetrieveSupportKnowledgeInput): TopicEvidence {
  const queryText = input.knowledgeEnrichmentPlan.retrievalRequests
    .map((request) => request.queryText)
    .filter((value) => value.trim() !== "")
    .join(" ");
  const topicId =
    input.knowledgeEnrichmentPlan.retrievalRequests[0]?.topicId ??
    input.topicEvidence.topicId;
  const summary =
    input.knowledgeEnrichmentPlan.retrievalRequests[0]?.context.topicSummary ??
    queryText;
  const broadCategoryHint =
    input.knowledgeEnrichmentPlan.retrievalRequests[0]?.filters
      ?.broadCategoryHint;
  const queryUnderstanding: TextUnderstanding = {
    understandingId: "rag_query",
    sourceSegmentIds: [],
    messageKinds: [],
    caseDetails: [],
    attemptedActions: [],
    supportMetadata: [],
    sourceVerbatims: queryText ? [queryText] : [],
    summary,
    ...(broadCategoryHint ? { broadCategoryHint } : {})
  };

  return {
    ...input.topicEvidence,
    topicId,
    topicSourceVerbatims: queryText
      ? [queryText]
      : input.topicEvidence.topicSourceVerbatims,
    relatedTextUnderstandings: [queryUnderstanding]
  };
}

class JsonFileSupportKnowledgeRetriever implements SupportKnowledgeRetriever {
  constructor(
    private readonly repository = new JsonKnowledgeRepository()
  ) {}

  async retrieve(input: RetrieveSupportKnowledgeInput): Promise<KnowledgeChunk[]> {
    const queryEvidence = buildQueryTopicEvidence(input);
    const matches = await this.repository.searchRelevant({
      topicEvidence: queryEvidence,
      limit: input.limit ?? 3
    });
    const topicId =
      input.knowledgeEnrichmentPlan.retrievalRequests[0]?.topicId ??
      input.topicEvidence.topicId ??
      null;

    return matches.map((match) => ({
      topicId,
      sourceId: match.item.knowledgeId,
      content: JSON.stringify(match.item),
      score: match.score,
      metadata: {
        sourceType: match.item.source.type,
        title: match.item.title,
        retriever: "json_file_fake"
      }
    }));
  }
}

export {
  JsonFileSupportKnowledgeRetriever
};
