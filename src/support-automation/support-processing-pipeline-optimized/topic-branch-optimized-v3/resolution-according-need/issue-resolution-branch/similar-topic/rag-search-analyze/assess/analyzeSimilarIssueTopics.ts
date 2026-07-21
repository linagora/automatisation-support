import {callLLM} from "../../../../../../../../infrastructure/llm/llm-client";
import {parseLLMResponse} from "../../../../../../../../infrastructure/llm/parseLLMResponse";
import {buildAnalyzeSimilarIssueTopicsPrompt} from "./buildAnalyzeSimilarIssueTopicsPrompt";
import {analyzeSimilarIssueTopicsResponseFormat} from "./responseFormat";
import {validateAnalyzeSimilarIssueTopicsOutput} from "./validateAnalyzeSimilarIssueTopicsOutput";

import type {CurrentUserMessage, PreviousConversationTurn} from "../../../../../runTopicBranch";
import type {IssueProgressState, SimilarIssueTopicCandidate} from "../../../runIssueResolutionBranch";
import type {AnalyzeSimilarIssueTopicsValidatedOutput} from "./validateAnalyzeSimilarIssueTopicsOutput";

type SimilarIssueTopicAnalysisOutput = {
  status: "processed" | "fallback";
  fallbackReason: unknown | null;
  issueProgressState: IssueProgressState;
  analysis: AnalyzeSimilarIssueTopicsValidatedOutput | null;
};

async function analyzeSimilarIssueTopics(input: {
  issueProgressState: IssueProgressState;
  currentUserMessage: CurrentUserMessage;
  previousConversationTurn: PreviousConversationTurn;
}): Promise<SimilarIssueTopicAnalysisOutput> {
  const candidates = input.issueProgressState.similarTopic.ragSearch.retrievedCandidates;

  if (candidates.length === 0) {
    return buildProcessed(input.issueProgressState, {
      status: "absent",
      confirmedTopicIds: [],
      disambiguationQuestion: null,
      reason: "No similar issue topic candidates were retrieved."
    });
  }

  const fallbackAnalysis = buildDeterministicAnalysis(candidates);
  const {messages} = buildAnalyzeSimilarIssueTopicsPrompt(input);

  try {
    const result = await callLLM(messages, {
      stage: "similar_issue_topic_analysis",
      preset: "standard",
      temperature: 0,
      maxTokens: 500,
      responseFormat: analyzeSimilarIssueTopicsResponseFormat
    });

    if (!result.success || !result.content) {
      return buildProcessed(input.issueProgressState, fallbackAnalysis);
    }

    const parsed = parseLLMResponse(result.content);
    const validated = validateAnalyzeSimilarIssueTopicsOutput(parsed);

    return buildProcessed(input.issueProgressState, validated ?? fallbackAnalysis);
  } catch {
    return buildProcessed(input.issueProgressState, fallbackAnalysis);
  }
}

function buildProcessed(
  issueProgressState: IssueProgressState,
  analysis: AnalyzeSimilarIssueTopicsValidatedOutput
): SimilarIssueTopicAnalysisOutput {
  const candidatesById = new Map(issueProgressState.similarTopic.ragSearch.retrievedCandidates.map((candidate) => [candidate.similarTopicId, candidate]));
  const confirmedTopics = analysis.confirmedTopicIds
    .map((topicId) => candidatesById.get(topicId))
    .filter((candidate): candidate is SimilarIssueTopicCandidate => Boolean(candidate));

  const selectedTopic = confirmedTopics[0] ?? null;

  return {
    status: "processed",
    fallbackReason: null,
    analysis,
    issueProgressState: {
      ...issueProgressState,
      similarTopic: {
        ...issueProgressState.similarTopic,
        analysis: {
          status: analysis.status,
          confirmedTopics,
          selectedTopic,
          disambiguationQuestion: analysis.disambiguationQuestion,
          reason: analysis.reason,
          fallbackReason: null
        }
      }
    }
  };
}

function buildDeterministicAnalysis(candidates: SimilarIssueTopicCandidate[]): AnalyzeSimilarIssueTopicsValidatedOutput {
  if (candidates.length === 1 && (candidates[0].score ?? 0) >= 0.85) {
    return {
      status: "identified",
      confirmedTopicIds: [candidates[0].similarTopicId],
      disambiguationQuestion: null,
      reason: "One candidate has a high similarity score."
    };
  }

  if (candidates.length > 0) {
    return {
      status: "unclear",
      confirmedTopicIds: [],
      disambiguationQuestion: buildDisambiguationQuestion(candidates),
      reason: "Retrieved candidates require user disambiguation."
    };
  }

  return {
    status: "absent",
    confirmedTopicIds: [],
    disambiguationQuestion: null,
    reason: "No candidates available."
  };
}

function buildDisambiguationQuestion(candidates: SimilarIssueTopicCandidate[]): string {
  const titles = candidates.slice(0, 3).map((candidate) => candidate.title).join(", ");
  return `Votre problème peut correspondre à plusieurs cas proches (${titles}). Pouvez-vous préciser lequel ressemble le plus à votre situation ?`;
}

export {analyzeSimilarIssueTopics};
export type {SimilarIssueTopicAnalysisOutput};
