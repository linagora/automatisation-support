import type {LLMMessage} from "../../../../../../../infrastructure/llm/llm-client";
import type {CurrentUserMessage, PreviousConversationTurn} from "../../../../runTopicBranch";
import type {IssueProgressState, IssueQualificationField} from "../../runIssueResolutionBranch";

type IssueDeepQualificationAskPromptInput = {
  currentUserMessage: CurrentUserMessage;
  previousConversationTurn: PreviousConversationTurn;
  missingFields: IssueQualificationField[];
  mode: IssueProgressState["deepQualification"]["mode"];
};

function buildIssueDeepQualificationAskPrompt(input: IssueDeepQualificationAskPromptInput): {messages: LLMMessage[]} {
  return {
    messages: [
      {
        role: "system",
        content: `You write a concise customer-facing follow-up question for deeper support diagnosis.

Rules:
- Write in the same language as the current user message when possible.
- Do not expose internal field keys.
- Ask only for information that would materially improve support diagnosis.
- If several details are missing, combine them into one natural message.
- Make the request practical, not bureaucratic.
- Do not give a solution yet.
- Return only JSON.`
      },
      {
        role: "user",
        content: JSON.stringify({
          currentUserMessage: input.currentUserMessage,
          previousConversationTurn: input.previousConversationTurn,
          qualificationMode: input.mode,
          missingFields: input.missingFields.map((field) => ({
            key: field.key,
            label: field.label,
            requirement: field.requirement,
            askGuidance: field.askPrompt,
            askedCount: field.askedCount,
            status: field.status
          })),
          outputShape: {say: "<single customer-facing message>"}
        }, null, 2)
      }
    ]
  };
}

function buildDeterministicDeepQualificationAsk(input: {
  issueProgressState: IssueProgressState;
}): string {
  const fieldsByKey = new Map(input.issueProgressState.deepQualification.fields.map((field) => [field.key, field]));
  const prompts = input.issueProgressState.deepQualification.nextAskFields.map((key) => {
    const field = fieldsByKey.get(key);
    if (!field) return null;

    return field.askedCount >= 1
      ? `${field.askPrompt} If you cannot provide this information, please say so and I can continue with what is available.`
      : field.askPrompt;
  }).filter((value): value is string => Boolean(value));

  return prompts.length > 0
    ? prompts.join(" ")
    : "Could you share any additional context that would help support diagnose this issue more precisely?";
}

export {
  buildDeterministicDeepQualificationAsk,
  buildIssueDeepQualificationAskPrompt
};
export type {IssueDeepQualificationAskPromptInput};
