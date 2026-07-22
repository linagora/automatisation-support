import type {LLMMessage} from "../../../../../../../../infrastructure/llm/llm-client";
import type {CurrentUserMessage, PreviousConversationTurn} from "../../../../../runTopicBranch";
import type {IssueProgressState} from "../../../runIssueResolutionBranch";

function buildAssessIssueSolutionUserFeedbackPrompt(input: {issueProgressState: IssueProgressState; currentUserMessage: CurrentUserMessage; previousConversationTurn: PreviousConversationTurn}): {messages: LLMMessage[]} {
  return {
    messages: [
      {
        role: "system",
        content: `You analyze the user's feedback after a support solution was proposed.

Goal:
- Decide whether the user tested the proposed attempted actions.
- Decide whether at least one action solved the issue.
- Do not diagnose a new issue.
- Do not propose a new solution.
- Return only JSON.`
      },
      {
        role: "user",
        content: JSON.stringify({
          currentUserMessage: input.currentUserMessage,
          previousConversationTurn: input.previousConversationTurn,
          attemptedActionsToTry: input.issueProgressState.solution.attemptedActionsToTry,
          outputShape: {
            feedbackStatus: "no_feedback | unclear | some_tested | all_tested | user_declared_unavailable",
            resolutionStatus: "resolved | unresolved | unknown",
            attemptedActionResults: [{action: "<attempted action>", outcome: "success | failed | partial | unknown", evidence: "<user evidence or null>"}],
            reason: "<short reason or null>"
          }
        }, null, 2)
      }
    ]
  };
}

export {buildAssessIssueSolutionUserFeedbackPrompt};
