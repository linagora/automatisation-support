import {
  CASE_DETAIL_FIELD_DEFINITIONS,
  SUPPORT_METADATA_FIELD_DEFINITIONS,
  getCaseDetailFieldsByName,
  getSupportMetadataFieldsByName
} from "./supportFields.catalog";

import type {
  StrictBroadCategoryHint,
  StrictBroadIntentMode,
  StrictSupportCaseDetailFieldName,
  StrictSupportMetadataFieldName
} from "./supportCatalog.types";

// -----------------------------------------------------------------------------
// Shared field families
// -----------------------------------------------------------------------------
// These are deterministic field-family mappings used to build pipeline projections.
// Canonical field definitions live in supportFields.catalog.ts.

const SUPPORT_IDENTITY_AND_ACCOUNT_FIELD_NAMES = [
  "user_identifier",
  "account_identifier",
  "account_status"
] as const;

const SUPPORT_ORGANIZATION_AND_PRODUCT_FIELD_NAMES = [
  "organization_name",
  "workspace_name",
  "product_or_service",
  "feature_or_page"
] as const;

const SUPPORT_TECHNICAL_ENVIRONMENT_FIELD_NAMES = [
  "platform",
  "operating_system",
  "browser",
  "app_version",
  "device",
  "notification_permission_status",
  "notification_channel_status"
] as const;

const SUPPORT_OBSERVED_BEHAVIOR_FIELD_NAMES = [
  "pre_problem_state",
  "trigger_action",
  "error_message",
  "observed_result",
  "expected_result",
  "available_workaround"
] as const;

const SUPPORT_TEMPORALITY_AND_IMPACT_FIELD_NAMES = [
  "issue_started_at",
  "issue_duration",
  "deadline_or_expected_date",
  "frequency",
  "affected_scope",
  "affected_users",
  "user_impact"
] as const;

const SUPPORT_ACCESS_AND_AUTH_FIELD_NAMES = [
  "access_action",
  "auth_method",
  "server_or_instance",
  "recovery_channel",
  "user_role_or_permission",
  "mfa_status"
] as const;

const SUPPORT_INTEGRATION_AND_SYNC_FIELD_NAMES = [
  "integration_or_connector",
  "sync_target",
  "sync_status"
] as const;

const SUPPORT_BILLING_AND_PAYMENT_FIELD_NAMES = [
  "plan_or_subscription",
  "billing_or_payment_status",
  "billing_issue_type",
  "duplicate_billing_impact",
  "billing_provider",
  "amount",
  "currency",
  "billing_date_or_period",
  "payment_method"
] as const;

const SUPPORT_PRODUCT_QUESTION_FIELD_NAMES = [
  "question_intent",
  "gap_observed"
] as const;

const SUPPORT_ACCESSIBILITY_FIELD_NAMES = [
  "assistive_technology",
  "accessibility_barrier",
  "inaccessible_element"
] as const;

const SUPPORT_MIGRATION_FIELD_NAMES = [
  "migration_or_transition_context",
  "previous_product_or_service"
] as const;

const SUPPORT_REFERENCE_FIELD_NAMES = [
  "provided_url",
  "reference_id",
  "visual_evidence"
] as const;

const SUPPORT_METADATA_FIELD_NAMES = Object.keys(
  SUPPORT_METADATA_FIELD_DEFINITIONS
) as StrictSupportMetadataFieldName[];

const ALL_CASE_DETAIL_FIELD_NAMES = Object.keys(
  CASE_DETAIL_FIELD_DEFINITIONS
) as StrictSupportCaseDetailFieldName[];

// Backward-compatible materialized family exports.
const SUPPORT_IDENTITY_AND_ACCOUNT_FIELDS = getCaseDetailFieldsByName(SUPPORT_IDENTITY_AND_ACCOUNT_FIELD_NAMES);
const SUPPORT_ORGANIZATION_AND_PRODUCT_FIELDS = getCaseDetailFieldsByName(SUPPORT_ORGANIZATION_AND_PRODUCT_FIELD_NAMES);
const SUPPORT_TECHNICAL_ENVIRONMENT_FIELDS = getCaseDetailFieldsByName(SUPPORT_TECHNICAL_ENVIRONMENT_FIELD_NAMES);
const SUPPORT_OBSERVED_BEHAVIOR_FIELDS = getCaseDetailFieldsByName(SUPPORT_OBSERVED_BEHAVIOR_FIELD_NAMES);
const SUPPORT_TEMPORALITY_AND_IMPACT_FIELDS = getCaseDetailFieldsByName(SUPPORT_TEMPORALITY_AND_IMPACT_FIELD_NAMES);
const SUPPORT_ACCESS_AND_AUTH_FIELDS = getCaseDetailFieldsByName(SUPPORT_ACCESS_AND_AUTH_FIELD_NAMES);
const SUPPORT_INTEGRATION_AND_SYNC_FIELDS = getCaseDetailFieldsByName(SUPPORT_INTEGRATION_AND_SYNC_FIELD_NAMES);
const SUPPORT_BILLING_AND_PAYMENT_FIELDS = getCaseDetailFieldsByName(SUPPORT_BILLING_AND_PAYMENT_FIELD_NAMES);
const SUPPORT_PRODUCT_QUESTION_FIELDS = getCaseDetailFieldsByName(SUPPORT_PRODUCT_QUESTION_FIELD_NAMES);
const SUPPORT_ACCESSIBILITY_FIELDS = getCaseDetailFieldsByName(SUPPORT_ACCESSIBILITY_FIELD_NAMES);
const SUPPORT_MIGRATION_FIELDS = getCaseDetailFieldsByName(SUPPORT_MIGRATION_FIELD_NAMES);
const SUPPORT_REFERENCE_FIELDS = getCaseDetailFieldsByName(SUPPORT_REFERENCE_FIELD_NAMES);

