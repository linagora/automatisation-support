import {caseDetailFieldCatalog} from "../../../../support-catalog-optimized/supportDeep.catalog";

import type {IssueFieldRequirement, IssueFieldSpec, SimilarIssueTopicCandidate} from "../issueResolutionTypes";
import type {SupportFieldCatalogEntry} from "../../../../support-catalog-optimized/supportDeep.catalog";

type CaseDetailFieldKey = keyof typeof caseDetailFieldCatalog;
const typedCaseDetailFieldCatalog = caseDetailFieldCatalog as Record<CaseDetailFieldKey, SupportFieldCatalogEntry>;

type IssueFieldKeySpec = {
  key: CaseDetailFieldKey;
  requirement: IssueFieldRequirement;
};

const genericDeepIssueFieldKeys = [
  {key: "frequency", requirement: "recommended"},
  {key: "platform", requirement: "recommended"},
  {key: "browser", requirement: "recommended"},
  {key: "device", requirement: "recommended"},
  {key: "issue_started_at", requirement: "recommended"},
  {key: "reproduction_steps", requirement: "recommended"}
] as const satisfies readonly IssueFieldKeySpec[];

const issueDeepQualificationKeyCatalog: Record<string, readonly IssueFieldKeySpec[]> = {
  product_behavior: [
    {key: "reproduction_steps", requirement: "recommended"},
    {key: "failure_step", requirement: "recommended"},
    {key: "platform", requirement: "recommended"},
    {key: "browser", requirement: "recommended"},
    {key: "device", requirement: "recommended"},
    {key: "issue_started_at", requirement: "recommended"},
    {key: "frequency", requirement: "recommended"}
  ],

  access_security: [
    {key: "user_identifier", requirement: "recommended"},
    {key: "auth_method", requirement: "recommended"},
    {key: "mfa_status", requirement: "recommended"},
    {key: "recovery_channel", requirement: "recommended"},
    {key: "user_role_or_permission", requirement: "recommended"},
    {key: "server_or_instance", requirement: "recommended"}
  ],

  billing: [
    {key: "plan_or_subscription", requirement: "recommended"},
    {key: "billing_or_payment_status", requirement: "recommended"},
    {key: "payment_method", requirement: "recommended"},
    {key: "reference_id", requirement: "recommended"}
  ],

  configuration: [
    {key: "workflow_context", requirement: "recommended"},
    {key: "pre_problem_state", requirement: "recommended"},
    {key: "trigger_action", requirement: "recommended"},
    {key: "affected_scope", requirement: "recommended"},
    {key: "affected_users", requirement: "recommended"}
  ],

  integration_sync: [
    {key: "server_or_instance", requirement: "recommended"},
    {key: "provided_url", requirement: "recommended"},
    {key: "reference_id", requirement: "recommended"},
    {key: "issue_started_at", requirement: "recommended"},
    {key: "frequency", requirement: "recommended"}
  ],

  performance: [
    {key: "platform", requirement: "recommended"},
    {key: "browser", requirement: "recommended"},
    {key: "device", requirement: "recommended"},
    {key: "affected_scope", requirement: "recommended"},
    {key: "issue_started_at", requirement: "recommended"},
    {key: "frequency", requirement: "recommended"}
  ],

  availability: [
    {key: "affected_users", requirement: "recommended"},
    {key: "affected_scope", requirement: "recommended"},
    {key: "issue_started_at", requirement: "recommended"},
    {key: "deadline_or_expected_date", requirement: "recommended"},
    {key: "available_workaround", requirement: "recommended"}
  ],

  data_migration: [
    {key: "workflow_context", requirement: "recommended"},
    {key: "issue_started_at", requirement: "recommended"},
    {key: "affected_scope", requirement: "recommended"},
    {key: "reference_id", requirement: "recommended"},
    {key: "available_workaround", requirement: "recommended"}
  ],

  accessibility: [
    {key: "platform", requirement: "recommended"},
    {key: "browser", requirement: "recommended"},
    {key: "device", requirement: "recommended"},
    {key: "reproduction_steps", requirement: "recommended"},
    {key: "visual_evidence", requirement: "recommended"}
  ],

  product_capability: [
    {key: "workflow_context", requirement: "recommended"},
    {key: "affected_scope", requirement: "recommended"},
    {key: "available_workaround", requirement: "recommended"}
  ],

  support_process: [
    {key: "reference_id", requirement: "recommended"},
    {key: "visual_evidence", requirement: "recommended"},
    {key: "deadline_or_expected_date", requirement: "recommended"}
  ],

  other: genericDeepIssueFieldKeys
};

function getDeepIssueFieldSpecs(input: {
  selectedTopic: SimilarIssueTopicCandidate | null;
  supportDomain?: string | null;
}): IssueFieldSpec[] {
  if (input.selectedTopic && input.selectedTopic.usefulDeepFieldKeys.length > 0) {
    return input.selectedTopic.usefulDeepFieldKeys.map((key) => buildIssueFieldSpecFromUnknownKey(key, "required"));
  }

  return resolveIssueFieldSpecs(issueDeepQualificationKeyCatalog[input.supportDomain ?? ""] ?? genericDeepIssueFieldKeys);
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

function buildIssueFieldSpecFromUnknownKey(key: string, requirement: IssueFieldRequirement): IssueFieldSpec {
  if (isCaseDetailFieldKey(key) && isAskableCaseDetailField(key)) {
    return buildIssueFieldSpec({key, requirement});
  }

  return {
    key,
    label: buildLabel(key),
    requirement,
    askPrompt: `Please clarify ${buildLabel(key).toLowerCase()}.`
  };
}

function getDeepIssueFieldAskPrompt(key: string): string {
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
  getDeepIssueFieldAskPrompt,
  getDeepIssueFieldSpecs,
  issueDeepQualificationKeyCatalog
};
