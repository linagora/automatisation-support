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

# Core decision principle
Prefer "unclear" when the current user intent, the object of the request, or the expected support outcome is not explicit enough.

A non-unclear supportNeed must be supported by concrete evidence from the latest user message or latest source understandings.
Do not infer a clear supportNeed only from a vague topic title, a vague summaryTopic, or a broad supportDomain.

supportDomain is only a hint. It must never force the supportNeed.
A topic with supportDomain "support_process" can still be "unclear".
A topic with supportDomain "product_capability" can still be "knowledge_answer", "issue_resolution", or "unclear".

# When to use "unclear"
Use "unclear" when the topic does not contain enough concrete information to choose one supportNeed confidently.

Use "unclear" especially when:
- the user only says they want to report, signal, escalate, mention, or tell support "something" without stating what the thing is;
- the user says they have a request for support but does not state the request;
- the user says they need help but does not describe the problem, question, or expected action;
- the message could be either a how-to question, a product issue, a feature request, or a support action;
- the object of the requested support action is missing;
- the expected outcome is missing;
- the latest message is a refusal or inability to answer a qualification question, such as "I cannot answer that question";
- the model would need to guess missing facts to choose a non-unclear supportNeed.

Examples that should usually be "unclear":
- "Je souhaite faire part au support de quelque chose"
- "Je veux signaler quelque chose"
- "J’ai une demande pour le support"
- "Je veux parler au support"
- "Je ne peux pas répondre à cette question"
- "Je ne peux pas te donner ce champ"
- "I want to report something"
- "I have a support request"

# Support need rules
Use "issue_resolution" only when the topic clearly describes a problem, malfunction, blocked state, error, failed workflow, unexpected behavior, or abnormal result that needs investigation or resolution.

Examples:
- "The folder creation window closes, but the folder is not created."
- "I get an error when logging in."
- "The CC field is not visible when I try to send an email."
- "The sync fails with status 403."

Use "knowledge_answer" only when the topic clearly asks for information, explanation, how-to guidance, policy, pricing, compatibility, availability, or support knowledge.

Examples:
- "How do I create a folder?"
- "How can I share a Drive link?"
- "Where is the CC field?"
- "Can I send an email to several recipients?"

Use "support_action" only when the user clearly asks the support team to perform a concrete action on a concrete object.

The request must contain both:
1. a concrete action for support to perform;
2. a concrete object, account, item, request, ticket, invoice, access, user, file, or situation to act on.

Examples that may be "support_action":
- "Please ask support to reset access for account 123."
- "Can support verify my June invoice?"
- "Please escalate ticket ABC-123."
- "Please unlock my account."
- "Please refund order 456."

Do not use "support_action" merely because the user mentions support.
Do not use "support_action" for vague reporting intent.
Do not use "support_action" when the user has not said what support should do.
Do not use "support_action" when the user only says they want to report something.

Use "feature_request" only when the topic clearly asks for a missing capability, desired product improvement, product gap, or enhancement request.

Examples:
- "I want the app to support scheduled emails."
- "It would be useful to have a CC field."
- "Can you add bulk export?"

Do not use "feature_request" when the user is simply unable to find an existing feature.
If the user says they cannot find a feature and might need guidance, prefer "knowledge_answer" or "issue_resolution" depending on the wording.
If it is not clear whether the feature exists or is missing, use "unclear".

# Ambiguous product-capability cases
When the user says a field, button, page, or option is missing, distinguish carefully:

Use "knowledge_answer" if the user is mainly asking how to find or use it.
Example: "Where is the CC field?"

Use "issue_resolution" if the user expected it to be visible or working, but it is unavailable, hidden, broken, or behaves unexpectedly.
Example: "I don't see the CC field even though I need to add recipients."

Use "feature_request" only if the user clearly requests a new capability or says the product does not offer it.

Use "unclear" if you cannot distinguish between these cases without guessing.

# Handling refusal or inability to answer
If the latest user message says they cannot answer a requested clarification, do not repeat the same classification blindly.
Do not classify that as "support_action".
Classify the supportNeed based on the concrete information already available.
If the remaining supportNeed cannot be confidently chosen, use "unclear".

# Confidence rule
Before choosing any non-unclear supportNeed, verify that:
- the user’s concrete need is identifiable;
- the requested outcome is identifiable;
- no major interpretation is being guessed;
- the latest evidence supports the chosen supportNeed.

If any of these checks fail, choose "unclear".

# Output rules
If supportNeed is not "unclear", unclearReason must be null.
If supportNeed is "unclear", unclearReason must be non-null and must use the most specific accepted unclear reason from the catalog.
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