// -----------------------------------------------------------------------------
// Stage 1 — analyze-support-text
// -----------------------------------------------------------------------------
// analyzeSupportText can see every case-detail field and every support-metadata field.
// The prompt projection chooses how to render their definitions.

const ANALYZE_SUPPORT_TEXT_CASE_DETAIL_FIELD_NAMES = ALL_CASE_DETAIL_FIELD_NAMES;
const ANALYZE_SUPPORT_TEXT_SUPPORT_METADATA_FIELD_NAMES = SUPPORT_METADATA_FIELD_NAMES;

const ANALYZE_SUPPORT_TEXT_CASE_DETAIL_FIELDS = getCaseDetailFieldsByName(
  ANALYZE_SUPPORT_TEXT_CASE_DETAIL_FIELD_NAMES
);
const ANALYZE_SUPPORT_TEXT_SUPPORT_METADATA_FIELDS = getSupportMetadataFieldsByName(
  ANALYZE_SUPPORT_TEXT_SUPPORT_METADATA_FIELD_NAMES
);

// -----------------------------------------------------------------------------
// Stage 2 — propose-topic-updates
// -----------------------------------------------------------------------------
// This stage uses taxonomy definitions, not candidate field mappings.
// See supportTaxonomy.catalog.ts for broad categories and message kinds.

// -----------------------------------------------------------------------------
// Stage 3 — plan-knowledge-enrichment
// -----------------------------------------------------------------------------
// This stage uses taxonomy definitions, not field-selection mappings.
// It determines broadIntent and RAG readiness.

// -----------------------------------------------------------------------------
// Stage 4 — select-catalog-knowledge-for-topic
// -----------------------------------------------------------------------------
// Candidate field mappings used by the catalog-selection branch.
// Keep all category/intent -> field selection rules here.

const CATEGORY_CANDIDATE_FIELD_NAMES = {
  bug: [
    "product_or_service",
    "feature_or_page",
    "platform",
    "operating_system",
    "browser",
    "app_version",
    "device",
    "trigger_action",
    "error_message",
    "observed_result",
    "expected_result",
    "available_workaround",
    "frequency",
    "affected_scope",
    "affected_users",
    "user_impact"
  ],
  access_security: [
    "user_identifier",
    "account_identifier",
    "product_or_service",
    "feature_or_page",
    "platform",
    "operating_system",
    "browser",
    "app_version",
    "device",
    "access_action",
    "auth_method",
    "server_or_instance",
    "recovery_channel",
    "user_role_or_permission",
    "mfa_status",
    "error_message",
    "observed_result",
    "expected_result",
    "available_workaround",
    "frequency",
    "affected_scope",
    "affected_users",
    "user_impact"
  ],
  billing: [
    "product_or_service",
    "plan_or_subscription",
    "billing_or_payment_status",
    "billing_issue_type",
    "duplicate_billing_impact",
    "billing_provider",
    "amount",
    "currency",
    "billing_date_or_period",
    "payment_method",
    "reference_id",
    "observed_result",
    "expected_result",
    "user_impact"
  ],
  configuration: [
    "product_or_service",
    "feature_or_page",
    "workspace_name",
    "platform",
    "operating_system",
    "browser",
    "app_version",
    "device",
    "trigger_action",
    "expected_result",
    "observed_result",
    "user_role_or_permission",
    "available_workaround"
  ],
  integration_sync: [
    "product_or_service",
    "integration_or_connector",
    "sync_target",
    "sync_status",
    "workspace_name",
    "server_or_instance",
    "trigger_action",
    "error_message",
    "observed_result",
    "expected_result",
    "frequency",
    "affected_scope",
    "affected_users",
    "user_impact"
  ],
  performance: [
    "product_or_service",
    "feature_or_page",
    "platform",
    "operating_system",
    "browser",
    "app_version",
    "device",
    "trigger_action",
    "observed_result",
    "expected_result",
    "frequency",
    "affected_scope",
    "affected_users",
    "user_impact"
  ],
  availability: [
    "product_or_service",
    "platform",
    "server_or_instance",
    "issue_started_at",
    "issue_duration",
    "frequency",
    "affected_scope",
    "affected_users",
    "user_impact",
    "available_workaround"
  ],
  data_migration: [
    "migration_or_transition_context",
    "previous_product_or_service",
    "product_or_service",
    "sync_target",
    "sync_status",
    "observed_result",
    "expected_result",
    "affected_scope",
    "affected_users",
    "user_impact"
  ],
  accessibility: [
    "product_or_service",
    "feature_or_page",
    "platform",
    "operating_system",
    "browser",
    "device",
    "assistive_technology",
    "accessibility_barrier",
    "inaccessible_element",
    "observed_result",
    "expected_result",
    "visual_evidence",
    "user_impact"
  ],
  question_faq: [
    "product_or_service",
    "feature_or_page",
    "question_intent",
    "plan_or_subscription",
    "platform",
    "expected_result"
  ],
  feature_request: [
    "product_or_service",
    "feature_or_page",
    "gap_observed",
    "expected_result",
    "affected_scope",
    "affected_users",
    "user_impact"
  ],
  support_action: [
    "user_identifier",
    "account_identifier",
    "organization_name",
    "workspace_name",
    "product_or_service",
    "feature_or_page",
    "reference_id",
    "deadline_or_expected_date",
    "user_impact"
  ],
  product_feedback: [
    "product_or_service",
    "feature_or_page",
    "gap_observed",
    "observed_result",
    "expected_result",
    "affected_scope",
    "user_impact"
  ],
  support_experience_issue: [
    "reference_id",
    "issue_started_at",
    "issue_duration",
    "deadline_or_expected_date",
    "observed_result",
    "expected_result",
    "user_impact"
  ],
  other: [
    "product_or_service",
    "feature_or_page",
    "observed_result",
    "expected_result",
    "user_impact"
  ]
} as const satisfies Record<StrictBroadCategoryHint, readonly StrictSupportCaseDetailFieldName[]>;

