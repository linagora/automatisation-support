import type {LLMMessage} from "../../../../../../../infrastructure/llm/llm-client";
import type {PreviousConversationTurn} from "../../../../runTopicBranch";
import type {IssueAttemptedActionSignal, IssueProgressState, IssueQualificationField} from "../../runIssueResolutionBranch";

type IssueBasicQualificationAskPromptInput = {
  currentUserMessage: {content: string};
  previousConversationTurn: PreviousConversationTurn;
  missingFields: IssueQualificationField[];
  attemptedActionSignal: IssueAttemptedActionSignal;
};

function buildIssueBasicQualificationAskPrompt(input: IssueBasicQualificationAskPromptInput): {messages: LLMMessage[]} {
  return {
    messages: [
      {
        role: "system",
        content: `You write a concise customer-facing clarification question for a support issue.

Rules:
- Write in the same language as the current user message when possible.
- Do not expose internal field keys.
- Use the ask guidance as meaning, not as final wording.
- Group simple factual asks naturally.
- When needed, encourage the user to describe the exact action, observed result, and expected result.
- If attempted actions are missing, ask what they already tried, but do not overload the message.
- Do not claim the issue is solved.
- Return only JSON.`
      },
      {
        role: "user",
        content: JSON.stringify({
          currentUserMessage: input.currentUserMessage,
          previousConversationTurn: input.previousConversationTurn,
          missingFields: input.missingFields.map(formatFieldForPrompt),
          attemptedActionSignal: input.attemptedActionSignal,
          outputShape: {say: "<single customer-facing message>"}
        }, null, 2)
      }
    ]
  };
}

function formatFieldForPrompt(field: IssueQualificationField): Record<string, unknown> {
  return {
    key: field.key,
    label: field.label,
    requirement: field.requirement,
    askGuidance: field.askPrompt,
    askedCount: field.askedCount,
    status: field.status
  };
}

function buildDeterministicBasicQualificationAsk(input: {
  issueProgressState: IssueProgressState;
}): string {
  const fieldsByKey = new Map(input.issueProgressState.basicQualification.fields.map((field) => [field.key, field]));
  const fieldPrompts = input.issueProgressState.basicQualification.nextAskFields.map((key) => {
    const field = fieldsByKey.get(key);
    if (!field) return null;

    return field.askedCount >= 1
      ? `${field.askPrompt} If you cannot provide this information, please say so and I can continue with what is available.`
      : field.askPrompt;
  }).filter((value): value is string => Boolean(value));

  if (input.issueProgressState.basicQualification.attemptedActionSignal.shouldAskForAttemptedActions) {
    fieldPrompts.push("Please also mention what you have already tried, if anything, and what happened.");
  }

  return fieldPrompts.length > 0
    ? fieldPrompts.join(" ")
    : "Could you share a few more details about what happened so I can understand the issue properly?";
}

export {
  buildDeterministicBasicQualificationAsk,
  buildIssueBasicQualificationAskPrompt
};
export type {IssueBasicQualificationAskPromptInput};
