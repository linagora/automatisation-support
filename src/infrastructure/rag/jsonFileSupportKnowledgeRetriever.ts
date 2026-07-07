import {
  JsonKnowledgeRepository
} from "../../archive/repositories/json/jsonKnowledgeRepository";

import type {
  KnowledgeChunk,
  RetrieveSupportKnowledgeInput,
  SupportKnowledgeRetriever,
  TextUnderstanding,
  TopicEvidence
} from "../../support-automation/support-processing-pipeline-v2/typesSupportProcessingPipelineV2.types";

function compactText(value: string | null | undefined): string | undefined {
  const compacted = value?.replace(/\s+/g, " ").trim();

  return compacted && compacted.length > 0 ? compacted : undefined;
}

function buildQueryTopicEvidence(input: RetrieveSupportKnowledgeInput): TopicEvidence {
  const request = input.knowledgeEnrichmentPlan.retrievalRequests[0];
  const queryText = input.knowledgeEnrichmentPlan.retrievalRequests
    .map((candidate) => candidate.queryText)
    .filter((value) => value.trim() !== "")
    .join(" ");

  const topicId = request?.topicId ?? input.topicEvidence.topicId;
  const summary =
    compactText(request?.context.topicSummary) ??
    compactText(queryText) ??
    "Support topic needing knowledge lookup.";

  const broadCategoryHint = request?.filters?.broadCategoryHint;

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