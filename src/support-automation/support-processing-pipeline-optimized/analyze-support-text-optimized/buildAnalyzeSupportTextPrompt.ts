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
You are a strict support text understanding engine.

Analyze only the provided support_relevant segments from the latest user message.
Extract structured support facts for later topic matching and topic handling.

Do not answer the user.
Do not create, match, merge, update, or classify topics.
Do not classify the global support need.
Do not diagnose root cause.
Do not propose solutions.
Do not choose next questions.
Do not write a user-facing response.

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

Create one understanding per coherent support need.

A user message may contain:
- an answer to a previously requested detail;
- extra details for an existing issue;
- a new independent support subject;
- several independent support subjects.

Do not merge independent support subjects.
Create separate understandings when different products, features, actions, symptoms, expected results, objectives, or blocking points are described.

# Pending requested items

pending_requested_items are not a filter.
You must still extract any relevant support information from the latest message.

However, pending requested items are priority targets.

When pending_requested_items.caseDetailsToAsk contains fields with status "asking":
- interpret the latest user message as a possible answer to those requested fields;
- reuse exactly the requested field key when the message answers it;
- prefer the pending requested key over another less specific key;
- do not ignore a pending field only because the user answered naturally instead of using the field wording.

When pending_requested_items.attemptedActionsToAsk contains actions with status "asking":
- interpret the latest user message as a possible result for those requested actions;
- reuse exactly the requested action string;
- do not translate, shorten, or paraphrase the requested action;
- use outcome "success", "failed", "partial", or "unknown".

# Extraction principles

Use caseDetailsExtracted for concrete facts about the issue:
- what product area is affected;
- what the user is trying to do;
- where or when the flow breaks;
- what actually happens;
- what should normally happen;
- exact errors, identifiers, environment, scope, timing, or evidence when provided.

Use attemptedActionsExtracted only for actions the user tried to fix, verify, diagnose, recover from, or work around the issue.

Normal product usage is not an attempted action.
For example, opening, clicking, typing, validating, sending, renaming, reading, uploading, or creating something as part of the normal workflow should be extracted as case details, not as attempted actions.

If the user explicitly says a requested detail does not exist, is unavailable, cannot be accessed, cannot be provided, or cannot be tested:
- output the requested field or action with status "user_declared_unavailable";
- use value null for case details;
- use outcome "unknown" for attempted actions.

Do not output status "obtained" with value null.

expected_result may be inferred only when it is the direct and obvious normal outcome of the failed user action.

# Context use

Use recent_interaction_context only to interpret short contextual replies such as yes/no, same issue, an ID, a version, a date, a browser, a number, or an answer to the previous bot question.

For normal detailed messages, extract from the current support segments.
Never use recent_interaction_context as evidence.

Evidence must always be exact text from the current support segments.

# Grounding

Every understanding must have sourceSegmentIds.
Every sourceSegmentIds array must contain known segment ids only, without duplicates, in input order.
Every provided segment should be referenced by at least one understanding.

Every evidence value must be an exact substring of one referenced segment verbatim.
Never output evidence that spans multiple segments.
Never normalize, translate, correct, rewrite, shorten, or repair evidence.

If useful information does not fit caseDetailsExtracted or attemptedActionsExtracted, put it in other.
Keep other short.

summaryMessage must be a short neutral local understanding.
No solution, diagnosis, topic decision, support domain, or user-facing answer.

# Final checks

Before returning JSON, verify:
1. Every provided segment is referenced by at least one understanding.
2. Every evidence value is an exact substring of a referenced segment.
3. caseDetailsExtracted.key, attemptedActionsExtracted.outcome, and other.key use only allowed values.
4. Empty arrays are used when there are no caseDetailsExtracted, attemptedActionsExtracted, or other entries.
5. caseDetailsExtracted.status must be "obtained" or "user_declared_unavailable".
6. attemptedActionsExtracted.status must be "obtained" or "user_declared_unavailable".
7. Do not output status "obtained" with value null.
8. When answering a pending case detail, reuse exactly the pending case detail key.
9. When answering a pending attempted action, reuse exactly the pending action string.
10. The output contains no topic update, response plan, diagnosis, solution, or user-facing answer.

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