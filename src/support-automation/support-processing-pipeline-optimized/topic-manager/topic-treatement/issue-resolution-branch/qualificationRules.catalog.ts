import {caseDetailFieldCatalog} from "../../../../support-catalog-optimized/supportDeep.catalog";

import type {SupportFieldCatalogEntry} from "../../../../support-catalog-optimized/supportDeep.catalog";

type CaseDetailFieldKey = Extract<keyof typeof caseDetailFieldCatalog, string>;

type IssueQualificationDomain =
  | "product_behavior"
  | "access_security"
  | "billing"
  | "integration_sync"
  | "performance"
  | "availability"
  | "data_migration"
  | "accessibility"
  | "other";

type DeepQualificationGroupKey =
  | "environment_context"
  | "scope_timing_context"
  | "evidence_context"
  | "account_context"
  | "billing_context"
  | "sync_context"
  | "migration_context"
  | "accessibility_context";

type IssueQualificationDomainRule = {
  basic: readonly CaseDetailFieldKey[];
  deep: Partial<Record<DeepQualificationGroupKey, readonly CaseDetailFieldKey[]>>;
};

const typedCaseDetailFieldCatalog = caseDetailFieldCatalog as Record<CaseDetailFieldKey, SupportFieldCatalogEntry>;

const issueQualificationDomainRules = {
  product_behavior: {
    basic: [
      "product_or_service",
      "feature_or_page",
      "trigger_action",
      "failure_step",
      "observed_result",
      "expected_result",
      "error_message"
    ],
    deep: {
      environment_context: [
        "platform",
        "operating_system",
        "browser",
        "app_version",
        "device"
      ],
      scope_timing_context: [
        "affected_scope",
        "affected_users",
        "issue_started_at",
        "frequency",
        "pre_problem_state"
      ],
      evidence_context: [
        "visual_evidence",
        "reference_id",
        "provided_url"
      ]
    }
  },

  access_security: {
    basic: [
      "product_or_service",
      "access_action",
      "trigger_action",
      "failure_step",
      "observed_result",
      "expected_result",
      "error_message"
    ],
    deep: {
      account_context: [
        "user_identifier",
        "account_identifier",
        "organization_name",
        "workspace_name",
        "server_or_instance"
      ],
      environment_context: [
        "platform",
        "operating_system",
        "browser",
        "app_version",
        "device"
      ],
      scope_timing_context: [
        "affected_scope",
        "affected_users",
        "issue_started_at",
        "frequency"
      ],
      evidence_context: [
        "visual_evidence",
        "reference_id",
        "provided_url"
      ]
    }
  },

  billing: {
    basic: [
      "product_or_service",
      "billing_issue_type",
      "trigger_action",
      "observed_result",
      "expected_result",
      "error_message"
    ],
    deep: {
      account_context: [
        "account_identifier",
        "organization_name",
        "workspace_name"
      ],
      billing_context: [
        "plan_or_subscription",
        "billing_or_payment_status",
        "duplicate_billing_impact",
        "billing_provider",
        "amount",
        "currency",
        "billing_date_or_period",
        "payment_method",
        "reference_id"
      ],
      evidence_context: [
        "visual_evidence",
        "provided_url"
      ]
    }
  },

  integration_sync: {
    basic: [
      "product_or_service",
      "integration_or_connector",
      "sync_target",
      "sync_status",
      "trigger_action",
      "observed_result",
      "expected_result",
      "error_message"
    ],
    deep: {
      sync_context: [
        "integration_or_connector",
        "sync_target",
        "sync_status",
        "server_or_instance",
        "provided_url",
        "reference_id"
      ],
      account_context: [
        "account_identifier",
        "organization_name",
        "workspace_name"
      ],
      scope_timing_context: [
        "affected_scope",
        "affected_users",
        "issue_started_at",
        "frequency"
      ],
      evidence_context: [
        "visual_evidence"
      ]
    }
  },

  performance: {
    basic: [
      "product_or_service",
      "feature_or_page",
      "trigger_action",
      "observed_result",
      "expected_result",
      "frequency"
    ],
    deep: {
      environment_context: [
        "platform",
        "operating_system",
        "browser",
        "app_version",
        "device"
      ],
      scope_timing_context: [
        "affected_scope",
        "affected_users",
        "issue_started_at",
        "pre_problem_state"
      ],
      evidence_context: [
        "visual_evidence",
        "reference_id",
        "provided_url"
      ]
    }
  },

  availability: {
    basic: [
      "product_or_service",
      "observed_result",
      "affected_scope",
      "issue_started_at"
    ],
    deep: {
      environment_context: [
        "platform",
        "operating_system",
        "browser",
        "app_version",
        "device"
      ],
      scope_timing_context: [
        "affected_users",
        "frequency",
        "pre_problem_state"
      ],
      evidence_context: [
        "visual_evidence",
        "reference_id",
        "provided_url"
      ],
      account_context: [
        "workspace_name",
        "server_or_instance"
      ]
    }
  },

  data_migration: {
    basic: [
      "product_or_service",
      "migration_or_transition_context",
      "trigger_action",
      "observed_result",
      "expected_result",
      "error_message"
    ],
    deep: {
      migration_context: [
        "migration_or_transition_context",
        "previous_product_or_service",
        "affected_scope",
        "reference_id"
      ],
      account_context: [
        "account_identifier",
        "organization_name",
        "workspace_name"
      ],
      scope_timing_context: [
        "affected_users",
        "issue_started_at",
        "frequency"
      ],
      evidence_context: [
        "visual_evidence",
        "provided_url"
      ]
    }
  },

  accessibility: {
    basic: [
      "product_or_service",
      "feature_or_page",
      "accessibility_barrier",
      "inaccessible_element",
      "trigger_action",
      "observed_result",
      "expected_result"
    ],
    deep: {
      accessibility_context: [
        "assistive_technology",
        "accessibility_barrier",
        "inaccessible_element"
      ],
      environment_context: [
        "platform",
        "operating_system",
        "browser",
        "app_version",
        "device"
      ],
      scope_timing_context: [
        "affected_scope",
        "affected_users",
        "issue_started_at"
      ],
      evidence_context: [
        "visual_evidence",
        "reference_id",
        "provided_url"
      ]
    }
  },

  other: {
    basic: [
      "product_or_service",
      "observed_result",
      "expected_result"
    ],
    deep: {
      environment_context: [
        "platform",
        "operating_system",
        "browser",
        "app_version",
        "device"
      ],
      scope_timing_context: [
        "affected_scope",
        "affected_users",
        "issue_started_at",
        "frequency"
      ],
      evidence_context: [
        "visual_evidence",
        "reference_id",
        "provided_url"
      ]
    }
  }
} as const satisfies Record<IssueQualificationDomain, IssueQualificationDomainRule>;

