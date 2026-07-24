import {promptCatalogSelection} from "./catalogSelection";
import {outputContractForPrompt} from "./responseFormat";

import type {LLMMessage} from "../../../infrastructure/llm/llm-client";
import type {AssessSupportNeedInput} from "./runSupportNeedResolution";

type AssessSupportNeedLlmRequest = {
  messages: LLMMessage[];
};

function buildAssessSupportNeedPrompt(
  input: AssessSupportNeedInput
): AssessSupportNeedLlmRequest {
  const systemPrompt = `
# Role
You classify the global support need of one support topic.

You do not answer the customer.
You do not decide retrieval.
You do not choose qualification fields.
You do not write a user response.
You do not update memory.
You do not invent missing facts.

# Concept separation
supportDomain = the support domain/topic area already proposed for this topic.
supportNeed = what this topic needs from support overall.

Assess the supportNeed from the topic title, summaryTopic, supportDomain, latest source understandings, latest user message, and recent context.
Do not rely on old topic-branch fields.
The source understandings use summaryMessage, not summary, and they do not contain supportDomain.

# Support need rules
Use "issue_resolution" when the topic needs investigation or resolution of a problem, malfunction, blocked state, error, failed workflow, unexpected behavior, or abnormal result.
Use "knowledge_answer" when the topic primarily needs information, explanation, how-to guidance, policy, pricing, compatibility, availability, or support knowledge.
Use "support_action" when the topic primarily needs support to do, check, change, process, intervene, reset, unlock, refund, escalate, verify, or handle something.
Use "feature_request" when the topic primarily asks for a missing capability, desired product improvement, product gap, or enhancement request.
Use "unclear" when the support need cannot be confidently chosen.

If supportNeed is not "unclear", unclearReason must be null.
If supportNeed is "unclear", unclearReason must be non-null and must use the most specific accepted unclear reason.
Use "too_ambiguous" only when no more specific ambiguity applies.
reason must be short, grounded in the topic and latest source understandings, and must not mention retrieval, catalogue routing, response planning, or memory updates.

# Support need catalog
${renderPromptItems(promptCatalogSelection.supportNeeds)}

# Unclear reason catalog
${renderPromptItems(promptCatalogSelection.supportNeedUnclearReasons)}

# Output JSON shape
${outputContractForPrompt}

Return only JSON.
`.trim();

  const userPrompt = `
# Input

<topic>
${JSON.stringify(input.topic, null, 2)}
</topic>

<currentUserMessage>
${JSON.stringify(input.currentUserMessage, null, 2)}
</currentUserMessage>

<previousConversationTurn>
${JSON.stringify(input.previousConversationTurn, null, 2)}
</previousConversationTurn>

# Input field guide
topic.title is the stable topic title when available.
topic.summaryTopic is the latest topic summary produced by propose-topic-updates.
topic.supportDomain.value is a domain hint, not the support need.
topic.supportDomain.reason explains that domain hint when available.
topic.previousSupportNeedResolution is the previous support need for this topic when available.
topic.sourceUnderstandings are the latest local support understandings. Each understanding may include summaryMessage, caseDetailsExtracted, attemptedActionsExtracted, and other notes.
previousConversationTurn can help interpret short contextual replies, but it is not evidence by itself.
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
