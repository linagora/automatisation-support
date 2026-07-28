import {getDeepIssueFieldAskPrompt, getDeepIssueFieldAskType} from "../qualificationRules.catalog";

import type {LLMMessage} from "../../../../../../infrastructure/llm/llm-client";
import type {LiveMemoryTopicOptimized} from "../../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";

type DeepQualification = LiveMemoryTopicOptimized["sourceTopicManager"]["deepQualification"];
type FieldToAsk = DeepQualification["caseDetailsToAskBecauseOfDeepQualification"][number] & {status: "asking"};

type FormattedFieldToAsk = {
  key: string | null;
  reason: string | null;
  askGuidance: string;
  askType: "contextual_problem_detail" | "simple_factual_detail";
};

export type IssueDeepQualificationAskPromptInput = {
  currentUserMessage: {content: string; channel?: string};
  previousConversationTurn: {
    previousUserMessage: string | null;
    previousBotMessage: string | null;
  };
  fieldsToAsk: FieldToAsk[];
  userFacingInformation: string | null;
};

function buildIssueDeepQualificationAskPrompt(input: IssueDeepQualificationAskPromptInput): {messages: LLMMessage[]} {
  const formattedFieldsToAsk = input.fieldsToAsk.map(formatFieldForPrompt);

  return {
    messages: [
      {
        role: "system",
        content: `You write a concise customer-facing clarification message for a support issue.

Rules:
- Write in English.
- Return only JSON.
- Do not expose internal field keys.
- Do not claim the issue is solved.
- Do not ask for information that is already present.
- Use the ask guidance as meaning, not as final wording.
- If the user may not have one detail, say they can tell us if they cannot provide it.
- If userFacingInformation contains useful context from similar cases, use it to ask a more targeted first paragraph.
- If userFacingInformation is null or not useful for a question, do not invent a knowledge-based paragraph.
- The final say should have at most two paragraphs.
- Paragraph 1, when useful: smart contextual questions based on the issue context and userFacingInformation.
- Paragraph 2, when useful: simple factual details requested naturally from the simple_factual_detail fields.
- Do not output bullet lists unless the question is much clearer that way.`
      },
      {
        role: "user",
        content: JSON.stringify({
          currentUserMessage: input.currentUserMessage,
          previousConversationTurn: input.previousConversationTurn,
          userFacingInformation: input.userFacingInformation,
          contextualProblemDetailsToAsk: formattedFieldsToAsk.filter((field) => field.askType === "contextual_problem_detail"),
          simpleFactualDetailsToAsk: formattedFieldsToAsk.filter((field) => field.askType === "simple_factual_detail"),
          outputShape: {say: "<customer-facing message in English>"}
        }, null, 2)
      }
    ]
  };
}

function buildDeterministicDeepQualificationAsk(input: {
  fieldsToAsk: FieldToAsk[];
  userFacingInformation: string | null;
}): string {
  const contextualPrompts = input.fieldsToAsk
    .filter((field) => getDeepIssueFieldAskType(field.key) === "contextual_problem_detail")
    .map((field) => getDeepIssueFieldAskPrompt(field.key));

  const simplePrompts = input.fieldsToAsk
    .filter((field) => getDeepIssueFieldAskType(field.key) === "simple_factual_detail")
    .map((field) => getDeepIssueFieldAskPrompt(field.key));

  const paragraphs: string[] = [];

  if (contextualPrompts.length > 0 || input.userFacingInformation) {
    paragraphs.push([
      input.userFacingInformation
        ? "Based on what we can already infer from similar cases, I need one more precise detail to narrow this down."
        : "I need one more precise detail to narrow this down.",
      ...contextualPrompts
    ].join(" "));
  }

  if (simplePrompts.length > 0) {
    paragraphs.push(`${simplePrompts.join(" ")} If you cannot provide one of these details, just say so and I can continue with what is available.`);
  }

  return paragraphs.length > 0
    ? paragraphs.join("\n\n")
    : "Could you share a bit more detail about the issue so I can narrow it down?";
}

function formatFieldForPrompt(field: FieldToAsk): FormattedFieldToAsk {
  return {
    key: field.key,
    reason: field.reason,
    askGuidance: getDeepIssueFieldAskPrompt(field.key),
    askType: getDeepIssueFieldAskType(field.key)
  };
}

export {
  buildDeterministicDeepQualificationAsk,
  buildIssueDeepQualificationAskPrompt
};
