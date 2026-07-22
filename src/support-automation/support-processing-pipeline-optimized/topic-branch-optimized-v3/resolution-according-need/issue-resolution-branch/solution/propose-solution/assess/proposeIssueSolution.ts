import {callLLM} from "../../../../../../../../infrastructure/llm/llm-client";
import {parseLLMResponse} from "../../../../../../../../infrastructure/llm/parseLLMResponse";
import {buildProposeIssueSolutionPrompt} from "./buildProposeIssueSolutionPrompt";
import {proposeIssueSolutionResponseFormat} from "./responseFormat";
import {validateProposeIssueSolutionOutput} from "./validateProposeIssueSolutionOutput";

import type {CurrentUserMessage} from "../../../../../runTopicBranch";
import type {IssueProgressState, IssueSolutionAttemptedAction} from "../../../runIssueResolutionBranch";
import type {ProposeIssueSolutionValidatedOutput} from "./validateProposeIssueSolutionOutput";

type IssueSolutionProposalOutput = {
  status: "processed" | "fallback";
  fallbackReason: unknown | null;
  issueProgressState: IssueProgressState;
  solutionProposal: ProposeIssueSolutionValidatedOutput | null;
};

async function proposeIssueSolution(input: {issueProgressState: IssueProgressState; currentUserMessage: CurrentUserMessage}): Promise<IssueSolutionProposalOutput> {
  const deterministicProposal = buildDeterministicSolutionProposal(input.issueProgressState);
  const {messages} = buildProposeIssueSolutionPrompt(input);

  try {
    const result = await callLLM(messages, {stage: "issue_solution_proposal", preset: "standard", temperature: 0, maxTokens: 800, responseFormat: proposeIssueSolutionResponseFormat});
    if (!result.success || !result.content) return buildProcessed(input.issueProgressState, deterministicProposal);

    const parsed = parseLLMResponse(result.content);
    const validated = validateProposeIssueSolutionOutput(parsed);

    return buildProcessed(input.issueProgressState, validated ?? deterministicProposal);
  } catch {
    return buildProcessed(input.issueProgressState, deterministicProposal);
  }
}

function buildProcessed(issueProgressState: IssueProgressState, solutionProposal: ProposeIssueSolutionValidatedOutput): IssueSolutionProposalOutput {
  return {
    status: "processed",
    fallbackReason: null,
    solutionProposal,
    issueProgressState: {
      ...issueProgressState,
      solution: {
        status: solutionProposal.status,
        customerFacingSolution: solutionProposal.customerFacingSolution,
        supportFacingSummary: solutionProposal.supportFacingSummary,
        confidence: solutionProposal.confidence,
        attemptedActionsToTry: solutionProposal.attemptedActionsToTry,
        fallbackReason: null
      }
    }
  };
}

function buildDeterministicSolutionProposal(issueProgressState: IssueProgressState): ProposeIssueSolutionValidatedOutput {
  const selectedTopic = issueProgressState.similarTopic.analysis.selectedTopic;
  const confirmedTopicWithSolution = issueProgressState.similarTopic.analysis.confirmedTopics.find((topic) => typeof topic.solutionSummary === "string" && topic.solutionSummary.trim() !== "");
  const solutionSource = selectedTopic?.solutionSummary ? selectedTopic : confirmedTopicWithSolution;

  if (solutionSource?.solutionSummary) {
    return {
      status: "available",
      customerFacingSolution: solutionSource.solutionSummary,
      supportFacingSummary: solutionSource.internalKnowledgeSummary ?? solutionSource.summary,
      confidence: solutionSource.score,
      attemptedActionsToTry: buildAttemptedActionsFromSolution(solutionSource.solutionSummary)
    };
  }

  return {
    status: selectedTopic ? "not_relevant" : "not_found",
    customerFacingSolution: null,
    supportFacingSummary: selectedTopic?.internalKnowledgeSummary ?? null,
    confidence: selectedTopic?.score ?? null,
    attemptedActionsToTry: []
  };
}

function buildAttemptedActionsFromSolution(solution: string): IssueSolutionAttemptedAction[] {
  return [{action: solution.trim(), outcome: null, evidence: "solution_proposal", status: "missing_but_asked"}];
}

export {proposeIssueSolution};
export type {IssueSolutionProposalOutput};
