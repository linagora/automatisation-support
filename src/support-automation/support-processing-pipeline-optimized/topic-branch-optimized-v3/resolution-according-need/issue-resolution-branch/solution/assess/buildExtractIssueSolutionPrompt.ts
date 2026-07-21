import type {LLMMessage} from "../../../../../../../infrastructure/llm/llm-client";
import type {CurrentUserMessage} from "../../../../runTopicBranch";
import type {IssueProgressState} from "../../runIssueResolutionBranch";

function buildExtractIssueSolutionPrompt(input: {
  issueProgressState: IssueProgressState;
  currentUserMessage: CurrentUserMessage;
}): {messages: LLMMessage[]} {
  return {
    messages: [
      {
        role: "system",
        content: `You assess whether the available support knowledge contains a reliable solution for the user's issue.

Rules:
- If a customer-facing solution is safe and directly relevant, return available.
- If knowledge exists but is not sufficiently relevant, return not_relevant.
- If no usable knowledge exists, return not_found.
- Separate customer-facing guidance from support-facing internal summary.
- Do not invent product facts.
- Return only JSON.`
      },
      {
        role: "user",
        content: JSON.stringify({
          currentUserMessage: input.currentUserMessage,
          issueProgressState: input.issueProgressState,
          selectedSimilarTopic: input.issueProgressState.similarTopic.analysis.selectedTopic,
          confirmedSimilarTopics: input.issueProgressState.similarTopic.analysis.confirmedTopics,
          outputShape: {
            status: "available | not_found | not_relevant",
            customerFacingSolution: "<safe user-facing solution or null>",
            supportFacingSummary: "<internal support summary or null>",
            confidence: "<number 0-1 or null>"
          }
        }, null, 2)
      }
    ]
  };
}

export {buildExtractIssueSolutionPrompt};
