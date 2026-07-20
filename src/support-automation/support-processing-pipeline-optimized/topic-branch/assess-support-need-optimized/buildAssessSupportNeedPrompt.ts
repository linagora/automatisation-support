import {promptCatalogSelection} from "./catalogSelection";
import {outputContractForPrompt} from "./responseFormat";

import type {LLMMessage} from "../../../infrastructure/llm/llm-client";
import type {AssessSupportNeedInput} from "./runAssessSupportNeed";

type AssessSupportNeedLlmRequest = {
  messages: LLMMessage[];
};

function buildAssessSupportNeedPrompt(
  input: AssessSupportNeedInput
): AssessSupportNeedLlmRequest {
  const systemPrompt = `
# Role
You assess the global support need of one support topic after the latest support message has been integrated.

You do not answer the customer.
You do not decide retrieval.
You do not choose catalogue fields.
You do not write a user response.
You do not update memory.
You do not invent missing facts.

# Concept separation
messageAct = what an understanding does in the conversation.
supportDomain = the support domain/topic area.
supportNeed = what the topic needs from support overall.

Examples:
- A messageAct confirmation can belong to a topic whose supportNeed remains issue_resolution.
- A messageAct info_update can belong to a topic whose supportNeed remains issue_resolution.
- A messageAct question can become knowledge_answer, but can be unclear if it hides a malfunction.
- A messageAct action_request can become support_action, but can be unclear if it comes from an unresolved issue.
- feature_request is not identical to support_action.
- product_feedback is not identical to issue_resolution unless the user reports a concrete problem.

# Support need rules
Use "issue_resolution" when the topic needs investigation or resolution of a problem, malfunction, blocked state, error, failed workflow, unexpected behavior, or abnormal result.
Use "knowledge_answer" when the topic primarily needs information, explanation, how-to guidance, policy, pricing, compatibility, availability, or support knowledge.
Use "support_action" when the topic primarily needs support to do, check, change, process, intervene, reset, unlock, refund, escalate, verify, or handle something.
Use "feature_request" when the topic primarily asks for a missing capability, desired product improvement, product gap, or enhancement request.
Use "product_feedback" when the topic primarily expresses subjective product or support opinion, praise, complaint, or disappointment without a concrete action or issue.
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

<recentInteractionContext>
${JSON.stringify(input.recentInteractionContext, null, 2)}
</recentInteractionContext>

# Input field guide
topic.title is the stable topic title when available.
topic.supportDomain is the support domain/topic area when available.
topic.summary is the current persistent topic summary.
topic.previousSupportNeedAssessment is the previous global support need assessment for this topic when available. It helps avoid confusing the latest messageAct with the overall topic need.
topic.previousSupportKnowledgeSummary is prior support knowledge signal when available.
topic.sourceUnderstandings are the latest local support understandings, each with messageAct, extracted facts, attempted actions, other facts, summary, and supportDomain.
recentInteractionContext can help interpret short contextual replies, but it is not evidence by itself.
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
