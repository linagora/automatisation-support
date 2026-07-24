import {getBasicIssueFieldAskPrompt} from "../qualificationRules.catalog";

import type {LLMMessage} from "../../../../../../../infrastructure/llm/llm-client";
import type {LiveMemoryTopicOptimized} from "../../../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";

type BasicQualification = LiveMemoryTopicOptimized["sourceTopicManager"]["basicQualification"];
type FieldToAsk = BasicQualification["caseDetailsToAskBecauseOfBasicQualification"][number] & {status: "asking"};
type FieldAskKind = "contextual_problem_detail" | "simple_factual_detail";

type PromptField = {
  key: string | null;
  reason: string | null;
  askGuidance: string;
  askKind: FieldAskKind;
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
  const promptFields = input.fieldsToAsk.map(formatFieldForPrompt);
  const contextualProblemDetails = promptFields.filter((field) => field.askKind === "contextual_problem_detail");
  const simpleFactualDetails = promptFields.filter((field) => field.askKind === "simple_factual_detail");

  return {
    messages: [
      {
        role: "system",
        content: `You write an English customer-facing clarification message for a support issue.

The message will be translated later, so write English only.

Your task:
- Ask only for the missing basic qualification details.
- Do not expose internal field keys.
- Use the provided askGuidance as guidance, not as copy-paste final wording.
- Make the answer sound human and useful, not like a raw checklist.

Structure:
- If contextualProblemDetails is not empty, write it first. This paragraph must use the user's actual context to guide them precisely.
- If simpleFactualDetails is not empty, write it second. This paragraph should combine quick factual details such as OS, browser, app version, account identifier, date, device, or environment.
- When both groups are present, write exactly two paragraphs separated by one blank line.
- When only one group is present, write only the relevant paragraph.

Contextual problem details:
- These are details like where exactly the issue happens, what the user clicked, what part of the product is affected, what the expected/observed behavior is, or what action triggers the issue.
- Do not ask them generically when the message gives context. Use the current issue context to make the question easier to answer.

Simple factual details:
- These are practical facts like OS, browser, device, version, account, identifier, date, or affected service.
- Combine them naturally in one compact paragraph.

Final constraints:
- Allow the user to say if they cannot provide a detail.
- Do not claim the issue is solved.
- Do not suggest troubleshooting steps here.
- Return only JSON matching the response schema.`
      },
      {
        role: "user",
        content: JSON.stringify({
          currentUserMessage: input.currentUserMessage,
          previousConversationTurn: input.previousConversationTurn,
          contextualProblemDetails,
          simpleFactualDetails,
          outputShape: {say: "<English customer-facing message>"}
        }, null, 2)
      }
    ]
  };
}

function buildDeterministicBasicQualificationAsk(input: {
  fieldsToAsk: FieldToAsk[];
}): string {
  const promptFields = input.fieldsToAsk.map(formatFieldForPrompt);
  const contextualProblemDetails = promptFields.filter((field) => field.askKind === "contextual_problem_detail");
  const simpleFactualDetails = promptFields.filter((field) => field.askKind === "simple_factual_detail");

  const paragraphs: string[] = [];

  if (contextualProblemDetails.length > 0) {
    paragraphs.push(
      `To understand the issue properly, could you clarify ${joinAskGuidance(contextualProblemDetails)}?`
    );
  }

  if (simpleFactualDetails.length > 0) {
    paragraphs.push(
      `Could you also share these quick details: ${joinAskGuidance(simpleFactualDetails)}?`
    );
  }

  if (paragraphs.length === 0) {
    return "Could you share a few more details about what happened so I can understand the issue properly?";
  }

  return `${paragraphs.join("\n\n")} If you cannot provide one of these details, just say so and I can continue with what is available.`;
}

function formatFieldForPrompt(field: FieldToAsk): PromptField {
  return {
    key: field.key,
    reason: field.reason,
    askGuidance: getBasicIssueFieldAskPrompt(field.key),
    askKind: classifyFieldForAsking(field)
  };
}

function classifyFieldForAsking(field: FieldToAsk): FieldAskKind {
  const key = field.key ?? "";
  const askGuidance = getBasicIssueFieldAskPrompt(field.key).toLowerCase();

  if (isSimpleFactualKey(key)) return "simple_factual_detail";

  if (
    /\b(os|operating system|browser|version|device|account|email|identifier|id|date|period|environment)\b/.test(askGuidance)
  ) {
    return "simple_factual_detail";
  }

  return "contextual_problem_detail";
}

function isSimpleFactualKey(key: string): boolean {
  return SIMPLE_FACTUAL_KEYS.has(normalizeKey(key));
}

function joinAskGuidance(fields: PromptField[]): string {
  return fields
    .map((field) => normalizeAskGuidance(field.askGuidance))
    .filter((askGuidance) => askGuidance.length > 0)
    .join("; ");
}

function normalizeAskGuidance(value: string): string {
  return value.trim().replace(/[?.!]+$/g, "");
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

const SIMPLE_FACTUAL_KEYS = new Set([
  "account_identifier",
  "account_email",
  "user_identifier",
  "workspace_identifier",
  "organization_identifier",
  "tenant_identifier",
  "device",
  "device_model",
  "device_type",
  "operating_system",
  "os",
  "browser",
  "browser_version",
  "app_version",
  "product_version",
  "environment",
  "date",
  "date_or_period",
  "billing_date_or_period",
  "product_or_service",
  "integration_or_connector",
  "sync_target"
]);

export {
  buildDeterministicBasicQualificationAsk,
  buildIssueBasicQualificationAskPrompt
};
