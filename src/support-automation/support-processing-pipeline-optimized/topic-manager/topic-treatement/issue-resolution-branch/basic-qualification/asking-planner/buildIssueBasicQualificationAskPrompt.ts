import {getBasicIssueFieldAskPrompt} from "../qualificationRules.catalog";

import type {LLMMessage} from "../../../../../../../infrastructure/llm/llm-client";
import type {LiveMemoryTopicOptimized} from "../../../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";

type BasicQualification = LiveMemoryTopicOptimized["sourceTopicManager"]["basicQualification"];
type FieldToAsk = BasicQualification["caseDetailsToAskBecauseOfBasicQualification"][number] & {
  status: "asking";
};

type PromptField = {
  key: string | null;
  reason: string | null;
  askGuidance: string;
};

export type IssueBasicQualificationAskPromptInput = {
  summaryTopic: string | null;
  fieldsToAsk: FieldToAsk[];
};

function buildIssueBasicQualificationAskPrompt(
  input: IssueBasicQualificationAskPromptInput
): {messages: LLMMessage[]} {
  const missingFields = input.fieldsToAsk.map(formatFieldForPrompt);

  return {
    messages: [
      {
        role: "system",
        content: `Write one short English customer-facing support message.

The message will be translated later, so write English only.

You are given:
- supportTopicSummary: a summary of one specific support issue;
- missingFields: the details still needed to understand and reproduce this issue.

Your goal:
Ask for the missing details needed to reproduce the bug.

Instructions:
- Start with: "To help us to reconstitue the steps that led to this issue...""
- Use supportTopicSummary to make the question specific to the reported issue.
- Ask only for details represented in missingFields.
- Do not ask again for information already present in supportTopicSummary.
- Use askGuidance to understand what to ask, but do not copy it directly.
- When several flow details are missing, ask for one chronological description of the user's actions.
- Guide the user to explain, when missing:
  - the steps they follow;
  - the precise step where it fails;
  - what happens at that moment;
  - what they expected instead;
  - any error message or code, if one appears.
- If only one detail is missing, ask one focused question.

Rules:
- Discuss this issue only.
- Never expose internal field names, keys, reasons, or qualification logic.
- Do not ask for details that are not in missingFields.
- Do not suggest troubleshooting or ask the user to try anything.
- Do not ask for screenshots, URLs, references, file types, or technical environment details unless the matching field is present.
- Treat an error message as optional.
- Allow the user to say they do not know.

Style:
- One concise paragraph.
- Natural and specific.
- No greeting, apology, bullet list, or unnecessary closing.
- Do not produce a disconnected list of questions.

Return only JSON matching the response schema.`
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            supportTopicSummary: input.summaryTopic,
            missingFields,
            missingFieldKeys: missingFields.map((field) =>
              normalizeKey(field.key ?? "")
            ),
            outputShape: {
              say: "<English customer-facing message>"
            }
          },
          null,
          2
        )
      }
    ]
  };
}

function buildDeterministicBasicQualificationAsk(input: {
  summaryTopic?: string | null;
  fieldsToAsk: FieldToAsk[];
}): string {
  const missingFields = input.fieldsToAsk.map(formatFieldForPrompt);
  const suffix =
    "If you do not know or cannot provide one of these details, just say so.";

  if (missingFields.length === 0) {
    return `To help us reproduce this bug, could you describe exactly what you did and what happened? ${suffix}`;
  }

  const hasProduct = hasMissingField(missingFields, "product_or_service");

  const flowFields = missingFields.filter((field) =>
    FLOW_FIELD_KEYS.has(normalizeKey(field.key ?? ""))
  );

  const nonFlowFields = missingFields.filter((field) => {
    const key = normalizeKey(field.key ?? "");

    return key !== "product_or_service" && !FLOW_FIELD_KEYS.has(key);
  });

  const requests: string[] = [];

  if (hasProduct) {
    requests.push("which product or service is affected");
  }

  if (flowFields.length > 0) {
    requests.push(buildFlowRequest(flowFields));
  }

  if (nonFlowFields.length > 0) {
    requests.push(
      ...nonFlowFields.map((field) =>
        normalizeAskGuidance(field.askGuidance)
      )
    );
  }

  if (requests.length === 0) {
    return `To help us reproduce this bug, could you provide a little more detail about what happened? ${suffix}`;
  }

  const topicContext = input.summaryTopic?.trim()
    ? ` regarding ${removeTrailingPunctuation(input.summaryTopic.trim())}`
    : "";

  return `To help us reproduce this bug${topicContext}, could you clarify ${joinWithCommasAnd(
    requests
  )}? ${suffix}`;
}

function buildFlowRequest(fields: PromptField[]): string {
  const keys = new Set(
    fields.map((field) => normalizeKey(field.key ?? ""))
  );

  const parts: string[] = [];

  if (keys.has("feature_or_page")) {
    parts.push("where you perform the action");
  }

  if (keys.has("trigger_action")) {
    parts.push("the exact steps you follow");
  }

  if (keys.has("failure_step")) {
    parts.push("the precise step where it fails");
  }

  if (keys.has("observed_result")) {
    parts.push("what happens at that moment");
  }

  if (keys.has("expected_result")) {
    parts.push("what you expected instead");
  }

  if (keys.has("error_message")) {
    parts.push("any error message or code that appears, if any");
  }

  if (parts.length === 0) {
    return "the exact sequence of events";
  }

  return parts.length === 1
    ? parts[0]
    : `the flow step by step, including ${joinWithCommasAnd(parts)}`;
}

function hasMissingField(fields: PromptField[], key: string): boolean {
  return fields.some(
    (field) => normalizeKey(field.key ?? "") === key
  );
}

function formatFieldForPrompt(field: FieldToAsk): PromptField {
  return {
    key: field.key,
    reason: field.reason,
    askGuidance: getBasicIssueFieldAskPrompt(field.key)
  };
}

function normalizeAskGuidance(value: string): string {
  return removeTrailingPunctuation(value.trim());
}

function removeTrailingPunctuation(value: string): string {
  return value.replace(/[?.!]+$/g, "");
}

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function joinWithCommasAnd(values: readonly string[]): string {
  const uniqueValues = [
    ...new Set(values.filter((value) => value.trim() !== ""))
  ];

  if (uniqueValues.length === 0) return "";
  if (uniqueValues.length === 1) return uniqueValues[0];

  if (uniqueValues.length === 2) {
    return `${uniqueValues[0]} and ${uniqueValues[1]}`;
  }

  return `${uniqueValues.slice(0, -1).join(", ")}, and ${
    uniqueValues[uniqueValues.length - 1]
  }`;
}

const FLOW_FIELD_KEYS = new Set([
  "feature_or_page",
  "trigger_action",
  "failure_step",
  "observed_result",
  "expected_result",
  "error_message"
]);

export {
  buildDeterministicBasicQualificationAsk,
  buildIssueBasicQualificationAskPrompt
};