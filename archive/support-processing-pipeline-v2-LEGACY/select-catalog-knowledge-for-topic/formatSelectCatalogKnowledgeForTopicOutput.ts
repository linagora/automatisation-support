import type {
  DirectQuestionGuidance,
  ExtractableFieldDefinition,
  SelectedDiagnosticFlow
} from "../typesSupportProcessingPipelineV2.types";
import type {
  CatalogDiagnosticFlow
} from "../../../archive/support-catalog-LEGACY";
import type {
  FormatSelectCatalogKnowledgeForTopicOutputInput,
  RawSelectedCatalogKnowledgeForTopic,
  SelectedCatalogKnowledgeForTopic
} from "./typesSelectCatalogKnowledgeForTopic.types";
import {
  buildCandidateFieldsForTopicSelector
} from "./buildCandidateFieldsForTopicSelector";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const values: string[] = [];

  for (const item of value) {
    if (!isNonEmptyString(item)) {
      return undefined;
    }

    values.push(item.trim());
  }

  return Array.from(new Set(values));
}

function mapSelectedFields(params: {
  fieldNames: string[];
  catalog: ExtractableFieldDefinition[];
}): ExtractableFieldDefinition[] {
  const fieldByName = new Map(params.catalog.map((field) => {
    return [field.fieldName, field];
  }));

  return params.fieldNames.flatMap((fieldName) => {
    const field = fieldByName.get(fieldName);

    return field ? [field] : [];
  });
}

function buildFallback(
  input: FormatSelectCatalogKnowledgeForTopicOutputInput,
  reason: string
): SelectedCatalogKnowledgeForTopic {
  return {
    selectedFieldNames: [],
    selectedFields: [],
    selectedGenericKnowledge: [],
    directQuestionGuidance: null,
    diagnosticFlow: null,
    sufficientlyQualified: false,
    reason,
    scopeReason: `catalog_selection_fallback:${reason}`,
    rejectedFieldNames: [],
    warnings: [reason]
  };
}

function resolveSelectorFields(
  input: FormatSelectCatalogKnowledgeForTopicOutputInput["input"]
): {
  knownFieldNames: Set<string>;
  candidateFields: ExtractableFieldDefinition[];
  candidateDiagnosticFlows: CatalogDiagnosticFlow[];
} {
  if (input.knownFields && input.candidateFields) {
    return {
      knownFieldNames: new Set(input.knownFields.map((field) => {
        return field.fieldName;
      })),
      candidateFields: input.candidateFields,
      candidateDiagnosticFlows: input.candidateDiagnosticFlows ?? []
    };
  }

  const topicSnapshot = input.topicSnapshot ?? input.topicEvidence.topicSnapshot;

  if (!topicSnapshot) {
    return {
      knownFieldNames: new Set(input.knownFields?.map((field) => {
        return field.fieldName;
      }) ?? []),
      candidateFields: input.candidateFields ?? input.extractableFieldCatalog,
      candidateDiagnosticFlows: input.candidateDiagnosticFlows ?? []
    };
  }

  const selectorFields = buildCandidateFieldsForTopicSelector({
    topicSnapshot,
    knowledgeEnrichmentPlan: input.knowledgeEnrichmentPlan,
    extractableFieldCatalog: input.extractableFieldCatalog
  });

  return {
    knownFieldNames: new Set(
      (input.knownFields ?? selectorFields.knownFields).map((field) => {
        return field.fieldName;
      })
    ),
    candidateFields: input.candidateFields ?? selectorFields.candidateFields,
    candidateDiagnosticFlows: input.candidateDiagnosticFlows ??
      selectorFields.candidateDiagnosticFlows
  };
}

function parseDirectQuestionGuidance(params: {
  rawValue: unknown;
  validSelectedFieldNames: string[];
}): DirectQuestionGuidance | null {
  if (params.rawValue === null || params.rawValue === undefined) {
    return null;
  }

  if (!isRecord(params.rawValue)) {
    return null;
  }

  const fieldNames = stringArray(params.rawValue.fieldNames);
  const guidance = params.rawValue.guidance;
  const reason = params.rawValue.reason;

  if (
    !fieldNames ||
    typeof guidance !== "string" ||
    typeof reason !== "string"
  ) {
    return null;
  }

  const validFieldNames = new Set(params.validSelectedFieldNames);
  const filteredFieldNames = fieldNames.filter((fieldName) => {
    return validFieldNames.has(fieldName);
  });

  if (filteredFieldNames.length === 0) {
    return null;
  }

  return {
    fieldNames: filteredFieldNames,
    guidance,
    reason
  };
}