const BROAD_INTENT_CANDIDATE_FIELD_NAMES = {
  issue: [
    "product_or_service",
    "feature_or_page",
    "platform",
    "trigger_action",
    "observed_result",
    "expected_result",
    "error_message",
    "frequency",
    "user_impact"
  ],
  faq: [
    "product_or_service",
    "feature_or_page",
    "question_intent",
    "platform",
    "expected_result"
  ],
  request: [
    "product_or_service",
    "feature_or_page",
    "gap_observed",
    "expected_result",
    "deadline_or_expected_date",
    "user_impact"
  ],
  unclear: [
    "product_or_service",
    "feature_or_page",
    "question_intent",
    "trigger_action",
    "observed_result",
    "expected_result",
    "gap_observed"
  ]
} as const satisfies Record<StrictBroadIntentMode, readonly StrictSupportCaseDetailFieldName[]>;

export {
  ALL_CASE_DETAIL_FIELD_NAMES,
  ANALYZE_SUPPORT_TEXT_CASE_DETAIL_FIELD_NAMES,
  ANALYZE_SUPPORT_TEXT_CASE_DETAIL_FIELDS,
  ANALYZE_SUPPORT_TEXT_SUPPORT_METADATA_FIELD_NAMES,
  ANALYZE_SUPPORT_TEXT_SUPPORT_METADATA_FIELDS,
  BROAD_INTENT_CANDIDATE_FIELD_NAMES,
  CATEGORY_CANDIDATE_FIELD_NAMES,
  SUPPORT_ACCESSIBILITY_FIELD_NAMES,
  SUPPORT_ACCESSIBILITY_FIELDS,
  SUPPORT_ACCESS_AND_AUTH_FIELD_NAMES,
  SUPPORT_ACCESS_AND_AUTH_FIELDS,
  SUPPORT_BILLING_AND_PAYMENT_FIELD_NAMES,
  SUPPORT_BILLING_AND_PAYMENT_FIELDS,
  SUPPORT_IDENTITY_AND_ACCOUNT_FIELD_NAMES,
  SUPPORT_IDENTITY_AND_ACCOUNT_FIELDS,
  SUPPORT_INTEGRATION_AND_SYNC_FIELD_NAMES,
  SUPPORT_INTEGRATION_AND_SYNC_FIELDS,
  SUPPORT_METADATA_FIELD_NAMES,
  SUPPORT_MIGRATION_FIELD_NAMES,
  SUPPORT_MIGRATION_FIELDS,
  SUPPORT_OBSERVED_BEHAVIOR_FIELD_NAMES,
  SUPPORT_OBSERVED_BEHAVIOR_FIELDS,
  SUPPORT_ORGANIZATION_AND_PRODUCT_FIELD_NAMES,
  SUPPORT_ORGANIZATION_AND_PRODUCT_FIELDS,
  SUPPORT_PRODUCT_QUESTION_FIELD_NAMES,
  SUPPORT_PRODUCT_QUESTION_FIELDS,
  SUPPORT_REFERENCE_FIELD_NAMES,
  SUPPORT_REFERENCE_FIELDS,
  SUPPORT_TECHNICAL_ENVIRONMENT_FIELD_NAMES,
  SUPPORT_TECHNICAL_ENVIRONMENT_FIELDS,
  SUPPORT_TEMPORALITY_AND_IMPACT_FIELD_NAMES,
  SUPPORT_TEMPORALITY_AND_IMPACT_FIELDS
};
