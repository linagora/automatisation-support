import {getBasicIssueFieldAskPrompt} from "../qualificationRules.catalog";

import type {LLMMessage} from "../../../../../../../infrastructure/llm/llm-client";
import type {LiveMemoryTopicOptimized} from "../../../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";

type BasicQualification = LiveMemoryTopicOptimized["sourceTopicManager"]["basicQualification"];
type FieldToAsk = BasicQualification["caseDetailsToAskBecauseOfBasicQualification"][number] & {status: "asking"};

type PromptField = {
  key: string | null;
  reason: string | null;
  askGuidance: string;
};

export type IssueBasicQualificationAskPromptInput = {
  currentUserMessage: {content: string; channel?: string};
  previousConversationTurn: {
    previousUserMessage: string | null;
    previousBotMessage: string | null;
  };
  fieldsToAsk: FieldToAsk[];
};

function buildIssueBasicQualificationAskPrompt(input: IssueBasicQualificationAskPromptInput): {messages: LLMMessage[]} {
  const missingFields = input.fieldsToAsk.map(formatFieldForPrompt);

  return {
    messages: [
      {
        role: "system",
        content: `You write an English customer-facing clarification message for a support issue.

The message will be translated later, so write English only.

Your task:
- Ask only for the missing basic qualification fields provided in missingFields.
- Ask for every field in missingFields.
- Do not ask for any detail that is not represented in missingFields.
- Do not add extra diagnostic questions, even if they seem useful.
- Do not expose internal field keys.
- Use askGuidance as the source of truth for what each field means.
- Rephrase askGuidance naturally, but do not expand it into unrelated questions.
- Keep the message compact and human.
- Do not suggest troubleshooting steps.
- Do not ask the user to try anything.
- Do not claim the issue is solved.

Strict constraints:
- If error_message is not in missingFields, do not ask about an error message or code.
- If environment fields are not in missingFields, do not ask about browser, OS, app version, device, or environment.
- If visual_evidence is not in missingFields, do not ask for screenshots, photos, or videos.
- If reference_id is not in missingFields, do not ask for a ticket ID, file ID, order ID, invoice ID, or other reference.
- If provided_url is not in missingFields, do not ask for a URL, link, endpoint, or page address.
- Do not ask for file type, file extension, or document type unless a missing field explicitly asks for it.

If many fields are missing:
- combine them into one compact clarification message;
- the message may be one paragraph or short bullets;
- still cover every missing field exactly once.

If one or more details may be unknown:
- allow the user to say they do not know or cannot provide them.

Return only JSON matching the response schema.`
      },
      {
        role: "user",
        content: JSON.stringify({
          currentUserMessage: input.currentUserMessage,
          previousConversationTurn: input.previousConversationTurn,
          missingFields,
          outputShape: {say: "<English customer-facing message>"}
        }, null, 2)
      }
    ]
  };
}

function buildDeterministicBasicQualificationAsk(input: {
  fieldsToAsk: FieldToAsk[];
}): string {
  const missingFields = input.fieldsToAsk.map(formatFieldForPrompt);
  const suffix = "If you do not know or cannot provide one of these details, just say so.";

  if (missingFields.length === 0) {
    return `Could you share a few more details about what happened so I can understand the issue properly? ${suffix}`;
  }

  const questions = missingFields
    .map((field) => normalizeAskGuidance(field.askGuidance))
    .filter((askGuidance) => askGuidance.length > 0);

  const uniqueQuestions = [...new Set(questions)];

  if (uniqueQuestions.length === 0) {
    return `Could you share the missing details about the issue? ${suffix}`;
  }

  if (uniqueQuestions.length === 1) {
    return `${uniqueQuestions[0]} ${suffix}`;
  }

  return `Could you provide these details: ${joinWithSemicolons(uniqueQuestions)}? ${suffix}`;
}

function formatFieldForPrompt(field: FieldToAsk): PromptField {
  return {
    key: field.key,
    reason: field.reason,
    askGuidance: getBasicIssueFieldAskPrompt(field.key)
  };
}

function normalizeAskGuidance(value: string): string {
  return value.trim().replace(/[?.!]+$/g, "");
}

function joinWithSemicolons(values: readonly string[]): string {
  return values.join("; ");
}

export {
  buildDeterministicBasicQualificationAsk,
  buildIssueBasicQualificationAskPrompt
};