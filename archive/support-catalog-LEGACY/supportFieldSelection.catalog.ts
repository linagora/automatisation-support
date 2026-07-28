import {
  CASE_DETAIL_FIELD_DEFINITIONS,
  CASE_DETAIL_FIELDS,
  SUPPORT_METADATA_FIELD_DEFINITIONS,
  getCaseDetailFieldsByName,
  getSupportMetadataFieldsByName
} from "./supportFields.catalog";

import type {
  BroadCategoryHint,
  BroadIntentMode,
  StrictBroadCategoryHint,
  StrictBroadIntentMode,
  StrictSupportCaseDetailFieldName,
  StrictSupportMetadataFieldName,
  SupportCaseDetailFieldName
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

function getCandidateFieldsForCatalogSelection(params: {
  broadIntent?: BroadIntentMode | null;
  broadCategoryHint?: BroadCategoryHint | null;
}): string[] {
  const byIntent = params.broadIntent &&
    params.broadIntent in BROAD_INTENT_CANDIDATE_FIELD_NAMES
    ? BROAD_INTENT_CANDIDATE_FIELD_NAMES[
        params.broadIntent as StrictBroadIntentMode
      ]
    : [];
  const byCategory = params.broadCategoryHint &&
    params.broadCategoryHint in CATEGORY_CANDIDATE_FIELD_NAMES
    ? CATEGORY_CANDIDATE_FIELD_NAMES[
        params.broadCategoryHint as StrictBroadCategoryHint
      ]
    : CATEGORY_CANDIDATE_FIELD_NAMES.other;

  return Array.from(new Set([
    ...byIntent,
    ...byCategory
  ]));
}

type CatalogDiagnosticFlowName =
  | "issue_diagnostic"
  | "access_diagnostic"
  | "billing_diagnostic"
  | "request_clarification";

type CatalogDiagnosticFlowDefinition = {
  label: string;
  targetFieldNames: SupportCaseDetailFieldName[];
  attemptedActionsRelevant?: boolean;
  guidance: string;
};

type CatalogDiagnosticFlow = CatalogDiagnosticFlowDefinition & {
  name: CatalogDiagnosticFlowName;
};

const CATALOG_DIAGNOSTIC_FLOW_DEFINITIONS = {
  issue_diagnostic: {
    label: "Issue diagnostic",
    targetFieldNames: [
      "trigger_action",
      "failure_step",
      "observed_result",
      "expected_result",
      "reproduction_steps",
      "pre_problem_state"
    ],
    attemptedActionsRelevant: true,
    guidance:
      "Ask the user to describe the exact steps they follow, where the problem appears, what happens, what they expected, and whether they already tried anything."
  },
  access_diagnostic: {
    label: "Access diagnostic",
    targetFieldNames: [
      "access_action",
      "auth_method",
      "failure_step",
      "error_message",
      "account_status"
    ],
    attemptedActionsRelevant: true,
    guidance:
      "Ask where the access/login/account flow blocks, which authentication method is used, and whether an error or account status is shown."
  },
  billing_diagnostic: {
    label: "Billing diagnostic",
    targetFieldNames: [
      "billing_issue_type",
      "billing_date_or_period",
      "amount",
      "currency",
      "reference_id",
      "billing_or_payment_status"
    ],
    attemptedActionsRelevant: false,
    guidance:
      "Ask which billing/payment operation is concerned, the date or period, the amount/currency, and any invoice/payment/reference identifier."
  },
  request_clarification: {
    label: "Request clarification",
    targetFieldNames: [
      "expected_result",
      "user_impact",
      "workflow_context",
      "feature_or_page"
    ],
    attemptedActionsRelevant: false,
    guidance:
      "Ask what the user wants to achieve, in which workflow or feature, and what impact or improvement is expected."
  }
} as const satisfies Record<
  CatalogDiagnosticFlowName,
  CatalogDiagnosticFlowDefinition
>;

const CATALOG_DIAGNOSTIC_FLOW_NAMES_BY_INTENT_AND_CATEGORY = {
  issue: {
    default: [
      "issue_diagnostic"
    ],
    access_security: [
      "access_diagnostic"
    ],
    billing: [
      "billing_diagnostic"
    ]
  },
  request: {
    default: [
      "request_clarification"
    ]
  },
  faq: {
    default: []
  },
  unclear: {
    default: []
  }
} as const satisfies Record<
  StrictBroadIntentMode,
  Partial<Record<StrictBroadCategoryHint | "default", readonly CatalogDiagnosticFlowName[]>>
>;

function materializeDiagnosticFlow(
  name: CatalogDiagnosticFlowName
): CatalogDiagnosticFlow {
  return {
    name,
    ...CATALOG_DIAGNOSTIC_FLOW_DEFINITIONS[name]
  };
}

function getCandidateDiagnosticFlowsForCatalogSelection(params: {
  broadIntent?: BroadIntentMode | null;
  broadCategoryHint?: BroadCategoryHint | null;
}): CatalogDiagnosticFlow[] {
  if (
    !params.broadIntent ||
    !(params.broadIntent in CATALOG_DIAGNOSTIC_FLOW_NAMES_BY_INTENT_AND_CATEGORY)
  ) {
    return [];
  }

  const flowNamesByCategory =
    CATALOG_DIAGNOSTIC_FLOW_NAMES_BY_INTENT_AND_CATEGORY[
      params.broadIntent as StrictBroadIntentMode
    ];
  const categoryFlowNames = params.broadCategoryHint &&
    params.broadCategoryHint in flowNamesByCategory
    ? flowNamesByCategory[
        params.broadCategoryHint as keyof typeof flowNamesByCategory
      ]
    : undefined;
  const flowNames = categoryFlowNames ?? flowNamesByCategory.default ?? [];

  return Array.from(new Set(flowNames)).map(materializeDiagnosticFlow);
}

type SupportCaseDetailLike = {
  key: string;
  value: string | number | boolean | null;
};

type TemporarySelectedCatalogKnowledgeProjection = {
  selectedFieldNames: string[];
  selectedFields: {
    fieldName: string;
    description: string;
    askableByUser?: boolean;
  }[];
  selectedGenericKnowledge: unknown[];
  scopeReason: string;
};

type SupportKnowledgeRetrievalFiltersProjection = {
  productOrService?: string;
  featureOrPage?: string;
  platform?: string;
  operatingSystem?: string;
};

const TEMPORARY_SELECTED_CATALOG_BROAD_CATEGORY_FIELD_NAMES = {
  billing: [
    "duplicate_billing_impact",
    "billing_issue_type",
    "billing_date_or_period",
    "amount",
    "currency"
  ],
  bug: [
    "feature_or_page",
    "trigger_action",
    "error_message",
    "observed_result",
    "platform",
    "browser"
  ],
  access_security: [
    "access_action",
    "auth_method",
    "account_status",
    "error_message"
  ]
} as const satisfies Partial<Record<
  StrictBroadCategoryHint,
  readonly StrictSupportCaseDetailFieldName[]
>>;

const TEMPORARY_SELECTED_CATALOG_TRIGGER_FIELD_NAMES = [
  {
    whenAnyFieldName: [
      "billing_issue_type",
      "billing_date_or_period",
      "amount",
      "currency"
    ],
    addFieldNames: TEMPORARY_SELECTED_CATALOG_BROAD_CATEGORY_FIELD_NAMES.billing
  },
  {
    whenAnyFieldName: [
      "feature_or_page",
      "trigger_action",
      "error_message",
      "observed_result"
    ],
    addFieldNames: TEMPORARY_SELECTED_CATALOG_BROAD_CATEGORY_FIELD_NAMES.bug
  },
  {
    whenAnyFieldName: [
      "access_action",
      "auth_method",
      "account_status"
    ],
    addFieldNames:
      TEMPORARY_SELECTED_CATALOG_BROAD_CATEGORY_FIELD_NAMES.access_security
  }
] as const;

const SUPPORT_KNOWLEDGE_RETRIEVAL_FILTER_FIELD_NAMES = {
  productOrService: [
    "product_or_service"
  ],
  featureOrPage: [
    "feature_or_page"
  ],
  platform: [
    "platform",
    "device"
  ],
  operatingSystem: [
    "operating_system"
  ]
} as const satisfies Record<
  keyof SupportKnowledgeRetrievalFiltersProjection,
  readonly StrictSupportCaseDetailFieldName[]
>;

function toExtractableFieldDefinitionProjection(
  field: typeof CASE_DETAIL_FIELDS[number]
): TemporarySelectedCatalogKnowledgeProjection["selectedFields"][number] {
  return {
    fieldName: field.key,
    description: field.description,
    askableByUser: field.askable ?? true
  };
}

function addFieldNames(
  selectedFieldNames: Set<string>,
  fieldNames: readonly string[]
): void {
  for (const fieldName of fieldNames) {
    selectedFieldNames.add(fieldName);
  }
}

function buildTemporarySelectedCatalogKnowledge(params: {
  relatedTextUnderstandings: {
    broadCategoryHint?: string | null;
    caseDetails?: SupportCaseDetailLike[];
  }[];
  relatedAttachmentUnderstandings: unknown[];
}): TemporarySelectedCatalogKnowledgeProjection {
  const selectedFieldNames = new Set<string>();

  for (const understanding of params.relatedTextUnderstandings) {
    const caseDetailKeys = new Set(
      (understanding.caseDetails ?? []).map((detail) => detail.key)
    );

    for (const key of caseDetailKeys) {
      selectedFieldNames.add(key);
    }

    const categoryFieldNames = understanding.broadCategoryHint &&
      understanding.broadCategoryHint in
        TEMPORARY_SELECTED_CATALOG_BROAD_CATEGORY_FIELD_NAMES
      ? TEMPORARY_SELECTED_CATALOG_BROAD_CATEGORY_FIELD_NAMES[
          understanding.broadCategoryHint as keyof typeof TEMPORARY_SELECTED_CATALOG_BROAD_CATEGORY_FIELD_NAMES
        ]
      : undefined;

    if (categoryFieldNames) {
      addFieldNames(selectedFieldNames, categoryFieldNames);
    }

    for (const rule of TEMPORARY_SELECTED_CATALOG_TRIGGER_FIELD_NAMES) {
      const shouldAddFields = rule.whenAnyFieldName.some((fieldName) => {
        return caseDetailKeys.has(fieldName);
      });

      if (shouldAddFields) {
        addFieldNames(selectedFieldNames, rule.addFieldNames);
      }
    }
  }

  if (params.relatedAttachmentUnderstandings.length > 0) {
    selectedFieldNames.add("visual_evidence");
  }

  const selectedFields = CASE_DETAIL_FIELDS.filter((fieldDefinition) => {
      return selectedFieldNames.has(fieldDefinition.key);
    }).map(toExtractableFieldDefinitionProjection);

  return {
    selectedFieldNames: selectedFields.map((field) => field.fieldName),
    selectedFields,
    selectedGenericKnowledge: [],
    scopeReason: "temporary_topic_catalog_selection"
  };
}

function compactSupportKnowledgeFilterValue(
  value: SupportCaseDetailLike["value"]
): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const compacted = value.replace(/\s+/g, " ").trim();

  return compacted.length > 0 ? compacted : undefined;
}

