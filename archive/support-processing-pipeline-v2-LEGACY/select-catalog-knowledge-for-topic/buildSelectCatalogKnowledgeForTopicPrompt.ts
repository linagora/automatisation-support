import type {
  SelectCatalogKnowledgeForTopicInput,
  SelectCatalogKnowledgeForTopicPrompt
} from "./typesSelectCatalogKnowledgeForTopic.types";
import {
  buildCandidateFieldsForTopicSelector
} from "./buildCandidateFieldsForTopicSelector";
import {
  getAnalysisPromptFields
} from "../../../archive/support-catalog-LEGACY";

function toPrettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function compactCatalog(
  catalog: SelectCatalogKnowledgeForTopicInput["extractableFieldCatalog"]
): unknown[] {
  const promptFieldsByKey = new Map(
    getAnalysisPromptFields().caseDetailFields.map((field) => {
      return [field.key, field];
    })
  );

  return catalog.map((field) => ({
    fieldName: field.fieldName,
    label: field.label ?? promptFieldsByKey.get(field.fieldName)?.label,
    description: field.description ??
      promptFieldsByKey.get(field.fieldName)?.description ??
      field.description,
    extractionGuidance: field.extractionGuidance ??
      promptFieldsByKey.get(field.fieldName)?.extractionGuidance,
    askGuidance: field.askGuidance ??
      promptFieldsByKey.get(field.fieldName)?.askGuidance,
    askableByUser: field.askableByUser ?? true
  }));
}

function formatUnansweredRequestedFields(fieldNames: string[]): unknown[] {
  const promptFieldsByKey = new Map(
    getAnalysisPromptFields().caseDetailFields.map((field) => {
      return [field.key, field];
    })
  );

  return fieldNames.map((fieldName) => ({
    fieldName,
    label: promptFieldsByKey.get(fieldName)?.label ?? fieldName
  }));
}

function resolveSelectorInput(input: SelectCatalogKnowledgeForTopicInput): {
  knownFields: SelectCatalogKnowledgeForTopicInput["knownFields"];
  candidateFields: SelectCatalogKnowledgeForTopicInput["candidateFields"];
  candidateDiagnosticFlows: SelectCatalogKnowledgeForTopicInput["candidateDiagnosticFlows"];
} {
  if (input.knownFields && input.candidateFields && input.candidateDiagnosticFlows) {
    return {
      knownFields: input.knownFields,
      candidateFields: input.candidateFields,
      candidateDiagnosticFlows: input.candidateDiagnosticFlows
    };
  }

  const topicSnapshot = input.topicSnapshot ?? input.topicEvidence.topicSnapshot;

  if (!topicSnapshot) {
    return {
      knownFields: input.knownFields ?? [],
      candidateFields: input.candidateFields ?? [],
      candidateDiagnosticFlows: input.candidateDiagnosticFlows ?? []
    };
  }

  const selectorFields = buildCandidateFieldsForTopicSelector({
    topicSnapshot,
    knowledgeEnrichmentPlan: input.knowledgeEnrichmentPlan,
    extractableFieldCatalog: input.extractableFieldCatalog
  });

  return {
    knownFields: input.knownFields ?? selectorFields.knownFields,
    candidateFields: input.candidateFields ?? selectorFields.candidateFields,
    candidateDiagnosticFlows: input.candidateDiagnosticFlows ??
      selectorFields.candidateDiagnosticFlows
  };
}

