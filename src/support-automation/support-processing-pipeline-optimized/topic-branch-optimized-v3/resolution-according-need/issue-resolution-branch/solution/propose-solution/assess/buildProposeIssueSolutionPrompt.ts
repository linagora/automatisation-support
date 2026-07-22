import type {LLMMessage} from "../../../../../../../../infrastructure/llm/llm-client";
import type {CurrentUserMessage} from "../../../../../runTopicBranch";
import type {IssueProgressState} from "../../../runIssueResolutionBranch";

function buildProposeIssueSolutionPrompt(input: {issueProgressState: IssueProgressState; currentUserMessage: CurrentUserMessage}): {messages: LLMMessage[]} {
  return {
    messages: [
      {
        role: "system",
        content: `You assess whether selected support knowledge contains a reliable solution for the user's issue.

Rules:
- Use only the selected / confirmed similar topics and support knowledge already present in issueProgressState.
- If a customer-facing solution is safe and directly relevant, return available.
- If knowledge exists but is not relevant enough, return not_relevant.
- If no usable solution exists, return not_found.
- When returning available, also return concrete attemptedActionsToTry: actions the user should try and later report success/failure on.
- Keep attempted actions short, observable, and user-testable.
- Separate customer-facing guidance from support-facing internal summary.
- Do not invent product facts.
- Return only JSON.`
      },
      {
        role: "user",
        content: JSON.stringify({
          currentUserMessage: input.currentUserMessage,
          selectedSimilarTopic: input.issueProgressState.similarTopic.analysis.selectedTopic,
          confirmedSimilarTopics: input.issueProgressState.similarTopic.analysis.confirmedTopics,
          deepQualification: input.issueProgressState.deepQualification,
          outputShape: {
            status: "available | not_found | not_relevant",
            customerFacingSolution: "<safe user-facing solution or null>",
            supportFacingSummary: "<internal support summary or null>",
            confidence: "<number 0-1 or null>",
            attemptedActionsToTry: [{action: "<user-testable action>", evidence: "<why this action was proposed or null>"}]
          }
        }, null, 2)
      }
    ]
  };
}

export {buildProposeIssueSolutionPrompt};
