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
Do not create topics.
Do not route facts to topics.
Extract only atomic facts.
Do not add subject hints.
Do not diagnose or propose solutions.

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

Extract support information as flat atomic facts.

Return:
- summaryMessage: one short neutral summary of the latest support message;
- userLanguage: the detected language;
- caseDetailsExtracted: concrete issue facts;
- attemptedActionsExtracted: actions the user tried to solve, verify, or work around the issue;
- otherExtracted: useful support facts that do not fit elsewhere.

Do not group facts by subject.
Do not infer topic ownership.
The next pipeline step will decide which facts belong to which topic.

# Atomic facts

One extracted item must represent one fact.

If the user gives two different values for the same field, output two separate facts.

Example:
"it started last week for chat and two weeks ago for drive"
=> two issue_started_at facts.

If one fact clearly applies to multiple subjects, output it once.
Do not duplicate shared facts here.

Example:
"for both issues, I use Firefox"
=> one browser fact.

# Pending requested items

pending_requested_items are priority targets, not a filter.

If the latest message answers a pending case detail:
- reuse exactly the pending field key.

If the latest message gives the result of a pending attempted action:
- reuse exactly the pending action string;
- choose outcome "success", "failed", "partial", or "unknown".

Still extract other relevant support facts from the latest message.

# Case details

Use caseDetailsExtracted for facts about:
- product or service;
- feature, page, object, or flow;
- user action;
- failure step;
- observed result;
- expected result;
- error message;
- environment;
- scope;
- timing;
- identifiers;
- evidence availability.

If the user says a requested detail is unavailable, missing, unknown, impossible to provide, or impossible to test:
- use status "user_declared_unavailable";
- use value null.

Never use status "obtained" with value null.

expected_result may be inferred only when it is the direct obvious normal outcome of the failed action.

# Attempted actions

Use attemptedActionsExtracted only for actions the user tried to fix, verify, diagnose, recover from, or work around the issue.

Normal product usage is not an attempted action.

Examples of normal product usage:
- opening a chat;
- renaming a file;
- clicking save;
- sending a message;
- uploading a file.

Examples of attempted actions:
- refreshing the page;
- clearing cache;
- trying another browser;
- checking connection;
- renaming with another name after being asked to test it.

Do not set outcome to "success" if the user mention that he succeeded to do the action, but the issue is still present.
# Evidence

Each fact must include evidence from the current support segments.
Evidence should include enough local context when possible.

Prefer:
- "last week for chat"

Over:
- "last week"

Prefer:
- "for both issues, I use Firefox"

Over:
- "Firefox"

Evidence does not need to be perfect, but it must be grounded in the current user message.
Do not use recent_interaction_context as evidence.

# Context

Use recent_interaction_context only to understand short replies.

Examples:
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
