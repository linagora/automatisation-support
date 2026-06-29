import {
  JsonFileSupportKnowledgeRetriever
} from "./retrievers/jsonFileSupportKnowledgeRetriever";
import {
  HttpSupportKnowledgeRetriever
} from "./retrievers/httpSupportKnowledgeRetriever";

import type {
  KnowledgeChunk,
  RetrieveSupportKnowledgeInput,
  SupportKnowledgeRetriever
} from "../typesSupportProcessingPipelineV2.types";

function createDefaultSupportKnowledgeRetriever(): SupportKnowledgeRetriever {
  const baseUrl = process.env.SUPPORT_RAG_API_URL;
  const apiKey = process.env.SUPPORT_RAG_API_KEY;
  const model = process.env.SUPPORT_RAG_MODEL;

  if (baseUrl && apiKey && model) {
    return new HttpSupportKnowledgeRetriever({
      baseUrl,
      apiKey,
      model
    });
  }

  return new JsonFileSupportKnowledgeRetriever();
}

function hasUsableRetrievalRequest(
  input: RetrieveSupportKnowledgeInput
): boolean {
  return input.knowledgeEnrichmentPlan.retrievalRequests.some((request) => {
    return request.queryText.trim() !== "";
  });
}

async function retrieveSupportKnowledge(
  input: RetrieveSupportKnowledgeInput,
  retriever: SupportKnowledgeRetriever = input.retriever ??
    createDefaultSupportKnowledgeRetriever()
): Promise<KnowledgeChunk[]> {
  if (input.knowledgeEnrichmentPlan.route !== "retrieve_knowledge" ||
    !hasUsableRetrievalRequest(input)) {
    return [];
  }

  return retriever.retrieve(input);
}

export {
  createDefaultSupportKnowledgeRetriever,
  retrieveSupportKnowledge
};
