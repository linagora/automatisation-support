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
  summaryTopic: string | null;
  fieldsToAsk: FieldToAsk[];
};

function buildIssueBasicQualificationAskPrompt(input: IssueBasicQualificationAskPromptInput): {messages: LLMMessage[]} {
  const missingFields = input.fieldsToAsk.map(formatFieldForPrompt);

  return {
    messages: [
      {
        role: "system",
        content: `You write an English customer-facing clarification message for one support issue.

The message will be translated later, so write English only.

You are given:
- supportTopicSummary: a short summary of the single support topic;
- missingFields: the missing basic qualification fields for this topic.

Your goal:
Ask for the missing basic qualification details in a natural way, for this topic only.

Basic qualification is about understanding the user's flow:
- where the issue happens;
- what the user is trying to do;
- where the flow fails;
- what happens;
- what the user expected instead;
- whether an error message or code appears, only if that field is missing.

Rules:
- Ask only about the single topic described by supportTopicSummary.
- Never mention other issues, other problems, or several problems.
- Never say "each problem", "both issues", "these issues", or "your issues".
- Ask only for fields present in missingFields.
- Cover all missing fields, but do not turn them into a raw checklist.
- Prefer one compact paragraph over bullets.
- When several flow details are missing, ask the user to describe the exact flow in one message.
- Use askGuidance to understand each field, not as final wording.
- Do not expose internal field keys.
- Do not ask technical environment questions unless those fields are present.
- Do not ask for screenshots, references, URLs, file type, file extension, or document type unless the matching field is present.
- Do not suggest troubleshooting steps.
- Do not ask the user to try anything.
- Do not claim the issue is solved.
- Allow the user to say they do not know or cannot provide a detail.

Style:
- Sound like a support agent, not a form.
- Use singular wording: "this issue", not "these issues".
- Avoid bullet lists unless the missing fields are unrelated and cannot be naturally combined.
- If error_message is missing, phrase it as optional: "if one appears" or "if any".
- Do not imply there must be an error message.

Return only JSON matching the response schema.`
      },
      {
        role: "user",
        content: JSON.stringify({
          supportTopicSummary: input.summaryTopic,
          missingFields,
          missingFieldKeys: missingFields.map((field) => normalizeKey(field.key ?? "")),
          outputShape: {say: "<English customer-facing message>"}
        }, null, 2)
      }
    ]
  };
}

function buildDeterministicBasicQualificationAsk(input: {
  summaryTopic?: string | null;
  fieldsToAsk: FieldToAsk[];
}): string {
  const missingFields = input.fieldsToAsk.map(formatFieldForPrompt);
  const suffix = "If you do not know or cannot provide one of these details, just say so.";
  const topicPrefix = input.summaryTopic
    ? `About this issue: ${input.summaryTopic}. `
    : "";

  if (missingFields.length === 0) {
    return `${topicPrefix}Could you share a few more details about what happened so I can understand the issue properly? ${suffix}`;
  }

  const hasProduct = hasMissingField(missingFields, "product_or_service");
  const flowFields = missingFields.filter((field) => {
    return FLOW_FIELD_KEYS.has(normalizeKey(field.key ?? ""));
  });
  const nonFlowFields = missingFields.filter((field) => {
    const key = normalizeKey(field.key ?? "");
    return key !== "product_or_service" && !FLOW_FIELD_KEYS.has(key);
  });

  const questions: string[] = [];

  if (hasProduct) {
    questions.push("Which product or service is affected?");
  }

  if (flowFields.length >= 3) {
    questions.push(buildCompactFlowQuestion(flowFields));
  } else if (flowFields.length > 0) {
    questions.push(`Could you clarify ${joinWithCommasAnd(flowFields.map(buildFlowFieldLabel))}?`);
  }

  if (nonFlowFields.length > 0) {
    questions.push(`Could you also clarify ${joinWithCommasAnd(nonFlowFields.map(buildGenericFieldLabel))}?`);
  }

  if (questions.length === 0) {
    return `${topicPrefix}Could you share the missing details about this issue? ${suffix}`;
  }

  return `${topicPrefix}${questions.join(" ")} ${suffix}`;
}

function buildCompactFlowQuestion(fields: PromptField[]): string {
  const labels = fields.map(buildFlowFieldLabel);
  const hasErrorMessage = fields.some((field) => {
    return normalizeKey(field.key ?? "") === "error_message";
  });

  const labelsWithoutError = labels.filter((label) => {
    return label !== "whether any error message or code appears";
  });

  if (labelsWithoutError.length === 0) {
    return "Could you tell me whether any error message or code appears?";
  }

  const flowQuestion = `Could you describe the exact flow for this issue: ${joinWithCommasAnd(labelsWithoutError)}?`;

  if (!hasErrorMessage) {
    return flowQuestion;
  }

  return `${flowQuestion} Please also mention whether any error message or code appears, if any.`;
}

function buildFlowFieldLabel(field: PromptField): string {
  const key = normalizeKey(field.key ?? "");

  if (key === "feature_or_page") return "where it happens";
  if (key === "trigger_action") return "what you do just before the problem";
  if (key === "failure_step") return "the exact step where it fails";
  if (key === "observed_result") return "what happens";
  if (key === "expected_result") return "what you expected instead";
  if (key === "error_message") return "whether any error message or code appears";

  return buildGenericFieldLabel(field);
}

function buildGenericFieldLabel(field: PromptField): string {
  return normalizeAskGuidance(field.askGuidance);
}

function hasMissingField(fields: PromptField[], key: string): boolean {
  return fields.some((field) => {
    return normalizeKey(field.key ?? "") === key;
  });
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

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function joinWithCommasAnd(values: readonly string[]): string {
  const uniqueValues = [...new Set(values.filter((value) => value.trim() !== ""))];

  if (uniqueValues.length === 0) return "";
  if (uniqueValues.length === 1) return uniqueValues[0];
  if (uniqueValues.length === 2) return `${uniqueValues[0]} and ${uniqueValues[1]}`;

  return `${uniqueValues.slice(0, -1).join(", ")}, and ${uniqueValues[uniqueValues.length - 1]}`;
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