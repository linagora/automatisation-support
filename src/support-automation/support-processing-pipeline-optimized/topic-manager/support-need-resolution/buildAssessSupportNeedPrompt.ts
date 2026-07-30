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
- previousSupportNeedResolution: previous classification for this same topic.
- previousTopicSummary: previous summary for this same topic.

Use topicUpdatePlan.title, topicUpdatePlan.summaryTopic, and topicUpdatePlan.supportDomain as the primary scoped context.
Use currentUserMessage only as the latest contribution to this same scoped topic.
currentUserMessage may be short, incomplete, or only answer a previous question.

# Continuity rule

If previousSupportNeedResolution has a non-unclear supportNeed, keep it by default.

Change the previous supportNeed only when the latest scoped topic clearly and explicitly changes the user's need.

Do not change supportNeed just because the latest message contains only:
- environment details;
- device, OS, browser, app version, identifiers, dates, scope, screenshots, URLs, or other case details;
- the result of a requested attempted action;
- a short reply to a previous support question;
- additional facts for an existing issue.

A short factual reply inside an existing issue-resolution topic remains issue_resolution.

Example:
Previous supportNeed: issue_resolution.
Topic: messages disappear after clicking a notification.
Latest message: "Windows Version 2.15 iPhone 13 Pro".
=> supportNeed: issue_resolution.

Example:
Previous supportNeed: issue_resolution.
Latest message: "I tried refreshing and it still fails."
=> supportNeed: issue_resolution.

Example:
Previous supportNeed: issue_resolution.
Latest message: "Actually, I just want to know where the notification settings are."
=> supportNeed may change to knowledge_answer.

# Categories

Choose:
- issue_resolution: the user reports a bug, malfunction, blocked flow, error, unexpected behavior, failed action, missing result, or result different from what they expected.
- knowledge_answer: the scoped topic is a question asking how to do something, where something is, or requesting information/explanation.
- support_action: the scoped topic asks support to perform a concrete action on a concrete object.
- feature_request: the scoped topic asks for a missing capability or product improvement.
- unclear: the need is too vague or ambiguous to classify safely.

Important distinctions:
- If the topic describes steps plus a failed or unexpected result, choose issue_resolution.
- If observed_result and expected_result describe a mismatch, choose issue_resolution.
- If the user provides requested case details for an existing issue, keep issue_resolution.
- If the user provides environment details, identifiers, or device information for an existing issue, keep issue_resolution.
- Do not choose knowledge_answer merely because the latest message is informational.
- Do not choose support_action merely because the user mentions support.
- Do not choose feature_request unless the user clearly asks for a new or missing capability.
- Use unclear only when there is no previous non-unclear supportNeed and choosing another category would require guessing.

# Ambiguity rule

When there is uncertainty:
- prefer the previous non-unclear supportNeed for this same topic;
- otherwise use the strongest evidence in topicUpdatePlan.summaryTopic;
- do not switch categories based on a short follow-up message alone.

If supportNeed is not "unclear", unclearReason must be null.
If supportNeed is "unclear", unclearReason must be non-null and use the accepted catalog.
reason must be short and grounded in the scoped topic and latest message.

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