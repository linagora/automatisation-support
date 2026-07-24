import {createDefaultSupportRagClient} from "../../../../../../infrastructure/rag/createDefaultSupportRagClient";
import {buildRankedSearchPrompt} from "./buildRankedSearchPrompt";

import type {LiveMemoryTopicOptimized} from "../../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";
import type {SupportRagClient} from "../../../../../../infrastructure/rag/supportRagClient";

type RankedSearch = LiveMemoryTopicOptimized["sourceTopicManager"]["retrieveKnowledge"]["rankedSearch"];

export type RawRagKnowledge = {
  query: string;
  content: string;
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
    maxTokens: 1400,
    metadata: {
      use_map_reduce: false,
      spoken_style_answer: false,
      websearch: false
    }
  });

  if (result.content.trim() === "" && result.sources.length === 0) {
    return null;
  }

  return {
    query: summaryTopic,
    content: result.content,
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

export {
  runRankedSearch,
  searchSimilarIssueTopics
};
