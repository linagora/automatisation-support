import type {
  SelectCatalogKnowledgeForTopicInput,
  SelectCatalogKnowledgeForTopicPrompt
} from "./typesSelectCatalogKnowledgeForTopic.types";
import {
  buildCandidateFieldsForTopicSelector
} from "./buildCandidateFieldsForTopicSelector";

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

function resolveSelectorInput(input: SelectCatalogKnowledgeForTopicInput): {
  knownFields: SelectCatalogKnowledgeForTopicInput["knownFields"];
  candidateFields: SelectCatalogKnowledgeForTopicInput["candidateFields"];
} {
  if (input.knownFields && input.candidateFields) {
    return {
      knownFields: input.knownFields,
      candidateFields: input.candidateFields
    };
  }

  const topicSnapshot = input.topicSnapshot ?? input.topicEvidence.topicSnapshot;

  if (!topicSnapshot) {
    return {
      knownFields: input.knownFields ?? [],
      candidateFields: input.candidateFields ?? []
    };
  }

  const selectorFields = buildCandidateFieldsForTopicSelector({
    topicSnapshot,
    extractableFieldCatalog: input.extractableFieldCatalog
  });

  return {
    knownFields: input.knownFields ?? selectorFields.knownFields,
    candidateFields: input.candidateFields ?? selectorFields.candidateFields
  };
}

function buildSelectCatalogKnowledgeForTopicPrompt(
  input: SelectCatalogKnowledgeForTopicInput
): SelectCatalogKnowledgeForTopicPrompt {
  const topicSnapshot = input.topicSnapshot ?? input.topicEvidence.topicSnapshot;
  const selectorInput = resolveSelectorInput(input);
  const systemPrompt = `
You are a senior support triage specialist.

Return exactly one valid JSON object:
{
  "selectedFieldNames": ["field_a", "field_b"]
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
- a short candidate field list.

Your task is to select the exact fields that should be asked to the user in the next support reply to qualify the topic precisely.

Select the minimal complete set of fields that should be asked now in one efficient support reply.
Do not select every useful field.
Select only the fields that are necessary now.

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

# Output rules

Return only fieldName values present in candidateFields.
Do not return a field already present in knownFields.
Do not return a non-askable field.
Do not ask the final question.
Do not answer the user.
If no field is necessary now, return {"selectedFieldNames":[]}.
The order reflects priority.
Return JSON only.
`.trim();

  const userPrompt = `
Select fields to ask for this topic only:

\`\`\`json
${toPrettyJson({
    targetLanguage: input.targetLanguage,
    topicSnapshot: topicSnapshot ?? null,
    knownFields: selectorInput.knownFields ?? [],
    candidateFields: compactCatalog(selectorInput.candidateFields ?? [])
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
