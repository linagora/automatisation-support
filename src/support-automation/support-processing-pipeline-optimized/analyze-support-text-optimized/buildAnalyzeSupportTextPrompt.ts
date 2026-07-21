import {
  outputJsonShapeForPrompt,
  responseFormat
} from "./responseFormat";
import {promptCatalogSelection} from "./catalogSelection";

import type {LLMMessage} from "../../../infrastructure/llm/llm-client";
import type {RecentInteractionContext} from "../../support-processing-pipeline-v2/typesSupportProcessingPipelineV2.types";

type SupportTextPromptSegment = {
  segmentId: string;
  verbatim: string;
};

type BuildAnalyzeSupportTextPromptInput = {
  supportSegments: SupportTextPromptSegment[];
  recentInteractionContext: RecentInteractionContext;
};

type AnalyzeSupportTextLlmRequest = {
  messages: LLMMessage[];
  responseFormat: typeof responseFormat;
};

function buildAnalyzeSupportTextPrompt(
  input: BuildAnalyzeSupportTextPromptInput
): AnalyzeSupportTextLlmRequest {
  const systemPrompt = `
You are a strict support text understanding engine.

Analyze only the provided support_relevant segments from the latest user message.
Produce local support understandings for later topic matching and topic update.

Do not answer the user.
Do not create, match, merge, update, or classify topics.
Do not classify the user's intent here. Do not decide whether this is a new topic or an update to an existing topic. Topic linking is handled later by proposeTopicUpdates. Global support need is assessed later by assessSupportNeed.
Do not diagnose root cause, propose solutions, retrieve knowledge, analyze attachments, choose next questions, or write a response.

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

# Catalogs

Extractable fields:
${renderPromptItems(promptCatalogSelection.extractableFields)}

Attempted action outcomes:
${renderPromptItems(promptCatalogSelection.attemptedActionOutcomes)}

Other keys:
${renderPromptItems(promptCatalogSelection.otherKeys)}

Support domains:
${renderPromptItems(promptCatalogSelection.supportDomains)}

# Task

Create one understanding per coherent support need.

Default assumption: one support_relevant segment often corresponds to one understanding, but surface segmentation may be imperfect.

Split when the text contains distinct issues, questions, requests, features, objectives, corrections, or follow-up details.
Group segments only when they clearly complete the same support need.
A single segment may create several understandings when it contains several independent support needs.

Support-exchange context such as screenshot, proof, attachment, logs, availability, or testing limitation should be attached to the related understanding through sourceSegmentIds and other when it is useful to the local support extraction.
If the segment is only support-process or bot feedback with no concrete business support subject, keep the useful fact as "other" only if it was already routed as support_relevant.

# Context use

Use recent_interaction_context only to interpret short contextual answers such as yes/no, same issue, an ID, a version, a date, a browser, a number, an option choice, or a value answering the bot's previous question.

For normal detailed messages, extract only from current support segments.
For contextual short replies, the interpreted value may rely on recent_interaction_context, but evidence must remain exact current text.

Never use recent_interaction_context as evidence.
Do not infer hidden fields, actions, notes, categories, or topics from context alone.

# Grounding

Every understanding must have sourceSegmentIds.
Every sourceSegmentIds array must contain known segment ids only, without duplicates, in input order.
Every provided segment should be referenced by at least one understanding.

Every evidence value must be an exact substring of one referenced segment verbatim.
Never output evidence that spans multiple segments.
Never normalize, translate, correct, rewrite, shorten, or repair evidence.
If a value is ambiguous, omit it or put the ambiguity in other with key "uncertainty".

# Fields

extractedFields: use only catalogued field keys. Put concrete dossier information here: product/service, feature/page, account, billing, access, environment, device, browser, version, error, behavior, trigger, observed result, expected result, impact, reference, date, quantity, or user-provided value. Do not create free keys.

attemptedActions: create only when the user explicitly tried to solve, verify, diagnose, recover, or work around the issue, and an outcome is expressed or strongly implied. Normal product actions that fail usually belong in extractedFields as trigger_action or observed_result, not attemptedActions.

other: use only catalogued other keys. Put useful support information here only when it does not fit extractedFields or attemptedActions. Keep it short; do not dump the whole message.

summary: write a short neutral local understanding supported by the referenced segments. No solution, diagnosis, next step, topic decision, or unsupported assumption.

supportDomain: choose the support domain/topic area after understanding the unit. It is not the support need, message act, routing, diagnosis, or response planning. Use "unknown" when the unit is too short, too contextual, or not reliably classifiable.

# Final checks

Before returning JSON, verify:
1. Every provided segment is referenced by at least one understanding.
2. Every evidence value is an exact substring of a referenced segment.
3. extractedFields.key, attemptedActions.outcome, other.key, and supportDomain use only allowed values.
4. Empty arrays are used when there are no extractedFields, attemptedActions, or other entries.
5. The output contains no topic update, response plan, diagnosis, solution, or user-facing answer.

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
  BuildAnalyzeSupportTextPromptInput,
  SupportTextPromptSegment
};
