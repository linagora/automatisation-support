import {promptCatalogSelection} from "./catalogSelection";
import {outputContractForPrompt} from "./responseFormat";

import type {LLMMessage} from "../../../../infrastructure/llm/llm-client";
import type {AssessSupportNeedInput} from "./runSupportNeedResolution";

type AssessSupportNeedLlmRequest = {
  messages: LLMMessage[];
};

function buildAssessSupportNeedPrompt(
  input: AssessSupportNeedInput
): AssessSupportNeedLlmRequest {
const systemPrompt = `
You classify the support need of one scoped support topic.

You do not answer the user.
You do not route facts.
You do not update memory.
You only choose one supportNeed.

Inputs:
- topicUpdatePlan: latest scoped topic update for this topic.
- currentUserMessage: latest raw user message.
- previousSupportNeedResolution: historical context only.
- previousTopicSummary: historical context only.

Always make a fresh assessment.
previousSupportNeedResolution and previousTopicSummary may be wrong or outdated.
Do not keep the previous supportNeed just because it already exists.

Use topicUpdatePlan.title, topicUpdatePlan.summaryTopic, and topicUpdatePlan.supportDomain to stay focused on this single topic.
currentUserMessage may contain broader context, but do not classify another topic.

Choose:
- issue_resolution: the user reports a bug, malfunction, blocked flow, error, unexpected behavior, failed action, or result different from what they expected.
- knowledge_answer: the user asks how to do something, where something is, or requests information/explanation.
- support_action: the user asks support to perform a concrete action on a concrete object.
- feature_request: the user asks for a missing capability or product improvement.
- unclear: the need is too vague or ambiguous to classify safely.

Important distinctions:
- If the user describes steps plus a failed or unexpected result, choose issue_resolution, not knowledge_answer.
- If observed_result and expected_result describe a mismatch, choose issue_resolution.
- If a window closes, an action validates, but the expected change does not happen, choose issue_resolution.
- Do not choose support_action merely because the user mentions support.
- Do not choose feature_request unless the user clearly asks for a new or missing capability.
- Use unclear when choosing another category would require guessing.

If supportNeed is not "unclear", unclearReason must be null.
If supportNeed is "unclear", unclearReason must be non-null and use the accepted catalog.
reason must be short and grounded in the topicUpdatePlan and currentUserMessage.

# Support need catalog
${renderPromptItems(promptCatalogSelection.supportNeeds)}

# Unclear reason catalog
${renderPromptItems(promptCatalogSelection.supportNeedUnclearReasons)}

# Output JSON shape
${outputContractForPrompt}

Return only JSON.
`.trim();

const userPrompt = `
<topicUpdatePlan>
${JSON.stringify(input.topicUpdatePlan, null, 2)}
</topicUpdatePlan>

<currentUserMessage>
${JSON.stringify(input.currentUserMessage, null, 2)}
</currentUserMessage>

<previousSupportNeedResolution>
${JSON.stringify(input.previousSupportNeedResolution, null, 2)}
</previousSupportNeedResolution>

<previousTopicSummary>
${JSON.stringify(input.previousTopicSummary, null, 2)}
</previousTopicSummary>
`.trim();

  return {
    messages: [
      {role: "system", content: systemPrompt},
      {role: "user", content: userPrompt}
    ]
  };
}

function renderPromptItems(entries: Array<{key: string; extractionGuidance?: string}>): string {
  return entries.map((entry) => buildPromptLine(entry)).join("\n");
}

function buildPromptLine(entry: {key: string; extractionGuidance?: string}): string {
  return entry.extractionGuidance
    ? `* "${entry.key}": ${entry.extractionGuidance}`
    : `* "${entry.key}"`;
}

export {buildAssessSupportNeedPrompt};

export type {AssessSupportNeedLlmRequest};