function findFirstDetailValueForFieldNames(
  details: SupportCaseDetailLike[],
  fieldNames: readonly string[]
): string | undefined {
  const allowedFieldNames = new Set(fieldNames);
  const detail = details.find((candidate) => {
    return allowedFieldNames.has(candidate.key);
  });

  return compactSupportKnowledgeFilterValue(detail?.value ?? null);
}

function buildSupportKnowledgeRetrievalFiltersFromCaseDetails(
  details: SupportCaseDetailLike[]
): SupportKnowledgeRetrievalFiltersProjection {
  const filters: SupportKnowledgeRetrievalFiltersProjection = {};

  for (const [filterKey, fieldNames] of Object.entries(
    SUPPORT_KNOWLEDGE_RETRIEVAL_FILTER_FIELD_NAMES
  ) as [
    keyof SupportKnowledgeRetrievalFiltersProjection,
    readonly string[]
  ][]) {
    const value = findFirstDetailValueForFieldNames(details, fieldNames);

    if (value) {
      filters[filterKey] = value;
    }
  }

  return filters;
}

export {
  ALL_CASE_DETAIL_FIELD_NAMES,
  ANALYZE_SUPPORT_TEXT_CASE_DETAIL_FIELD_NAMES,
  ANALYZE_SUPPORT_TEXT_CASE_DETAIL_FIELDS,
  ANALYZE_SUPPORT_TEXT_SUPPORT_METADATA_FIELD_NAMES,
  ANALYZE_SUPPORT_TEXT_SUPPORT_METADATA_FIELDS,
  BROAD_INTENT_CANDIDATE_FIELD_NAMES,
  CATALOG_DIAGNOSTIC_FLOW_DEFINITIONS,
  CATALOG_DIAGNOSTIC_FLOW_NAMES_BY_INTENT_AND_CATEGORY,
  CATEGORY_CANDIDATE_FIELD_NAMES,
  SUPPORT_KNOWLEDGE_RETRIEVAL_FILTER_FIELD_NAMES,
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
  SUPPORT_TEMPORALITY_AND_IMPACT_FIELDS,
  TEMPORARY_SELECTED_CATALOG_BROAD_CATEGORY_FIELD_NAMES,
  TEMPORARY_SELECTED_CATALOG_TRIGGER_FIELD_NAMES,
  buildSupportKnowledgeRetrievalFiltersFromCaseDetails,
  getCandidateDiagnosticFlowsForCatalogSelection,
  getCandidateFieldsForCatalogSelection,
  buildTemporarySelectedCatalogKnowledge
};

export type {
  CatalogDiagnosticFlow,
  CatalogDiagnosticFlowDefinition,
  CatalogDiagnosticFlowName,
  SupportKnowledgeRetrievalFiltersProjection,
  TemporarySelectedCatalogKnowledgeProjection
};
