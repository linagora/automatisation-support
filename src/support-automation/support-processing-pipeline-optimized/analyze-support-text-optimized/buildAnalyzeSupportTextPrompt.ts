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

caseDetailsExtracted: use only catalogued field keys. Put concrete dossier information here.

Each item must include:
- status "obtained" when the user provides the value or the fact is directly available in the current message.
- status "user_declared_unavailable" only when the user explicitly says they cannot provide, access, know, test, retrieve, or share that requested field. In that case, use value null and evidence must be the exact sentence or phrase where the user declares it unavailable.

attemptedActionsExtracted: create when the user explicitly tried to solve, verify, diagnose, recover, or work around the issue, and an outcome is expressed or strongly implied.

Each item must include:
- status "obtained" when the user actually tried the action or reports its result.
- status "user_declared_unavailable" only when the user explicitly says they cannot try or perform a relevant requested action. In that case, outcome should be "unknown" unless the message clearly says otherwise, and evidence must be the exact sentence or phrase where the user declares the action unavailable.

other: use only catalogued other keys. Put useful support information here only when it does not fit caseDetailsExtracted or attemptedActionsExtracted. Keep it short; do not dump the whole message.

summaryMessage: write a short neutral local understanding supported by the referenced segments. No solution, diagnosis, next step, topic decision, topic summary, support domain, or unsupported assumption.

# Final checks

Before returning JSON, verify:
1. Every provided segment is referenced by at least one understanding.
2. Every evidence value is an exact substring of a referenced segment.
3. caseDetailsExtracted.key, attemptedActionsExtracted.outcome, and other.key use only allowed values.
4. Empty arrays are used when there are no caseDetailsExtracted, attemptedActionsExtracted, or other entries.
5. caseDetailsExtracted.status must be "obtained" or "user_declared_unavailable".
6. attemptedActionsExtracted.status must be "obtained" or "user_declared_unavailable".
7. Use "user_declared_unavailable" only for explicit user declarations, never by inference.
8. Do not output a support domain field. Support domain is handled later by proposeTopicUpdates.
9. The output contains no topic update, response plan, diagnosis, solution, or user-facing answer.

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
