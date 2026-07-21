import {callLLM} from "../../../../../../../infrastructure/llm/llm-client";
import {parseLLMResponse} from "../../../../../../../infrastructure/llm/parseLLMResponse";
import {buildExtractIssueSolutionPrompt} from "./buildExtractIssueSolutionPrompt";
import {extractIssueSolutionResponseFormat} from "./responseFormat";
import {validateExtractIssueSolutionOutput} from "./validateExtractIssueSolutionOutput";

import type {CurrentUserMessage} from "../../../../runTopicBranch";
import type {IssueProgressState} from "../../runIssueResolutionBranch";
import type {ExtractIssueSolutionValidatedOutput} from "./validateExtractIssueSolutionOutput";

type IssueSolutionExtractionOutput = {
  status: "processed" | "fallback";
  fallbackReason: unknown | null;
  issueProgressState: IssueProgressState;
  solutionAssessment: ExtractIssueSolutionValidatedOutput | null;
};

async function extractIssueSolution(input: {
  issueProgressState: IssueProgressState;
  currentUserMessage: CurrentUserMessage;
}): Promise<IssueSolutionExtractionOutput> {
  const deterministicAssessment = buildDeterministicSolutionAssessment(input.issueProgressState);
  const {messages} = buildExtractIssueSolutionPrompt(input);

  try {
    const result = await callLLM(messages, {
      stage: "issue_solution_extraction",
      preset: "standard",
      temperature: 0,
      maxTokens: 700,
      responseFormat: extractIssueSolutionResponseFormat
    });

    if (!result.success || !result.content) {
      return buildProcessed(input.issueProgressState, deterministicAssessment);
    }

    const parsed = parseLLMResponse(result.content);
    const validated = validateExtractIssueSolutionOutput(parsed);

    return buildProcessed(input.issueProgressState, validated ?? deterministicAssessment);
  } catch {
    return buildProcessed(input.issueProgressState, deterministicAssessment);
  }
}

function buildProcessed(
  issueProgressState: IssueProgressState,
  solutionAssessment: ExtractIssueSolutionValidatedOutput
): IssueSolutionExtractionOutput {
  return {
    status: "processed",
    fallbackReason: null,
    solutionAssessment,
    issueProgressState: {
      ...issueProgressState,
      solution: {
        status: solutionAssessment.status,
        customerFacingSolution: solutionAssessment.customerFacingSolution,
        supportFacingSummary: solutionAssessment.supportFacingSummary,
        confidence: solutionAssessment.confidence,
        fallbackReason: null
      }
    }
  };
}

function buildDeterministicSolutionAssessment(issueProgressState: IssueProgressState): ExtractIssueSolutionValidatedOutput {
  const selectedTopic = issueProgressState.similarTopic.analysis.selectedTopic;

  if (selectedTopic?.solutionSummary) {
    return {
      status: "available",
      customerFacingSolution: selectedTopic.solutionSummary,
      supportFacingSummary: selectedTopic.internalKnowledgeSummary ?? selectedTopic.summary,
      confidence: selectedTopic.score
    };
  }

  return {
    status: selectedTopic ? "not_relevant" : "not_found",
    customerFacingSolution: null,
    supportFacingSummary: selectedTopic?.internalKnowledgeSummary ?? null,
    confidence: selectedTopic?.score ?? null
  };
}

export {extractIssueSolution};
export type {IssueSolutionExtractionOutput};