function parseDiagnosticFlow(params: {
  rawValue: unknown;
  candidateDiagnosticFlows: CatalogDiagnosticFlow[];
}): SelectedDiagnosticFlow | null {
  if (params.rawValue === null || params.rawValue === undefined) {
    return null;
  }

  if (!isRecord(params.rawValue) || typeof params.rawValue.name !== "string") {
    return null;
  }

  const rawFlow = params.rawValue;
  const candidateFlow = params.candidateDiagnosticFlows.find((flow) => {
    return flow.name === rawFlow.name;
  });

  if (!candidateFlow) {
    return null;
  }

  const targetFieldNames = stringArray(rawFlow.targetFieldNames);
  const guidance = rawFlow.guidance;
  const reason = rawFlow.reason;

  if (
    !targetFieldNames ||
    typeof guidance !== "string" ||
    typeof reason !== "string"
  ) {
    return null;
  }

  return {
    name: candidateFlow.name,
    targetFieldNames: targetFieldNames.filter((fieldName) => {
      return candidateFlow.targetFieldNames.includes(fieldName);
    }),
    attemptedActionsRelevant:
      rawFlow.attemptedActionsRelevant === true,
    guidance,
    reason
  };
}

function formatSelectCatalogKnowledgeForTopicOutput(
  input: FormatSelectCatalogKnowledgeForTopicOutputInput
): SelectedCatalogKnowledgeForTopic {
  if (input.rawSelectCatalogKnowledgeForTopic.status !== "completed") {
    return buildFallback(
      input,
      input.rawSelectCatalogKnowledgeForTopic.error?.message ??
        "llm_call_failed"
    );
  }

  if (!isRecord(input.rawSelectCatalogKnowledgeForTopic.parsedResponse)) {
    return buildFallback(input, "invalid_or_missing_parsed_response");
  }

  const raw = input.rawSelectCatalogKnowledgeForTopic
    .parsedResponse as RawSelectedCatalogKnowledgeForTopic;
  const selectedFieldNames = stringArray(raw.selectedFieldNames);

  if (!selectedFieldNames) {
    return buildFallback(input, "invalid_selection_contract");
  }

  const selectorFields = resolveSelectorFields(input.input);
  const askableFieldNames = new Set(
    input.input.extractableFieldCatalog.filter((field) => {
      return field.askableByUser !== false;
    }).map((field) => {
      return field.fieldName;
    })
  );
  const candidateFieldNames = new Set(selectorFields.candidateFields.map(
    (field) => {
      return field.fieldName;
    }
  ));
  const validSelectedFieldNames = selectedFieldNames.filter((fieldName) => {
    return candidateFieldNames.has(fieldName) &&
      !selectorFields.knownFieldNames.has(fieldName) &&
      askableFieldNames.has(fieldName);
  });
  const selectedFields = mapSelectedFields({
    fieldNames: Array.from(new Set(validSelectedFieldNames)),
    catalog: selectorFields.candidateFields
  });
  const finalSelectedFieldNames = selectedFields.map((field) => {
    return field.fieldName;
  });
  const diagnosticFlow = parseDiagnosticFlow({
    rawValue: raw.diagnosticFlow,
    candidateDiagnosticFlows: selectorFields.candidateDiagnosticFlows
  });
  const directQuestionGuidance = parseDirectQuestionGuidance({
    rawValue: raw.directQuestionGuidance,
    validSelectedFieldNames: finalSelectedFieldNames
  });

  return {
    selectedFieldNames: finalSelectedFieldNames,
    selectedFields,
    selectedGenericKnowledge: [],
    directQuestionGuidance,
    diagnosticFlow,
    sufficientlyQualified: raw.sufficientlyQualified === true,
    reason: typeof raw.reason === "string" ? raw.reason : undefined,
    scopeReason: "selected_candidate_fields",
    rejectedFieldNames: [],
    warnings: []
  };
}

export {
  formatSelectCatalogKnowledgeForTopicOutput
};
