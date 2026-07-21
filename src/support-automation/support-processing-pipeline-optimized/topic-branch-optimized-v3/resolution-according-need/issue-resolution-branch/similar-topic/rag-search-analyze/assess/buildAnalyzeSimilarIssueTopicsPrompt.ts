import type {LLMMessage} from "../../../../../../../../infrastructure/llm/llm-client";
import type {CurrentUserMessage, PreviousConversationTurn} from "../../../../../runTopicBranch";
import type {IssueProgressState} from "../../../runIssueResolutionBranch";

function buildAnalyzeSimilarIssueTopicsPrompt(input: {
  issueProgressState: IssueProgressState;
  currentUserMessage: CurrentUserMessage;
  previousConversationTurn: PreviousConversationTurn;
}): {messages: LLMMessage[]} {
  return {
    messages: [
      {
        role: "system",
        content: `You analyze raw RAG candidates for a support issue.

Goal:
- Decide whether one or more retrieved topics are clearly about the same underlying support issue.
- If none are relevant, return absent.
- If candidates may be relevant but require a user clarification, return unclear and produce one decisive clarification question.

Rules:
- Do not solve the issue.
- Do not write a full support response.
- Keep disambiguationQuestion customer-facing and concise.
- Return only JSON.`
      },
      {
        role: "user",
        content: JSON.stringify({
          currentUserMessage: input.currentUserMessage,
          previousConversationTurn: input.previousConversationTurn,
          retrievedCandidates: input.issueProgressState.similarTopic.ragSearch.retrievedCandidates,
          currentAnalysis: input.issueProgressState.similarTopic.analysis,
          issueFields: {
            basic: input.issueProgressState.basicQualification.fields,
            deep: input.issueProgressState.deepQualification.fields
          },
          outputShape: {
            status: "identified | unclear | absent",
            confirmedTopicIds: ["<candidate similarTopicId>"],
            disambiguationQuestion: "<question or null>",
            reason: "<short internal reason>"
          }
        }, null, 2)
      }
    ]
  };
}

export {buildAnalyzeSimilarIssueTopicsPrompt};
