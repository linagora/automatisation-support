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
  | "access_security_context"
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
      access_security_context: [
        "auth_method",
        "mfa_status",
        "recovery_channel",
        "user_role_or_permission"
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

const deepQualificationGroupOrder = [
  "account_context",
  "access_security_context",
  "billing_context",
  "sync_context",
  "migration_context",
  "accessibility_context",
  "environment_context",
  "scope_timing_context",
  "evidence_context"
] as const satisfies readonly DeepQualificationGroupKey[];

const deepQualificationGroupLabels = {
  environment_context: "Environment",
  scope_timing_context: "Scope and timing",
  evidence_context: "Evidence",
  account_context: "Account context",
  access_security_context: "Access details",
  billing_context: "Billing details",
  sync_context: "Integration or sync details",
  migration_context: "Migration details",
  accessibility_context: "Accessibility details"
} as const satisfies Record<DeepQualificationGroupKey, string>;

const fieldRequestLabels: Partial<Record<CaseDetailFieldKey, string>> = {
  user_identifier: "affected user",
  account_identifier: "account, tenant, customer, or billing account ID",
  organization_name: "organization or customer name",
  workspace_name: "workspace, team, room, project, tenant, or shared space",
  server_or_instance: "server, instance, tenant, domain, region, or endpoint",

  platform: "access mode",
  operating_system: "operating system",
  browser: "browser",
  app_version: "app or browser version",
  device: "device or computer model",

  issue_started_at: "when it started",
  frequency: "whether it happens every time or only sometimes",
  affected_scope: "whether it affects one item, several items, one workspace, or a broader scope",
  affected_users: "whether it affects only you or other users too",
  pre_problem_state: "what was working before the issue started",

  visual_evidence: "screenshot, photo, or video if available",
  reference_id: "relevant reference ID",
  provided_url: "relevant URL or endpoint",

  auth_method: "authentication method",
  mfa_status: "MFA or two-factor authentication status",
  recovery_channel: "recovery channel",
  user_role_or_permission: "role or permission level",

  plan_or_subscription: "plan, subscription, license, package, or quota",
  billing_or_payment_status: "current billing or payment status",
  duplicate_billing_impact: "whether the duplicate is only an invoice or an actual double charge",
  billing_provider: "billing provider, marketplace, bank, card provider, or payment processor",
  amount: "amount",
  currency: "currency",
  billing_date_or_period: "billing date, charge date, invoice date, or subscription period",
  payment_method: "payment method",

  integration_or_connector: "integration, connector, bot, API, webhook, or external service",
  sync_target: "what should sync and where",
  sync_status: "current sync status",

  migration_or_transition_context: "migration, rollout, import, export, tenant move, or transition",
  previous_product_or_service: "previous product, service, plan, tenant, provider, or tool",

  assistive_technology: "assistive technology or accessibility tool",
  accessibility_barrier: "accessibility barrier",
  inaccessible_element: "inaccessible page, button, field, content, or workflow"
};

function resolveIssueQualificationDomain(supportDomain: string | null): IssueQualificationDomain {
  if (supportDomain && isIssueQualificationDomain(supportDomain)) {
    return supportDomain;
  }

  return "other";
}

function getBasicIssueQualificationFieldKeys(supportDomain: string | null): CaseDetailFieldKey[] {
  const domain = resolveIssueQualificationDomain(supportDomain);

  return issueQualificationDomainRules[domain].basic.filter((key) => {
    return isAskableCaseDetailField(key);
  });
}

function getDeepIssueQualificationGroups(
  supportDomain: string | null
): Partial<Record<DeepQualificationGroupKey, CaseDetailFieldKey[]>> {
  const domain = resolveIssueQualificationDomain(supportDomain);

  const groups = issueQualificationDomainRules[domain].deep as Partial<
    Record<DeepQualificationGroupKey, readonly CaseDetailFieldKey[]>
  >;

  const result: Partial<Record<DeepQualificationGroupKey, CaseDetailFieldKey[]>> = {};

  for (const groupKey of deepQualificationGroupOrder) {
    const fieldKeys = groups[groupKey] ?? [];

    const askableFieldKeys = fieldKeys.filter((key: CaseDetailFieldKey) => {
      return isAskableCaseDetailField(key);
    });

    if (askableFieldKeys.length > 0) {
      result[groupKey] = askableFieldKeys;
    }
  }

  return result;
}

function getDeepIssueQualificationFieldKeys(supportDomain: string | null): CaseDetailFieldKey[] {
  const groups = getDeepIssueQualificationGroups(supportDomain);
  const keys = Object.values(groups).flat();

  return dedupeFieldKeys(keys);
}

function getDeepIssueQualificationGroupKey(
  supportDomain: string | null,
  key: string | null
): DeepQualificationGroupKey | null {
  if (!key || !isCaseDetailFieldKey(key)) return null;

  const groups = getDeepIssueQualificationGroups(supportDomain);

  for (const groupKey of deepQualificationGroupOrder) {
    const fieldKeys = groups[groupKey] ?? [];
    if (fieldKeys.includes(key)) return groupKey;
  }

  return null;
}

function getDeepIssueQualificationGroupLabel(groupKey: DeepQualificationGroupKey): string {
  return deepQualificationGroupLabels[groupKey];
}

function getCaseDetailFieldAskPrompt(key: string | null): string {
  if (key && isCaseDetailFieldKey(key)) {
    const catalogEntry = typedCaseDetailFieldCatalog[key];
    return catalogEntry.askGuidance ?? `Please clarify ${buildLabel(key).toLowerCase()}.`;
  }

  return "Please clarify the missing information.";
}

function getCaseDetailFieldRequestLabel(key: string | null): string {
  if (key && isCaseDetailFieldKey(key)) {
    return fieldRequestLabels[key] ?? buildLabel(key);
  }

  return "missing detail";
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
  deepQualificationGroupLabels,
  deepQualificationGroupOrder,
  getBasicIssueQualificationFieldKeys,
  getCaseDetailFieldAskPrompt,
  getCaseDetailFieldRequestLabel,
  getDeepIssueQualificationFieldKeys,
  getDeepIssueQualificationGroupKey,
  getDeepIssueQualificationGroupLabel,
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