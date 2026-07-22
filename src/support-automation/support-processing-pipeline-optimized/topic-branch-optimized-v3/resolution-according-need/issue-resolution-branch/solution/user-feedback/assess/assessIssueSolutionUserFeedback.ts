import {callLLM} from "../../../../../../../../infrastructure/llm/llm-client";
import {parseLLMResponse} from "../../../../../../../../infrastructure/llm/parseLLMResponse";
import {buildAssessIssueSolutionUserFeedbackPrompt} from "./buildAssessIssueSolutionUserFeedbackPrompt";
import {assessIssueSolutionUserFeedbackResponseFormat} from "./responseFormat";
import {validateAssessIssueSolutionUserFeedbackOutput} from "./validateAssessIssueSolutionUserFeedbackOutput";

import type {CurrentUserMessage, PreviousConversationTurn} from "../../../../../runTopicBranch";
import type {IssueProgressState, IssueSolutionAttemptedAction} from "../../../runIssueResolutionBranch";
import type {AssessIssueSolutionUserFeedbackValidatedOutput} from "./validateAssessIssueSolutionUserFeedbackOutput";

type IssueSolutionUserFeedbackAssessOutput = {
  status: "processed" | "fallback";
  fallbackReason: unknown | null;
  issueProgressState: IssueProgressState;
  feedbackAssessment: AssessIssueSolutionUserFeedbackValidatedOutput | null;
};

async function assessIssueSolutionUserFeedback(input: {issueProgressState: IssueProgressState; currentUserMessage: CurrentUserMessage; previousConversationTurn: PreviousConversationTurn}): Promise<IssueSolutionUserFeedbackAssessOutput> {
  const deterministicAssessment = buildDeterministicFeedbackAssessment(input.issueProgressState, input.currentUserMessage.content);
  const {messages} = buildAssessIssueSolutionUserFeedbackPrompt(input);

  try {
    const result = await callLLM(messages, {stage: "issue_solution_user_feedback", preset: "standard", temperature: 0, maxTokens: 650, responseFormat: assessIssueSolutionUserFeedbackResponseFormat});
    if (!result.success || !result.content) return buildProcessed(input.issueProgressState, deterministicAssessment);

    const parsed = parseLLMResponse(result.content);
    const validated = validateAssessIssueSolutionUserFeedbackOutput(parsed);
    return buildProcessed(input.issueProgressState, validated ?? deterministicAssessment);
  } catch {
    return buildProcessed(input.issueProgressState, deterministicAssessment);
  }
}

function buildProcessed(issueProgressState: IssueProgressState, feedbackAssessment: AssessIssueSolutionUserFeedbackValidatedOutput): IssueSolutionUserFeedbackAssessOutput {
  const attemptedActionsToTry = mergeAttemptedActionResults(issueProgressState.solution.attemptedActionsToTry, feedbackAssessment.attemptedActionResults);
  const hasSuccess = attemptedActionsToTry.some((action) => action.outcome === "success");
  const pendingCount = attemptedActionsToTry.filter((action) => action.status === "missing_but_asked").length;
  const userDeclaredUnavailable = feedbackAssessment.feedbackStatus === "user_declared_unavailable";
  const solved = feedbackAssessment.resolutionStatus === "resolved" || hasSuccess;
  const unresolved = feedbackAssessment.resolutionStatus === "unresolved" && pendingCount === 0;

  return {
    status: "processed",
    fallbackReason: null,
    feedbackAssessment,
    issueProgressState: {
      ...issueProgressState,
      solution: {
        ...issueProgressState.solution,
        status: "awaiting_user_result",
        attemptedActionsToTry
      },
      idleMode: resolveIdleMode({solved, unresolved, userDeclaredUnavailable, pendingCount, reason: feedbackAssessment.reason})
    }
  };
}

function resolveIdleMode(params: {solved: boolean; unresolved: boolean; userDeclaredUnavailable: boolean; pendingCount: number; reason: string | null}): IssueProgressState["idleMode"] {
  if (params.solved) return {status: "active_solved", resolution: "resolved", reason: params.reason ?? "user_feedback_solution_success"};
  if (params.unresolved || params.userDeclaredUnavailable) return {status: "active_unsolved", resolution: "unresolved", reason: params.reason ?? "user_feedback_solution_failed"};
  return {status: "waiting_user_result", resolution: "unknown", reason: params.pendingCount > 0 ? "waiting_for_remaining_attempted_actions" : "feedback_unclear"};
}

function mergeAttemptedActionResults(existingActions: IssueSolutionAttemptedAction[], feedbackActions: IssueSolutionAttemptedAction[]): IssueSolutionAttemptedAction[] {
  if (feedbackActions.length === 0) return existingActions;
  const normalizedFeedbackByAction = new Map(feedbackActions.map((action) => [normalizeActionKey(action.action), action]));

  const mergedExisting = existingActions.map((action) => {
    const feedback = normalizedFeedbackByAction.get(normalizeActionKey(action.action));
    if (!feedback) return action;
    return {...action, outcome: feedback.outcome, evidence: feedback.evidence ?? action.evidence, status: feedback.status};
  });

  const existingKeys = new Set(mergedExisting.map((action) => normalizeActionKey(action.action)));
  const newFeedbackActions = feedbackActions.filter((action) => !existingKeys.has(normalizeActionKey(action.action)));
  return [...mergedExisting, ...newFeedbackActions];
}

function buildDeterministicFeedbackAssessment(issueProgressState: IssueProgressState, message: string): AssessIssueSolutionUserFeedbackValidatedOutput {
  const normalizedMessage = message.toLowerCase();
  const positive = /\b(merci|ça marche|ca marche|résolu|resolu|c'est bon|fonctionne|parfait|ok ça marche)\b/i.test(normalizedMessage);
  const negative = /\b(ne marche pas|marche pas|toujours pas|pas résolu|pas resolu|échec|echec|failed|non)\b/i.test(normalizedMessage);

  if (positive) {
    return {
      feedbackStatus: "all_tested",
      resolutionStatus: "resolved",
      attemptedActionResults: issueProgressState.solution.attemptedActionsToTry.map((action) => ({...action, outcome: "success", evidence: message, status: "obtained" as const})),
      reason: "deterministic_positive_feedback"
    };
  }

  if (negative) {
    return {
      feedbackStatus: "all_tested",
      resolutionStatus: "unresolved",
      attemptedActionResults: issueProgressState.solution.attemptedActionsToTry.map((action) => ({...action, outcome: "failed", evidence: message, status: "obtained" as const})),
      reason: "deterministic_negative_feedback"
    };
  }

  return {feedbackStatus: "unclear", resolutionStatus: "unknown", attemptedActionResults: [], reason: "deterministic_unclear_feedback"};
}

function normalizeActionKey(action: string): string {
  return action.trim().toLowerCase();
}

export {assessIssueSolutionUserFeedback};
export type {IssueSolutionUserFeedbackAssessOutput};
