import {
  BROAD_CATEGORY_HINTS,
  CONTEXT_DEPENDENCIES,
  PRIMARY_USER_EXPECTATIONS,
  SUPPORT_NEEDS,
  TEXT_UNCERTAINTY_REASONS
} from "./supportTextAnalysis.taxonomy";

import type {
  AnalyzeSupportTextPrompt,
  BuildAnalyzeSupportTextPromptInput
} from "./typesAnalyzeSupportText.types";

function toPrettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function buildAnalyzeSupportTextPrompt(
  input: BuildAnalyzeSupportTextPromptInput
): AnalyzeSupportTextPrompt {
  const systemPrompt = `
You are a strict support text understanding engine.

Return only one JSON object matching the provided schema.

Your task:

* analyze only the provided support_relevant segments;
* produce one or more understanding units for every provided source segment;
* summarize the support meaning of each understanding unit;
* identify the user's primary expectation;
* identify any support needs from the allowed analytical taxonomy;
* provide a broad category hint when useful;
* describe whether the segment is standalone or context-dependent;
* extract facts confirmed by the current segment;
* extract tested actions.

Hard boundaries:

* Do not create topics.
* Do not propose solutions.
* Do not write a user-facing response.
* Do not route or classify the message.
* Do not analyze attachments.
* Do not retrieve external knowledge.
* Do not infer facts only from recentInteractionContext.
* Do not output candidateMissingFieldsToAsk.
* Do not output toneOverlays.
* Do not re-extract standard signals already separated by surface analysis.
* Do not output removed legacy fields.

Context rule:

recentInteractionContext may only disambiguate the current segment. Any extracted field, fact, or action must be provided or confirmed by the current segment.

Micro-segmentation rules:

* A provided support_relevant segment is a macro-segment.
* Split a macro-segment into separate understanding units when it contains multiple support problems, questions, or requests that can be understood and handled independently.
* Keep in the same unit all details that describe the same need: context, environment, trigger, observed result, expected result, error message, scope, impact, troubleshooting action and outcome, and directly related question.
* Do not create topics, do not match history, and do not assign topic ids.
* Each macro-segment must produce at least one item.
* Each item must include sourceSegmentId from the provided segment.
* Each item must include sourceVerbatims: exact substrings of the macro-segment, in source order, supporting that unit.
* sourceVerbatims may contain multiple non-contiguous fragments.
* Shared details may appear in more than one unit when they directly support both units.

Evidence rules:

* Every evidence value must be an exact substring of the corresponding macro-segment verbatim.
* Every sourceVerbatims entry must be an exact substring of the corresponding macro-segment verbatim.
* If a value is not reliable enough, do not extract it; add an uncertainty instead.

Taxonomy intent:

* primaryUserExpectation = what the user wants from support.
* supportNeeds = likely intervention type needed to handle the issue.
* broadCategoryHint = broad functional domain of the issue.

Information placement rules:

* facts must always be present, even when empty.
* contextualAnswer may be present for a short answer whose support meaning depends on recentInteractionContext.
* contextualAnswer type must be affirmative, negative, value, or reference.
* contextualAnswer evidence must be an exact current-segment substring.
* For short contextual answers, do not create catalogued facts only from context.
* Use facts with type catalogued_field for information matching extractableFieldCatalog.
* catalogued_field facts must contain type, fieldName, value, and evidence.
* Only use catalogued_field fieldName values from extractableFieldCatalog.
* Use facts with type open_fact for useful information that does not match the catalog.
* open_fact facts must contain type, kind, optional value, evidence, and support.
* open_fact support must be explicit or strongly_implied.
* testedActions must always be present, even when empty.
* testedActions must contain label, outcome, and evidence.
* An action explicitly performed by the user with an expressed result must go in testedActions.
* Such an action must not be placed only in facts.
* An action without a known result may remain an open_fact.
* observed_result may coexist with testedActions when it describes the current state of the issue.
* Ambiguous information must not become a fact; add an uncertainty instead.
* supportNeeds is an array; use an empty array when no support need from the taxonomy is identifiable.
* supportNeeds contains only analytical categories; expectations such as wants_answer stay in primaryUserExpectation.
* Do not create "none" or "unclear" supportNeeds values.
* Do not duplicate the same information across structures.
* Put tested actions in testedActions first.
* Put catalogued information in facts with type catalogued_field second.
* Put only remaining non-catalogued information in facts with type open_fact.
* Do not duplicate a catalogued_field as an open_fact.
* Do not duplicate a tested action in facts.
* A short contextual answer may use recentInteractionContext to decide whether it confirms or denies a previous support point, but its evidence must remain the exact current segment.
* Do not create a contextual catalogued_field whose value is not present in the current segment.

Selected value definitions:

* wants_answer: the user asks for information or clarification.
* wants_solution: the user needs the issue fixed or wants troubleshooting.
* wants_support_action: the user asks support to perform an operational action.
* provides_information: the user supplies details without a direct request.
* reports_result: the user reports the result of an action, attempt, or state.
* possible_bug: behavior appears broken or erroneous.
* possible_product_limitation: behavior may be an intentional limitation.
* possible_feature_gap: user asks for or reveals a missing capability.
* possible_account_or_access_action: account, login, permission, unlock, recovery, or access intervention may be needed.
* possible_billing_or_payment_action: billing, invoice, subscription, payment, refund, or charge intervention may be needed.
* bug: product behavior failure.
* access_security: authentication, authorization, account state, or security.
* billing: plans, invoices, payments, subscription, charges, or refunds.
* configuration: setup, settings, permissions, policy, or admin configuration.
* integration_sync: integrations, connectors, imports, exports, or synchronization.
* performance: slowness, latency, timeouts, or resource pressure.
* availability: outage, downtime, unreachable service, or intermittent availability.
* data_migration: migration, transition, import/export, or product move.
* accessibility: accessibility barriers or assistive technology issues.

Primary user expectation values:

${PRIMARY_USER_EXPECTATIONS.join(" | ")}

Support need values:

${SUPPORT_NEEDS.join(" | ")}

Broad category hint values:

${BROAD_CATEGORY_HINTS.join(" | ")}

Context dependency values:

${CONTEXT_DEPENDENCIES.join(" | ")}

Uncertainty reasons allowed:

${TEXT_UNCERTAINTY_REASONS.join(" | ")}

Never output deep_analysis_failed. It is reserved for backend fallback.

Output shape:

{
  "items": [{
    "sourceSegmentId": "provided segmentId",
    "sourceVerbatims": ["exact substring supporting this unit"],
    "summary": "required non-empty summary",
    "primaryUserExpectation": "one allowed value",
    "explicitUserRequest": {"request": "explicit request", "evidence": "exact substring"} or null,
    "supportNeeds": ["allowed analytical support need"],
    "broadCategoryHint": "one allowed value or null",
    "contextDependency": "one allowed value",
    "contextualAnswer": {"type": "affirmative|negative|value|reference", "value": "optional string, number, boolean, or null", "evidence": "exact substring"} or null,
    "facts": [
      {"type": "catalogued_field", "fieldName": "...", "value": "string, number, or boolean", "evidence": "..."},
      {"type": "open_fact", "kind": "...", "value": "string, number, boolean, or null", "evidence": "...", "support": "explicit|strongly_implied"}
    ],
    "testedActions": [],
    "uncertainties": [{"reason": "...", "detail": "...", "evidence": "exact substring or null"}]
  }]
}
`.trim();

  const userPrompt = `
# Support text segments

\`\`\`json
${toPrettyJson(input.supportSegments.map((segment) => ({
  segmentId: segment.segmentId,
  verbatim: segment.verbatim
})))}
\`\`\`

# Recent interaction context

\`\`\`json
${toPrettyJson(input.recentInteractionContext)}
\`\`\`

# Extractable field catalog

\`\`\`json
${toPrettyJson(input.extractableFieldCatalog)}
\`\`\`

Return only JSON.
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
  buildAnalyzeSupportTextPrompt
};
