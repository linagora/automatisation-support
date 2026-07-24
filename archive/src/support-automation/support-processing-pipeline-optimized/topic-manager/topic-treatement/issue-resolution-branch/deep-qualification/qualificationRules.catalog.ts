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
  "frequency",
  "platform",
  "browser",
  "device",
  "issue_started_at",
  "reproduction_steps"
] as const satisfies readonly CaseDetailFieldKey[];

const issueDeepQualificationKeyCatalog: Record<string, readonly CaseDetailFieldKey[]> = {
  product_behavior: [
    "reproduction_steps",
    "failure_step",
    "platform",
    "browser",
    "device",
    "issue_started_at",
    "frequency"
  ],

  access_security: [
    "user_identifier",
    "auth_method",
    "mfa_status",
    "recovery_channel",
    "user_role_or_permission",
    "server_or_instance"
  ],

  billing: [
    "plan_or_subscription",
    "billing_or_payment_status",
    "payment_method",
    "reference_id"
  ],

  configuration: [
    "workflow_context",
    "pre_problem_state",
    "trigger_action",
    "affected_scope",
    "affected_users"
  ],

  integration_sync: [
    "server_or_instance",
    "provided_url",
    "reference_id",
    "issue_started_at",
    "frequency"
  ],

  performance: [
    "platform",
    "browser",
    "device",
    "affected_scope",
    "issue_started_at",
    "frequency"
  ],

  availability: [
    "affected_users",
    "affected_scope",
    "issue_started_at",
    "deadline_or_expected_date",
    "available_workaround"
  ],

  data_migration: [
    "workflow_context",
    "issue_started_at",
    "affected_scope",
    "reference_id",
    "available_workaround"
  ],

  accessibility: [
    "platform",
    "browser",
    "device",
    "reproduction_steps",
    "visual_evidence"
  ],

  product_capability: [
    "workflow_context",
    "affected_scope",
    "available_workaround"
  ],

  support_process: [
    "reference_id",
    "visual_evidence",
    "deadline_or_expected_date"
  ],

  other: []
};

const contextualProblemDetailKeys = new Set<string>([
  "reproduction_steps",
  "failure_step",
  "workflow_context",
  "pre_problem_state",
  "trigger_action",
  "affected_scope",
  "affected_users",
  "available_workaround",
  "accessibility_barrier",
  "inaccessible_element",
  "gap_observed",
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
