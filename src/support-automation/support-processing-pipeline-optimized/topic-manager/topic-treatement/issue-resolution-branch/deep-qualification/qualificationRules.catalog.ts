import {caseDetailFieldCatalog} from "../../../../../support-catalog-optimized/supportDeep.catalog";

import type {SupportFieldCatalogEntry} from "../../../../../support-catalog-optimized/supportDeep.catalog";

type CaseDetailFieldKey = Extract<keyof typeof caseDetailFieldCatalog, string>;

type DeepIssueFieldSpec = {
  key: CaseDetailFieldKey;
  askPrompt: string;
  askType: "contextual_problem_detail" | "simple_factual_detail";
};

const typedCaseDetailFieldCatalog = caseDetailFieldCatalog as Record<CaseDetailFieldKey, SupportFieldCatalogEntry>;

const genericDeepIssueFieldKeys = [
  "platform",
  "operating_system",
  "browser",
  "app_version",
  "device",
  "frequency",
  "issue_started_at"
] as const satisfies readonly CaseDetailFieldKey[];

const issueDeepQualificationKeyCatalog: Record<string, readonly CaseDetailFieldKey[]> = {
  product_behavior: [
    "affected_scope",
    "affected_users",
    "user_impact",
    "visual_evidence",
    "pre_problem_state"
  ],

  access_security: [
    "user_identifier",
    "account_identifier",
    "auth_method",
    "mfa_status",
    "recovery_channel",
    "user_role_or_permission",
    "server_or_instance"
  ],

  billing: [
    "account_identifier",
    "billing_issue_type",
    "plan_or_subscription",
    "billing_or_payment_status",
    "payment_method",
    "reference_id",
    "amount",
    "currency",
    "billing_date_or_period",
    "duplicate_billing_impact",
    "billing_provider"
  ],

  integration_sync: [
    "integration_or_connector",
    "sync_target",
    "sync_status",
    "server_or_instance",
    "provided_url",
    "reference_id",
    "affected_scope",
    "affected_users",
    "user_impact"
  ],

  performance: [
    "affected_scope",
    "affected_users",
    "user_impact",
    "visual_evidence"
  ],

  availability: [
    "affected_users",
    "affected_scope",
    "issue_started_at"
  ],

  data_migration: [
    "issue_started_at",
    "affected_scope",
    "reference_id"
  ],

  accessibility: [
    "assistive_technology",
    "accessibility_barrier",
    "inaccessible_element",
    "visual_evidence",
    "affected_scope",
    "user_impact"
  ],

  other: []
};

const contextualProblemDetailKeys = new Set<string>([
  "pre_problem_state",
  "affected_scope",
  "affected_users",
  "accessibility_barrier",
  "inaccessible_element",
  "sync_status"
]);

function getDeepIssueFieldSpecs(supportDomain: string | null): DeepIssueFieldSpec[] {
  const domainKeys = issueDeepQualificationKeyCatalog[supportDomain ?? "other"] ?? [];
  const allKeys = dedupeFieldKeys([
    ...genericDeepIssueFieldKeys,
    ...domainKeys
  ]);

  return allKeys
    .filter((key) => isAskableCaseDetailField(key))
    .map((key) => buildDeepIssueFieldSpec(key));
}

function getDeepIssueFieldAskPrompt(key: string | null): string {
  if (key && isCaseDetailFieldKey(key)) {
    const catalogEntry = typedCaseDetailFieldCatalog[key];
    return catalogEntry.askGuidance ?? `Please clarify ${buildLabel(key).toLowerCase()}.`;
  }

  return "Please clarify the missing information.";
}

function getDeepIssueFieldAskType(key: string | null): "contextual_problem_detail" | "simple_factual_detail" {
  if (!key) return "contextual_problem_detail";
  return contextualProblemDetailKeys.has(key)
    ? "contextual_problem_detail"
    : "simple_factual_detail";
}

function dedupeFieldKeys(keys: readonly CaseDetailFieldKey[]): CaseDetailFieldKey[] {
  return [...new Set(keys)];
}

function buildDeepIssueFieldSpec(key: CaseDetailFieldKey): DeepIssueFieldSpec {
  const catalogEntry = typedCaseDetailFieldCatalog[key];

  return {
    key,
    askPrompt: catalogEntry.askGuidance ?? `Please clarify ${buildLabel(key).toLowerCase()}.`,
    askType: getDeepIssueFieldAskType(key)
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
  getDeepIssueFieldAskPrompt,
  getDeepIssueFieldAskType,
  getDeepIssueFieldSpecs,
  issueDeepQualificationKeyCatalog
};
export type {CaseDetailFieldKey, DeepIssueFieldSpec};
