import type {
  ExtractableFieldDefinition,
  KnowledgeEnrichmentPlan,
  MergedTopicSnapshot
} from "../typesSupportProcessingPipelineV2.types";
import {
  CASE_DETAIL_FIELDS,
  CATEGORY_CANDIDATE_FIELD_NAMES,
  getCandidateDiagnosticFlowsForCatalogSelection,
  getCandidateFieldsForCatalogSelection
} from "../../support-catalog";
import type {
  CatalogDiagnosticFlow
} from "../../support-catalog";

type KnownTopicField = {
  fieldName: string;
  value: unknown;
  evidence?: string;
};

type TopicSelectorCandidateFields = {
  knownFields: KnownTopicField[];
  candidateFields: ExtractableFieldDefinition[];
  candidateDiagnosticFlows: CatalogDiagnosticFlow[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function addKnownField(
  knownFieldsByName: Map<string, KnownTopicField>,
  field: KnownTopicField
): void {
  if (field.fieldName.trim() === "" || knownFieldsByName.has(field.fieldName)) {
    return;
  }

  knownFieldsByName.set(field.fieldName, field);
}

function buildKnownFields(topicSnapshot: MergedTopicSnapshot): KnownTopicField[] {
  const knownFieldsByName = new Map<string, KnownTopicField>();

  for (const detail of topicSnapshot.caseDetails ?? []) {
    addKnownField(knownFieldsByName, {
      fieldName: detail.key,
      value: detail.value,
      evidence: detail.evidence
    });
  }

  const snapshotRecord = topicSnapshot as unknown as Record<string, unknown>;
  const supportMetadata = snapshotRecord.supportMetadata;

  if (Array.isArray(supportMetadata)) {
    for (const metadata of supportMetadata) {
      if (!isRecord(metadata) || typeof metadata.key !== "string") {
        continue;
      }

      addKnownField(knownFieldsByName, {
        fieldName: metadata.key,
        value: metadata.value,
        ...(typeof metadata.evidence === "string"
          ? { evidence: metadata.evidence }
          : {})
      });
    }
  }

  return Array.from(knownFieldsByName.values());
}

function buildCandidateFieldsForTopicSelector(params: {
  topicSnapshot: MergedTopicSnapshot;
  knowledgeEnrichmentPlan?: KnowledgeEnrichmentPlan;
  extractableFieldCatalog: ExtractableFieldDefinition[];
}): TopicSelectorCandidateFields {
  const catalogByName = new Map(params.extractableFieldCatalog.map((field) => {
    return [field.fieldName, field];
  }));
  const centralFieldByName = new Map<string, typeof CASE_DETAIL_FIELDS[number]>(
    CASE_DETAIL_FIELDS.map((field) => {
    return [field.key, field];
  }));
  const knownFields = buildKnownFields(params.topicSnapshot).filter((field) => {
    return catalogByName.has(field.fieldName);
  });
  const knownFieldNames = new Set(knownFields.map((field) => {
    return field.fieldName;
  }));
  const candidateFieldNames = getCandidateFieldsForCatalogSelection({
    broadIntent: params.knowledgeEnrichmentPlan?.broadIntent?.mode,
    broadCategoryHint: params.topicSnapshot.broadCategoryHint
  });
  const candidateDiagnosticFlows = getCandidateDiagnosticFlowsForCatalogSelection({
    broadIntent: params.knowledgeEnrichmentPlan?.broadIntent?.mode,
    broadCategoryHint: params.topicSnapshot.broadCategoryHint
  });
  const candidateFields = candidateFieldNames.flatMap((fieldName) => {
    const field = catalogByName.get(fieldName);
    const centralField = centralFieldByName.get(fieldName);

    if (!field || knownFieldNames.has(fieldName) || field.askableByUser === false) {
      return [];
    }

    return [{
      ...field,
      ...(centralField?.label ? { label: centralField.label } : {}),
      ...(centralField?.extractionGuidance
        ? { extractionGuidance: centralField.extractionGuidance }
        : {}),
      ...(centralField?.askGuidance
        ? { askGuidance: centralField.askGuidance }
        : {})
    }];
  });

  return {
    knownFields,
    candidateFields,
    candidateDiagnosticFlows
  };
}

export {
  CATEGORY_CANDIDATE_FIELD_NAMES,
  buildCandidateFieldsForTopicSelector
};

export type {
  KnownTopicField,
  TopicSelectorCandidateFields
};