function buildSelectCatalogKnowledgeForTopicPrompt(
  input: SelectCatalogKnowledgeForTopicInput
): SelectCatalogKnowledgeForTopicPrompt {
  const topicSnapshot = input.topicSnapshot ?? input.topicEvidence.topicSnapshot;
  const unansweredRequestedFieldNames =
    topicSnapshot?.unansweredRequestedFieldNames ?? [];
  const selectorInput = resolveSelectorInput(input);
  const systemPrompt = `
You are a senior support triage specialist.

Return exactly one valid JSON object:
{
  "selectedFieldNames": ["field_a", "field_b"],
  "directQuestionGuidance": {
    "fieldNames": ["field_a"],
    "guidance": "How to ask these direct fields together.",
    "reason": "Why these direct fields are needed."
  } or null,
  "diagnosticFlow": {
    "name": "flow_name",
    "targetFieldNames": ["field_a", "field_b"],
    "attemptedActionsRelevant": true,
    "guidance": "Use the exact catalog flow guidance.",
    "reason": "Why this guided flow is needed."
  } or null,
  "sufficientlyQualified": false,
  "reason": "Brief reason for the selection."
}
Do not write a user-facing response.
Do not decide whether RAG is needed.
Do not plan the final support response.
Do not diagnose or solve the issue.
Do not justify your selection.

# Role

This stage runs in parallel with RAG. RAG output is not available here and must not be assumed.

You receive:
- one merged support topic snapshot;
- fields already known about the topic;
- a short candidate field list;
- optional unanswered requested field memory for this topic.

Your task is to decide:
- which direct atomic fields should be asked now;
- whether one guided diagnostic or clarification flow is needed;
- whether the topic is already sufficiently qualified.

Select the minimal complete set of fields that should be asked now in one efficient support reply.
Do not select every useful field.
Select only the fields that are necessary now.

Direct field questions are for atomic missing information such as platform, browser, error_message, amount, billing_date_or_period, reference_id, or app_version.

Diagnostic flows are for guiding the user to describe an issue or request more precisely, such as exact steps, the trigger action, failure step, observed result, expected result, context before the problem, and attempted actions when relevant.

Use only candidateDiagnosticFlows. Do not invent diagnostic flows.
You may select both direct fields and one diagnostic flow if both are useful.
You may return no direct fields and no diagnostic flow when the topic is sufficiently qualified.

Choose neither too few fields nor too many:
- too few fields causes unnecessary back-and-forth;
- too many fields makes the reply heavy and asks premature information.

Select a field only if knowing it could significantly affect:
- diagnosis;
- priority;
- routing;
- reproduction;
- next support action;
- resolution;
- escalation.

Do not select fields that are merely interesting, nice-to-have, or possibly useful later.
Do not ask for a field that is already clearly provided in knownFields or topicSnapshot.
New user-provided caseDetails and knownFields override older unanswered requested field memory.
Do not ask for expected_result when it is obvious from the issue.
Do not ask for observed_result when the user already described what happens.
When a diagnostic flow has attemptedActionsRelevant true, consider whether asking what the user already tried would help qualification.

# Previous unanswered requested field memory

topicSnapshot.unansweredRequestedFieldNames is internal memory for this same topic.
It contains direct field keys that were already requested or planned in previous bot turns but are still missing from current caseDetails.
Use it as an anti-repetition signal.
Do not quote it to the user.
Do not treat it as new user evidence.

Do not reselect a direct field only because it is still theoretically useful.
If a field is in topicSnapshot.unansweredRequestedFieldNames, avoid asking it again immediately unless it is decisive for support and still useful.
If repeating the same direct request would be low value, prefer one of:
- a softer broader diagnostic request;
- a different useful field;
- a best-effort answer;
- or human review.

# Output rules

Return only fieldName values present in candidateFields.
Do not return a field already present in knownFields.
Do not return a non-askable field.
If directQuestionGuidance is present, its fieldNames must be a subset of selectedFieldNames.
If diagnosticFlow is present, its name must be present in candidateDiagnosticFlows and its guidance must follow the catalog flow guidance.
Do not ask the final question.
Do not answer the user.
If no field or flow is necessary now, return selectedFieldNames as an empty array, directQuestionGuidance null, diagnosticFlow null, sufficientlyQualified true, and explain why in reason.
The order reflects priority.
Return JSON only.
`.trim();

  const userPrompt = `
Select fields to ask for this topic only:

\`\`\`json
${toPrettyJson({
    targetLanguage: input.targetLanguage,
    topicSnapshot: topicSnapshot ?? null,
    unansweredRequestedFields: formatUnansweredRequestedFields(
      unansweredRequestedFieldNames
    ),
    knownFields: selectorInput.knownFields ?? [],
    candidateFields: compactCatalog(selectorInput.candidateFields ?? []),
    candidateDiagnosticFlows: selectorInput.candidateDiagnosticFlows ?? []
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
