import { describe, expect, it } from "vitest";

import {
  BROAD_CATEGORY_HINTS as CATALOG_BROAD_CATEGORY_HINTS,
  CASE_DETAIL_FIELDS,
  CATEGORY_CANDIDATE_FIELD_NAMES as CATALOG_CATEGORY_CANDIDATE_FIELD_NAMES,
  MESSAGE_KIND_VALUES as CATALOG_MESSAGE_KIND_VALUES,
  SUPPORT_METADATA_FIELDS
} from "../../../src/support-automation/support-catalog-LEGACY";
import {
  DEFAULT_SUPPORT_EXTRACTABLE_FIELD_CATALOG
} from "../../../src/support-automation/support-processing-pipeline-v2/analyze-support-text/supportExtractableFieldCatalog";
import {
  BROAD_CATEGORY_HINTS
} from "../../../src/support-automation/support-processing-pipeline-v2/analyze-support-text/supportTextAnalysis.taxonomy";
import {
  CASE_DETAIL_FIELD_CATALOG,
  MESSAGE_KIND_VALUES,
  SUPPORT_METADATA_FIELD_CATALOG
} from "../../../src/support-automation/support-processing-pipeline-v2/support-text-analysis.catalog";
import {
  CATEGORY_CANDIDATE_FIELD_NAMES
} from "../../../src/support-automation/support-processing-pipeline-v2/select-catalog-knowledge-for-topic/buildCandidateFieldsForTopicSelector";
import type {
  SupportCatalogField
} from "../../../src/support-automation/support-catalog-LEGACY";

function legacyFieldProjection(field: SupportCatalogField): {
  fieldName: string;
  description: string;
  askableByUser: boolean;
  promptHint?: string;
} {
  return {
    fieldName: field.key,
    description: field.description,
    askableByUser: field.askable ?? true,
    ...(field.promptHint ? { promptHint: field.promptHint } : {})
  };
}

function legacyExtractableFieldProjection(field: SupportCatalogField): {
  fieldName: string;
  description: string;
  askableByUser: boolean;
} {
  return {
    fieldName: field.key,
    description: field.description,
    askableByUser: field.askable ?? true
  };
}

describe("support catalog compatibility exports", function () {
  it("keeps the legacy extractable field catalog aligned with central case detail fields", function () {
    expect(DEFAULT_SUPPORT_EXTRACTABLE_FIELD_CATALOG).toEqual(
      CASE_DETAIL_FIELDS.map(legacyExtractableFieldProjection)
    );
  });

  it("keeps support text analysis field projections aligned with central fields", function () {
    expect(CASE_DETAIL_FIELD_CATALOG).toEqual(
      CASE_DETAIL_FIELDS.map(legacyFieldProjection)
    );
    expect(SUPPORT_METADATA_FIELD_CATALOG).toEqual(
      SUPPORT_METADATA_FIELDS.map(legacyFieldProjection)
    );
  });

  it("keeps taxonomy and selector mappings aligned with central catalog exports", function () {
    expect(BROAD_CATEGORY_HINTS).toEqual(CATALOG_BROAD_CATEGORY_HINTS);
    expect(MESSAGE_KIND_VALUES).toEqual(CATALOG_MESSAGE_KIND_VALUES);
    expect(CATEGORY_CANDIDATE_FIELD_NAMES).toEqual(
      CATALOG_CATEGORY_CANDIDATE_FIELD_NAMES
    );
  });
});
