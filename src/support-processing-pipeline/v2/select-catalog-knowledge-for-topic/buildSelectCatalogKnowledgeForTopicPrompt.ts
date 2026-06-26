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
Do not plan the final support response.
Do not diagnose or solve the issue.
Do not invent field names or generic knowledge identifiers.

# Role

This stage runs in parallel with RAG.

Its job is to reduce the provided field catalog to a useful working set for the later topic-only response planner.

The selected fields are not final questions.
They are candidate knowledge slots that may help the planner:
- understand the type of topic;
- qualify the issue when RAG is absent or weak;
- decide what information is missing;
- decide which user question could be useful later;
- use already-known topic facts more precisely.

# Important behavior

Do not select fields only because they are already present.
Do not reject fields only because they are not already present.

You may select:
- fields already present in the topic, when they are useful context;
- missing fields that would be useful to qualify this type of topic;
- fields that would help disambiguate a known issue;
- fields that would help avoid asking a vague generic question.

The goal is a broad but relevant selection, not a final decision about what to ask.

# Topic-only scope

Select fields for the current topic only.

Ignore unrelated topics or unrelated parts of the original user message.

recentInteractionContext is non-authoritative.
Use it only to understand or disambiguate the current topic.
Do not introduce a different topic from recentInteractionContext.

# Selection principles

Select fields that are materially useful for this topic type.

Prefer fields that help qualify:
- the affected product/service/module;
- the affected feature/page/flow;
- the environment;
- the action or event that triggers the issue;
- the observed result;
- the expected result;
- the error message;
- the frequency or scope;
- the user impact;
- account/access/billing/sync/configuration details when relevant.

Select fields broadly enough that the planner has a useful base even if RAG returns nothing.

Do not select an entire category block automatically.
Do not select fields merely because they belong to a broad category.
Do not select fields that would be irrelevant, invasive, or confusing for this topic.

A field already provided may still be selected when:
- it is central to the topic;
- it helps structure the planner context;
- it may need confirmation or precision;
- it helps interpret missing adjacent fields.

A field with askableByUser false may be selected only as internal context.
It must never be treated as a direct user question candidate.

# Field selection examples by topic type

For bug or abnormal behavior topics, useful fields often include:
product_or_service, feature_or_page, platform, operating_system, browser, app_version, device, trigger_action, observed_result, expected_result, error_message, frequency, affected_scope, user_impact, available_workaround.

For access or authentication topics, useful fields often include:
product_or_service, platform, browser, app_version, account_identifier, account_status, access_action, auth_method, recovery_channel, user_role_or_permission, mfa_status, error_message, observed_result.

For billing or payment topics, useful fields often include:
plan_or_subscription, billing_or_payment_status, billing_issue_type, duplicate_billing_impact, billing_provider, amount, currency, billing_date_or_period, payment_method, reference_id, observed_result, expected_result.

For notification topics, useful fields often include:
product_or_service, feature_or_page, platform, operating_system, app_version, device, notification_permission_status, notification_channel_status, trigger_action, observed_result, expected_result, frequency.

For sync or integration topics, useful fields often include:
product_or_service, integration_or_connector, sync_target, sync_status, platform, app_version, trigger_action, observed_result, expected_result, error_message, frequency, affected_scope.

For accessibility topics, useful fields often include:
platform, operating_system, browser, app_version, device, assistive_technology, accessibility_barrier, inaccessible_element, feature_or_page, observed_result, expected_result.

For product question or feature gap topics, useful fields often include:
product_or_service, feature_or_page, question_intent, gap_observed, plan_or_subscription, platform, expected_result, user_impact.

These examples are guidance, not hard rules.

# Visual evidence

Select visual_evidence only when a screenshot, photo, or video would materially help understand the topic.

Do not select visual_evidence by default for every bug.

If the topic evidence says the user cannot provide a screenshot, visual_evidence may still be useful as context only if the later planner should know that visual evidence is unavailable or insufficient.

# Billing caution

For duplicate invoice or duplicate billing wording, select duplicate_billing_impact when useful to distinguish:
- duplicate document/invoice only;
- duplicate payment/charge.

Do not select amount or currency merely because the topic is billing.
Select amount or currency only when financial value is likely useful for this topic.

# Output rules

selectedFieldNames and rejectedFieldNames may contain only fieldName values from the provided extractableFieldCatalog.

selectedGenericKnowledgeIds must be empty unless explicit generic catalog knowledge identifiers are provided in the input.

Use rejectedFieldNames only for fields that are tempting but currently not useful, or useful for auditability.
Do not fill rejectedFieldNames with every unselected catalog field.

Return JSON only.
`.trim();

  const userPrompt = `
Select catalog knowledge for this topic only:

\`\`\`json
${toPrettyJson({
    topicUserMessageContent: input.topicUserMessageContent,
    targetLanguage: input.targetLanguage,
    topicSnapshot: input.topicSnapshot ?? input.topicEvidence.topicSnapshot ?? null,
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
