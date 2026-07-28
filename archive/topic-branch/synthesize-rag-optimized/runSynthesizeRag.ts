import type {AnalyzeSupportTextUnderstanding} from "../../analyze-support-text-optimized/runAnalyzeSupportText";
import type {SearchSimilarityOutput} from "../search-similarity-optimized/runSearchSimilarity";
import type {TopicIdentity, TopicUpdatePlan} from "../runTopicBranch";

type SynthesizedRagKnowledge = {
  summary: string;
  sourceReferences: string[];
  limitations: string[];
};

type SynthesizeRagInput = {
  topicUpdatePlan: TopicUpdatePlan;
  topicIdentity: TopicIdentity;
  sourceUnderstandings: AnalyzeSupportTextUnderstanding[];
  searchSimilarityOutput: SearchSimilarityOutput;
};

type SynthesizeRagProcessedOutput = {
  status: "processed";
  fallbackReason: null;
  synthesizedKnowledge: SynthesizedRagKnowledge | null;
};

type SynthesizeRagFallbackOutput = {
  status: "fallback";
  fallbackReason: "invalid_input" | "synthesis_failed";
  synthesizedKnowledge: null;
};

type SynthesizeRagOutput =
  | SynthesizeRagProcessedOutput
  | SynthesizeRagFallbackOutput;

async function runSynthesizeRag(input: SynthesizeRagInput): Promise<SynthesizeRagOutput> {
  if (input.searchSimilarityOutput.status === "fallback") {
    return {
      status: "fallback",
      fallbackReason: "invalid_input",
      synthesizedKnowledge: null
    };
  }

  if (input.searchSimilarityOutput.matches.length === 0) {
    return {
      status: "processed",
      fallbackReason: null,
      synthesizedKnowledge: {
        summary: "No similar support knowledge was connected for this topic.",
        sourceReferences: [],
        limitations: input.searchSimilarityOutput.limitations
      }
    };
  }

  return {
    status: "processed",
    fallbackReason: null,
    synthesizedKnowledge: {
      summary: input.searchSimilarityOutput.matches.map((match) => match.summary).join("\n"),
      sourceReferences: input.searchSimilarityOutput.matches.map((match) => match.sourceId),
      limitations: input.searchSimilarityOutput.limitations
    }
  };
}

export {runSynthesizeRag};

export type {
  SynthesizedRagKnowledge,
  SynthesizeRagInput,
  SynthesizeRagOutput
};
