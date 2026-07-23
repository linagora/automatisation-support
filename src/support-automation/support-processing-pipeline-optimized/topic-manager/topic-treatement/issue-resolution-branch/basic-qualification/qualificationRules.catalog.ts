import {caseDetailFieldCatalog} from "../../../../../support-catalog-optimized/supportDeep.catalog";

import type {SupportFieldCatalogEntry} from "../../../../../support-catalog-optimized/supportDeep.catalog";

type CaseDetailFieldKey = Extract<keyof typeof caseDetailFieldCatalog, string>;

type BasicIssueFieldSpec = {
  key: CaseDetailFieldKey;
  askPrompt: string;
};

const typedCaseDetailFieldCatalog = caseDetailFieldCatalog as Record<CaseDetailFieldKey, SupportFieldCatalogEntry>;

const genericBasicIssueFieldKeys = [
  "product_or_service",
  "observed_result"
] as const satisfies readonly CaseDetailFieldKey[];

const issueBasicQualificationKeyCatalog: Record<string, readonly CaseDetailFieldKey[]> = {
  product_behavior: [],

  access_security: [
    "account_identifier",
    "access_action"
  ],

  billing: [
    "billing_issue_type",
    "billing_date_or_period"
  ],

  configuration: [
    "feature_or_page"
  ],

  integration_sync: [
    "integration_or_connector",
    "sync_target",
    "sync_status"
  ],

  performance: [],

  availability: [],

  data_migration: [
    "migration_or_transition_context"
  ],

  accessibility: [
    "accessibility_barrier",
    "inaccessible_element"
  ],

  product_capability: [
    "gap_observed"
  ],

  support_process: [],

  other: []
};

function getBasicIssueFieldSpecs(supportDomain: string | null): BasicIssueFieldSpec[] {
  const domainKeys = issueBasicQualificationKeyCatalog[supportDomain ?? "other"] ?? [];
  const allKeys = dedupeFieldKeys([
    ...genericBasicIssueFieldKeys,
    ...domainKeys
  ]);

  return allKeys
    .filter((key) => isAskableCaseDetailField(key))
    .map((key) => buildBasicIssueFieldSpec(key));
}

function getBasicIssueFieldAskPrompt(key: string | null): string {
  if (key && isCaseDetailFieldKey(key)) {
    const catalogEntry = typedCaseDetailFieldCatalog[key];
    return catalogEntry.askGuidance ?? `Please clarify ${buildLabel(key).toLowerCase()}.`;
  }

  return "Please clarify the missing information.";
}

function dedupeFieldKeys(keys: readonly CaseDetailFieldKey[]): CaseDetailFieldKey[] {
  return [...new Set(keys)];
}

function buildBasicIssueFieldSpec(key: CaseDetailFieldKey): BasicIssueFieldSpec {
  const catalogEntry = typedCaseDetailFieldCatalog[key];

  return {
    key,
    askPrompt: catalogEntry.askGuidance ?? `Please clarify ${buildLabel(key).toLowerCase()}.`
  };
}

function isAskableCaseDetailField(key: CaseDetailFieldKey): boolean {
  return typedCaseDetailFieldCatalog[key].askable !== false;
}

function isCaseDetailFieldKey(key: string): key is CaseDetailFieldKey {
  return Object.prototype.hasOwnProperty.call(caseDetailFieldCatalog, key);
}

function buildLabel(key: string): string {
  return key.replace(/_/g, " ");
}

export {
  getBasicIssueFieldAskPrompt,
  getBasicIssueFieldSpecs,
  issueBasicQualificationKeyCatalog
};
export type {BasicIssueFieldSpec, CaseDetailFieldKey};
