import {
  outputJsonShapeForPrompt,
  responseFormat
} from "./responseFormat";
import {promptCatalogSelection} from "./catalogSelection";

import type {LLMMessage} from "../../../infrastructure/llm/llm-client";
import type {RecentInteractionContext} from "../typesPipelineContext";

type SupportTextPromptSegment = {
  segmentId: string;
  verbatim: string;
};

type AnalyzeSupportTextPendingRequestedItems = {
  caseDetailsToAsk: Array<{
    key: string;
    question?: string | null;
    reason: string | null;
    status: string;
  }>;
  attemptedActionsToAsk: Array<{
    action: string | null;
    reason: string | null;
    status: string;
  }>;
};

type BuildAnalyzeSupportTextPromptInput = {
  supportSegments: SupportTextPromptSegment[];
  recentInteractionContext: RecentInteractionContext;
  pendingRequestedItems?: AnalyzeSupportTextPendingRequestedItems;
};

type AnalyzeSupportTextLlmRequest = {
  messages: LLMMessage[];
  responseFormat: typeof responseFormat;
};

const emptyPendingRequestedItems: AnalyzeSupportTextPendingRequestedItems = {
  caseDetailsToAsk: [],
  attemptedActionsToAsk: []
};

function buildAnalyzeSupportTextPrompt(
  input: BuildAnalyzeSupportTextPromptInput
): AnalyzeSupportTextLlmRequest {
  const systemPrompt = `
You extract atomic support facts from the latest user message.

Return structured facts only.
Do not answer the user.
Do not create or route topics.
Do not diagnose.
Do not propose solutions.
Return only JSON matching the requested schema.
`.trim();

  const userPrompt = `
# Input

<support_segments>
${toPromptJson(input.supportSegments)}
</support_segments>

<recent_interaction_context>
${toPromptJson(input.recentInteractionContext)}
</recent_interaction_context>

<pending_requested_items>
${toPromptJson(input.pendingRequestedItems ?? emptyPendingRequestedItems)}
</pending_requested_items>

# Catalogs

Extractable fields:
${renderPromptItems(promptCatalogSelection.extractableFields)}

Attempted action outcomes:
${renderPromptItems(promptCatalogSelection.attemptedActionOutcomes)}

Other keys:
${renderPromptItems(promptCatalogSelection.otherKeys)}

# Task

Extract support information from the latest user message as flat atomic facts.

Return:
- summaryMessage: one short neutral summary of the latest support message;
- userLanguage: the detected language;
- caseDetailsExtracted: concrete support facts;
- attemptedActionsExtracted: actions the user tried to fix, verify, diagnose, recover from, or work around the issue;
- otherExtracted: useful support facts that do not fit elsewhere.

Do not group facts by topic.
Do not decide which topic owns a fact.
The next pipeline step will route facts to topics.

# Core extraction rules

Extract all explicit support facts from the latest message.

One extracted item must represent one fact.
If the user gives two different values for the same field, output two separate facts.
If one fact clearly applies to multiple subjects, output it once.

The same sentence or sequence may support several different fields.
Overlapping evidence is allowed when the fields are different.
Do not skip a precise field just because another field was already extracted from the same words.

Example:
"The issue started last week for chat and two weeks ago for drive."
=> two issue_started_at facts.

Example:
"I click a notification, the app opens the channel, but the message is missing."
=> trigger_action: "click a notification"
=> failure_step: "after the app opens the channel"
=> observed_result: "the message is missing"

# Pending requested items

pending_requested_items are priority targets, not a filter.

If the latest message answers a pending case detail:
- reuse exactly the pending field key.

If the latest message gives the result of a pending attempted action:
- reuse exactly the pending action string;
- choose outcome "success", "failed", "partial", or "unknown".

Still extract other relevant support facts from the latest message.

If the user says a requested detail is unavailable, missing, unknown, impossible to provide, or impossible to test:
- use status "user_declared_unavailable";
- use value null.

Never use status "obtained" with value null.

# Case details

Use caseDetailsExtracted for concrete facts about the product, feature, user flow, failure, environment, scope, timing, identifiers, impact, or evidence availability.

For issue-resolution flow details:
- trigger_action is the normal product action or event that reveals the issue;
- failure_step is where or when the flow fails;
- failure_step describes the moment, screen, or step where the mismatch appears, not the incorrect result itself;
- observed_result is the concrete unexpected result or missing state;
- observed_result describes the incorrect result or missing state, not the flow step;
- expected_result is what the user expected, or the direct obvious normal outcome of the failed action;
- error_message is the exact error/code, or an explicit absence such as "no error message".

When the user describes action -> step -> unexpected result, extract each available field separately.
Do not ignore trigger_action or failure_step just because observed_result was extracted.

# Attempted actions

Use attemptedActionsExtracted only for troubleshooting, verification, recovery, or workaround attempts.

Normal product usage is not an attempted action.
Normal product usage can be a trigger_action.

Examples of normal product usage:
- opening a chat;
- clicking save;
- sending a message;
- uploading a file.

Examples of attempted actions:
- refreshing the page;
- clearing cache;
- trying another browser;
- checking the connection;
- retrying with different settings after the issue happened.

Do not set outcome to "success" only because the user completed the attempted action.
Use "success" only when the issue was solved or the attempted action achieved the requested diagnostic goal.

# Evidence

Each extracted fact must include evidence from the current support segments.
Evidence should include enough local context when possible.

Do not use recent_interaction_context as evidence.
Use recent_interaction_context only to understand short replies such as:
- "yes";
- "no";
- "same";
- "Firefox";
- "since last week";
- "I tried it and it failed".

Do not extract facts from recent_interaction_context itself.

# Summary

summaryMessage is global for the latest message.
It is not a topic summary.
It must not contain a diagnosis, solution, topic decision, or user-facing answer.
Use null only if the message contains no meaningful support information.

# Output JSON shape

${outputJsonShapeForPrompt}

Return only JSON.
`.trim();

  return {
    messages: [
      {role: "system", content: systemPrompt},
      {role: "user", content: userPrompt}
    ],
    responseFormat
  };
}

function toPromptJson(value: unknown): string {
  return JSON.stringify(value);
}

function renderPromptItems(items: Array<{key: string; extractionGuidance?: string}>): string {
  return items.map((item) => buildPromptItem(item)).join("\n");
}

function buildPromptItem(item: {key: string; extractionGuidance?: string}): string {
  return item.extractionGuidance
    ? `* "${item.key}": ${item.extractionGuidance}`
    : `* "${item.key}"`;
}

export {
  buildAnalyzeSupportTextPrompt
};

export type {
  AnalyzeSupportTextLlmRequest,
  AnalyzeSupportTextPendingRequestedItems,
  BuildAnalyzeSupportTextPromptInput,
  SupportTextPromptSegment
};
