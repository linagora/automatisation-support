import type {
  ExtractableFieldDefinition,
  MergedTopicSnapshot
} from "../typesSupportProcessingPipelineV2.types";

type KnownTopicField = {
  fieldName: string;
  value: unknown;
  evidence?: string;
};

type TopicSelectorCandidateFields = {
  knownFields: KnownTopicField[];
  candidateFields: ExtractableFieldDefinition[];
};

const CATEGORY_CANDIDATE_FIELD_NAMES: Record<string, string[]> = {
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
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function addKnownField(
  knownFieldsByName: Map<string, KnownTopicField>,
  field: KnownTopicField
): void {
  if (field.fieldName.trim() === "" || knownFieldsByName.has(field.fieldName)) {
    return;
  }

  knownFieldsByName.set(field.fieldName, field);
}

function buildKnownFields(topicSnapshot: MergedTopicSnapshot): KnownTopicField[] {
  const knownFieldsByName = new Map<string, KnownTopicField>();

  for (const detail of topicSnapshot.caseDetails ?? []) {
    addKnownField(knownFieldsByName, {
      fieldName: detail.key,
      value: detail.value,
      evidence: detail.evidence
    });
  }

  const snapshotRecord = topicSnapshot as unknown as Record<string, unknown>;
  const supportMetadata = snapshotRecord.supportMetadata;

  if (Array.isArray(supportMetadata)) {
    for (const metadata of supportMetadata) {
      if (!isRecord(metadata) || typeof metadata.key !== "string") {
        continue;
      }

      addKnownField(knownFieldsByName, {
        fieldName: metadata.key,
        value: metadata.value,
        ...(typeof metadata.evidence === "string"
          ? { evidence: metadata.evidence }
          : {})
      });
    }
  }

  if (isRecord(topicSnapshot.topic_details)) {
    for (const [fieldName, value] of Object.entries(topicSnapshot.topic_details)) {
      addKnownField(knownFieldsByName, {
        fieldName,
        value
      });
    }
  }

  return Array.from(knownFieldsByName.values());
}

function buildCandidateFieldsForTopicSelector(params: {
  topicSnapshot: MergedTopicSnapshot;
  extractableFieldCatalog: ExtractableFieldDefinition[];
}): TopicSelectorCandidateFields {
  const catalogByName = new Map(params.extractableFieldCatalog.map((field) => {
    return [field.fieldName, field];
  }));
  const knownFields = buildKnownFields(params.topicSnapshot).filter((field) => {
    return catalogByName.has(field.fieldName);
  });
  const knownFieldNames = new Set(knownFields.map((field) => {
    return field.fieldName;
  }));
  const broadCategoryHint =
    params.topicSnapshot.broadCategoryHint &&
    CATEGORY_CANDIDATE_FIELD_NAMES[params.topicSnapshot.broadCategoryHint]
      ? params.topicSnapshot.broadCategoryHint
      : "other";
  const candidateFields = CATEGORY_CANDIDATE_FIELD_NAMES[
    broadCategoryHint
  ].flatMap((fieldName) => {
    const field = catalogByName.get(fieldName);

    if (!field || knownFieldNames.has(fieldName) || field.askableByUser === false) {
      return [];
    }

    return [field];
  });

  return {
    knownFields,
    candidateFields
  };
}

export {
  CATEGORY_CANDIDATE_FIELD_NAMES,
  buildCandidateFieldsForTopicSelector
};

export type {
  KnownTopicField,
  TopicSelectorCandidateFields
};
