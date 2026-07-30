import {createDefaultSupportRagClient} from "../../../../../../../infrastructure/rag/createDefaultSupportRagClient";
import {parseLLMResponse} from "../../../../../../../infrastructure/llm/parseLLMResponse";
import {buildRankedSearchPrompt} from "./buildRankedSearchPrompt";

import type {LiveMemoryTopicOptimized} from "../../../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";
import type {SupportRagClient} from "../../../../../../../infrastructure/rag/supportRagClient";

type RankedSearch = LiveMemoryTopicOptimized["sourceTopicManager"]["retrieveKnowledge"]["rankedSearch"];

export type RawKnowledgeCandidate = {
  rawKnowledgeId: string;
  rawKnowledge: string;
  whyPotentiallyRelevant: string | null;
  sourceHint: string | null;
};

export type RawRagKnowledge = {
  query: string;
  content: string;
  candidates: RawKnowledgeCandidate[];
  sources: unknown[];
  metadata: {
    retriever: "openrag";
  };
};

export type SearchSimilarIssueTopicsInput = {
  summaryTopic: string;
  ragClient?: SupportRagClient;
};

export type SearchSimilarIssueTopics = (
  input: SearchSimilarIssueTopicsInput
) => Promise<unknown>;

export type RunRankedSearchInput = {
  summaryTopic: string;
  ragClient?: SupportRagClient;
  searchSimilarIssueTopics?: SearchSimilarIssueTopics;
};

async function searchSimilarIssueTopics(
  input: SearchSimilarIssueTopicsInput
): Promise<RawRagKnowledge | null> {
  const summaryTopic = normalizeSummaryTopic(input.summaryTopic);

  if (!summaryTopic) {
    return null;
  }

  const ragClient = input.ragClient ?? createDefaultSupportRagClient();
  const result = await ragClient.call({
    messages: [
      {
        role: "user",
        content: buildRankedSearchPrompt({summaryTopic})
      }
    ],
    temperature: 0.1,
    maxTokens: 5000,
    metadata: {
      use_map_reduce: false,
      spoken_style_answer: false,
      websearch: false
    }
  });

  const content = result.content.trim();

  if (content === "") {
    return null;
  }

  return {
    query: summaryTopic,
    content: result.content,
    candidates: buildRawKnowledgeCandidates(content),
    sources: result.sources,
    metadata: {
      retriever: "openrag"
    }
  };
}

async function runRankedSearch(input: RunRankedSearchInput): Promise<RankedSearch> {
  const rawRagKnowledge = await (input.searchSimilarIssueTopics ?? searchSimilarIssueTopics)({
    summaryTopic: input.summaryTopic,
    ragClient: input.ragClient
  });

  return {
    isSearched: true,
    rawRagKnowledge: rawRagKnowledge ?? null
  };
}

function normalizeSummaryTopic(summaryTopic: string): string | null {
  const trimmedSummaryTopic = summaryTopic.trim();

  return trimmedSummaryTopic === "" ? null : trimmedSummaryTopic;
}

function buildRawKnowledgeCandidates(content: string): RawKnowledgeCandidate[] {
  const parsedContent = parseLLMResponse(content);

  if (isRecord(parsedContent) && Array.isArray(parsedContent.candidates)) {
    const candidates = parsedContent.candidates
      .map(validateRawKnowledgeCandidatePayload)
      .filter((candidate): candidate is Omit<RawKnowledgeCandidate, "rawKnowledgeId"> => candidate !== null)
      .map((candidate, index) => ({
        rawKnowledgeId: `raw_knowledge_${index + 1}`,
        ...candidate
      }));

    if (candidates.length > 0) {
      return candidates;
    }
  }

  return [
    {
      rawKnowledgeId: "raw_knowledge_1",
      rawKnowledge: content,
      whyPotentiallyRelevant: null,
      sourceHint: null
    }
  ];
}

function validateRawKnowledgeCandidatePayload(
  value: unknown
): Omit<RawKnowledgeCandidate, "rawKnowledgeId"> | null {
  if (!isRecord(value)) return null;

  const rawKnowledge = validateNonEmptyString(value.rawKnowledge);
  if (!rawKnowledge) return null;

  return {
    rawKnowledge,
    whyPotentiallyRelevant: validateNullableString(value.whyPotentiallyRelevant),
    sourceHint: validateNullableString(value.sourceHint)
  };
}

function validateNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function validateNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export {
  runRankedSearch,
  searchSimilarIssueTopics
};
