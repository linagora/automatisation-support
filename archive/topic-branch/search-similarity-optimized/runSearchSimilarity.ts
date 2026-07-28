import type {AnalyzeSupportTextUnderstanding} from "../../analyze-support-text-optimized/runAnalyzeSupportText";
import type {DerivedSupportRouting} from "../derive-support-routing-optimized/deriveSupportRouting";
import type {TopicIdentity, TopicUpdatePlan} from "../runTopicBranch";

type SimilarityMatch = {
  sourceId: string;
  title: string | null;
  summary: string;
  score: number | null;
};

type SearchSimilarityInput = {
  topicUpdatePlan: TopicUpdatePlan;
  topicIdentity: TopicIdentity;
  sourceUnderstandings: AnalyzeSupportTextUnderstanding[];
  liveMemory: unknown;
  routing: DerivedSupportRouting;
};

type SearchSimilarityProcessedOutput = {
  status: "processed";
  fallbackReason: null;
  query: string;
  matches: SimilarityMatch[];
  limitations: string[];
};

type SearchSimilarityFallbackOutput = {
  status: "fallback";
  fallbackReason: "invalid_input" | "search_failed";
  query: null;
  matches: [];
  limitations: [];
};

type SearchSimilarityOutput =
  | SearchSimilarityProcessedOutput
  | SearchSimilarityFallbackOutput;

async function runSearchSimilarity(input: SearchSimilarityInput): Promise<SearchSimilarityOutput> {
  return {
    status: "processed",
    fallbackReason: null,
    query: buildQuery(input),
    matches: [],
    limitations: ["similarity_search_not_connected_yet"]
  };
}

function buildQuery(input: SearchSimilarityInput): string {
  return [
    input.topicIdentity.title,
    input.topicIdentity.supportDomain,
    input.topicIdentity.summary,
    ...input.sourceUnderstandings.map((understanding) => understanding.summary)
  ]
    .filter((value): value is string => typeof value === "string" && value.trim() !== "")
    .join(" | ");
}

export {runSearchSimilarity};

export type {
  SearchSimilarityInput,
  SearchSimilarityOutput,
  SimilarityMatch
};