function resolveIssueQualificationDomain(supportDomain: string | null): IssueQualificationDomain {
  if (supportDomain && isIssueQualificationDomain(supportDomain)) {
    return supportDomain;
  }

  return "other";
}

function getBasicIssueQualificationFieldKeys(supportDomain: string | null): CaseDetailFieldKey[] {
  const domain = resolveIssueQualificationDomain(supportDomain);

  return issueQualificationDomainRules[domain].basic
    .filter((key) => isAskableCaseDetailField(key));
}

function getDeepIssueQualificationGroups(
  supportDomain: string | null
): Partial<Record<DeepQualificationGroupKey, CaseDetailFieldKey[]>> {
  const domain = resolveIssueQualificationDomain(supportDomain);
  const groups = issueQualificationDomainRules[domain].deep;
  const result: Partial<Record<DeepQualificationGroupKey, CaseDetailFieldKey[]>> = {};

  const entries = Object.entries(groups) as Array<
    [DeepQualificationGroupKey, readonly CaseDetailFieldKey[]]
  >;

  for (const [groupKey, fieldKeys] of entries) {
    result[groupKey] = fieldKeys.filter((key: CaseDetailFieldKey) => {
      return isAskableCaseDetailField(key);
    });
  }

  return result;
}

function getDeepIssueQualificationFieldKeys(supportDomain: string | null): CaseDetailFieldKey[] {
  const groups = getDeepIssueQualificationGroups(supportDomain);
  const keys = Object.values(groups).flat();

  return dedupeFieldKeys(keys);
}

function getCaseDetailFieldAskPrompt(key: string | null): string {
  if (key && isCaseDetailFieldKey(key)) {
    const catalogEntry = typedCaseDetailFieldCatalog[key];
    return catalogEntry.askGuidance ?? `Please clarify ${buildLabel(key).toLowerCase()}.`;
  }

  return "Please clarify the missing information.";
}

function isAskableCaseDetailField(key: CaseDetailFieldKey): boolean {
  return typedCaseDetailFieldCatalog[key].askable !== false;
}

function isIssueQualificationDomain(value: string): value is IssueQualificationDomain {
  return Object.prototype.hasOwnProperty.call(issueQualificationDomainRules, value);
}

function isCaseDetailFieldKey(key: string): key is CaseDetailFieldKey {
  return Object.prototype.hasOwnProperty.call(caseDetailFieldCatalog, key);
}

function dedupeFieldKeys(keys: readonly CaseDetailFieldKey[]): CaseDetailFieldKey[] {
  return [...new Set(keys)];
}

function buildLabel(key: string): string {
  return key.replace(/_/g, " ");
}

export {
  getBasicIssueQualificationFieldKeys,
  getCaseDetailFieldAskPrompt,
  getDeepIssueQualificationFieldKeys,
  getDeepIssueQualificationGroups,
  issueQualificationDomainRules,
  resolveIssueQualificationDomain
};

export type {
  CaseDetailFieldKey,
  DeepQualificationGroupKey,
  IssueQualificationDomain,
  IssueQualificationDomainRule
};