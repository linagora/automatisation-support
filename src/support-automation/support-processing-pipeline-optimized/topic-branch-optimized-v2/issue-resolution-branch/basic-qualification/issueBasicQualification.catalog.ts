import {caseDetailFieldCatalog} from "../../../../support-catalog-optimized/supportDeep.catalog";

import type {IssueFieldRequirement, IssueFieldSpec} from "../issueResolutionTypes";
import type {SupportFieldCatalogEntry} from "../../../../support-catalog-optimized/supportDeep.catalog";

type CaseDetailFieldKey = keyof typeof caseDetailFieldCatalog;
const typedCaseDetailFieldCatalog = caseDetailFieldCatalog as Record<CaseDetailFieldKey, SupportFieldCatalogEntry>;

type IssueFieldKeySpec = {
  key: CaseDetailFieldKey;
  requirement: IssueFieldRequirement;
};

const genericBasicIssueFieldKeys = [
  {key: "product_or_service", requirement: "required"},
  {key: "observed_result", requirement: "required"},
  {key: "expected_result", requirement: "recommended"}
] as const satisfies readonly IssueFieldKeySpec[];

const issueBasicQualificationKeyCatalog: Record<string, readonly IssueFieldKeySpec[]> = {
  product_behavior: [
    {key: "product_or_service", requirement: "required"},
    {key: "feature_or_page", requirement: "recommended"},
    {key: "observed_result", requirement: "required"},
    {key: "expected_result", requirement: "recommended"}
  ],

  access_security: [
    {key: "account_identifier", requirement: "required"},
    {key: "access_action", requirement: "required"},
    {key: "failure_step", requirement: "recommended"},
    {key: "error_message", requirement: "recommended"}
  ],

  billing: [
    {key: "product_or_service", requirement: "required"},
    {key: "billing_issue_type", requirement: "required"},
    {key: "billing_date_or_period", requirement: "required"},
    {key: "amount", requirement: "recommended"},
    {key: "currency", requirement: "recommended"},
    {key: "billing_provider", requirement: "recommended"},
    {key: "reference_id", requirement: "recommended"}
  ],

  configuration: [
    {key: "product_or_service", requirement: "required"},
    {key: "feature_or_page", requirement: "required"},
    {key: "workspace_name", requirement: "recommended"},
    {key: "observed_result", requirement: "required"},
    {key: "expected_result", requirement: "recommended"}
  ],

  integration_sync: [
    {key: "integration_or_connector", requirement: "required"},
    {key: "sync_target", requirement: "required"},
    {key: "sync_status", requirement: "required"},
    {key: "error_message", requirement: "recommended"}
  ],

  performance: [
    {key: "product_or_service", requirement: "required"},
    {key: "feature_or_page", requirement: "recommended"},
    {key: "observed_result", requirement: "required"},
    {key: "frequency", requirement: "recommended"}
  ],

  availability: [
    {key: "product_or_service", requirement: "required"},
    {key: "observed_result", requirement: "required"},
    {key: "affected_scope", requirement: "recommended"},
    {key: "issue_started_at", requirement: "recommended"}
  ],

  data_migration: [
    {key: "migration_or_transition_context", requirement: "required"},
    {key: "product_or_service", requirement: "required"},
    {key: "previous_product_or_service", requirement: "recommended"},
    {key: "observed_result", requirement: "recommended"}
  ],

  accessibility: [
    {key: "accessibility_barrier", requirement: "required"},
    {key: "inaccessible_element", requirement: "required"},
    {key: "assistive_technology", requirement: "recommended"}
  ],

  product_capability: [
    {key: "product_or_service", requirement: "required"},
    {key: "gap_observed", requirement: "required"},
    {key: "question_intent", requirement: "recommended"}
  ],

  support_process: [
    {key: "reference_id", requirement: "recommended"},
    {key: "visual_evidence", requirement: "recommended"}
  ],

  other: genericBasicIssueFieldKeys
};

function getBasicIssueFieldSpecs(supportDomain: string): IssueFieldSpec[] {
  return resolveIssueFieldSpecs(issueBasicQualificationKeyCatalog[supportDomain] ?? genericBasicIssueFieldKeys);
}

function resolveIssueFieldSpecs(fieldKeys: readonly IssueFieldKeySpec[]): IssueFieldSpec[] {
  return fieldKeys
    .filter((field) => isAskableCaseDetailField(field.key))
    .map((field) => buildIssueFieldSpec(field));
}

function buildIssueFieldSpec(field: IssueFieldKeySpec): IssueFieldSpec {
  const catalogEntry = typedCaseDetailFieldCatalog[field.key];

  return {
    key: field.key,
    label: buildLabel(field.key),
    requirement: field.requirement,
    askPrompt: catalogEntry.askGuidance ?? `Please clarify ${buildLabel(field.key).toLowerCase()}.`
  };
}

function getBasicIssueFieldAskPrompt(key: string): string {
  if (isCaseDetailFieldKey(key)) {
    const catalogEntry = typedCaseDetailFieldCatalog[key];
    return catalogEntry.askGuidance ?? `Please clarify ${buildLabel(key).toLowerCase()}.`;
  }

  return `Please clarify ${buildLabel(key).toLowerCase()}.`;
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
