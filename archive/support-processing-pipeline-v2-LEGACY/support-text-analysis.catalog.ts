import {
  ATTEMPTED_ACTION_OUTCOME_VALUES,
  CASE_DETAIL_FIELDS,
  MESSAGE_KIND_VALUES,
  SUPPORT_METADATA_FIELDS
} from "../../archive/support-catalog-LEGACY";

import type {
  ExtractableFieldDefinition
} from "./typesSupportProcessingPipelineV2.types";
import type {
  SupportCatalogField
} from "../../archive/support-catalog-LEGACY";

type SupportTextAnalysisCatalogField = ExtractableFieldDefinition & {
  promptHint?: string;
};

function toSupportTextAnalysisCatalogField(
  field: SupportCatalogField
): SupportTextAnalysisCatalogField {
  return {
    fieldName: field.key,
    description: field.description,
    askableByUser: field.askable ?? true,
    ...(field.extractionGuidance ?? field.promptHint
      ? { promptHint: field.extractionGuidance ?? field.promptHint }
      : {})
  };
}

const CASE_DETAIL_FIELD_CATALOG: SupportTextAnalysisCatalogField[] =
  CASE_DETAIL_FIELDS.map(toSupportTextAnalysisCatalogField);

const SUPPORT_METADATA_FIELD_CATALOG: SupportTextAnalysisCatalogField[] =
  SUPPORT_METADATA_FIELDS.map(toSupportTextAnalysisCatalogField);

export {
  ATTEMPTED_ACTION_OUTCOME_VALUES,
  CASE_DETAIL_FIELD_CATALOG,
  MESSAGE_KIND_VALUES,
  SUPPORT_METADATA_FIELD_CATALOG
};

export type {
  SupportTextAnalysisCatalogField
};
