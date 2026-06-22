import type {
  SelectCatalogKnowledgeForTopicInput,
  SelectCatalogKnowledgeForTopicPrompt
} from "./typesSelectCatalogKnowledgeForTopic.types";

function toPrettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function compactCatalog(
  catalog: SelectCatalogKnowledgeForTopicInput["extractableFieldCatalog"]
): unknown[] {
  return catalog.map((field) => ({
    fieldName: field.fieldName,
    description: field.description,
    askableByUser: field.askableByUser ?? true
  }));
}

function buildSelectCatalogKnowledgeForTopicPrompt(
  input: SelectCatalogKnowledgeForTopicInput
): SelectCatalogKnowledgeForTopicPrompt {
  const systemPrompt = `
You select catalog knowledge for one support topic only.

Return exactly one valid JSON object matching the schema.
Do not write a user-facing response.
Do not decide whether RAG is needed.
Do not plan the support response.
Do not diagnose or solve the issue.
Do not invent field names or generic knowledge identifiers.

Your only task is to reduce the provided catalog to the elements materially
useful for the topic-only response planner.

Selection rules:
- Select fields only from the current topic evidence.
- Ignore unrelated parts of the original message.
- If a field is relevant to another topic but is not supported by the current
  topic evidence, reject it.
- recentInteractionContext is non-authoritative. Use it only to disambiguate
  current topic evidence, never to introduce another topic.
- Select only fields genuinely useful for this topic.
- Do not select an entire category block automatically.
- A field already provided should usually be rejected unless it remains useful
  to structure or confirm the topic.
- A field with askableByUser false may be selected only as internal context.
  It must never be treated as a potential user question.
- Select visual_evidence only when a screenshot, photo, or video can materially
  help, or when a related attachment exists and its sufficiency matters.
- Do not select visual_evidence by default for bugs.
- For login or password errors, keep only useful fields such as error_message,
  access_action, auth_method, and platform/browser only when materially relevant.
- Do not treat account_status as askable when askableByUser is false.
- For duplicate invoice wording, select duplicate_billing_impact before amount
  or currency. Do not select amount or currency merely because the topic is billing.
- Put known but currently unnecessary fields in rejectedFieldNames when useful
  for auditability.
- selectedFieldNames and rejectedFieldNames may contain only names from the
  provided extractableFieldCatalog.
- selectedGenericKnowledgeIds must be empty unless explicit generic catalog
  knowledge identifiers are provided in the input.

Return JSON only.
`.trim();

  const userPrompt = `
Select catalog knowledge for this topic only:

\`\`\`json
${toPrettyJson({
    topicUserMessageContent: input.topicUserMessageContent,
    targetLanguage: input.targetLanguage,
    topicEvidence: input.topicEvidence,
    recentInteractionContext: input.recentInteractionContext ?? null,
    extractableFieldCatalog: compactCatalog(input.extractableFieldCatalog)
  })}
\`\`\`
`.trim();

  return {
    messages: [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: userPrompt
      }
    ]
  };
}

export {
  buildSelectCatalogKnowledgeForTopicPrompt
};
