import type {
  ExtractableFieldDefinition
} from "../typesSupportProcessingPipelineV2.types";
import type {
  FormatSelectCatalogKnowledgeForTopicOutputInput,
  RawSelectedCatalogKnowledgeForTopic,
  SelectedCatalogKnowledgeForTopic
} from "./typesSelectCatalogKnowledgeForTopic.types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const values: string[] = [];

  for (const item of value) {
    if (!isNonEmptyString(item)) {
      return undefined;
    }

    values.push(item.trim());
  }

  return Array.from(new Set(values));
}

function mapSelectedFields(params: {
  fieldNames: string[];
  catalog: ExtractableFieldDefinition[];
}): ExtractableFieldDefinition[] {
  const fieldByName = new Map(params.catalog.map((field) => {
    return [field.fieldName, field];
  }));

  return params.fieldNames.flatMap((fieldName) => {
    const field = fieldByName.get(fieldName);

    return field ? [field] : [];
  });
}

const BILLING_FIELD_NAMES = new Set([
  "plan_or_subscription",
  "billing_or_payment_status",
  "billing_issue_type",
  "duplicate_billing_impact",
  "billing_provider",
  "amount",
  "currency",
  "billing_date_or_period",
  "payment_method"
]);

const ACCESS_FIELD_NAMES = new Set([
  "account_status",
  "access_action",
  "auth_method",
  "server_or_instance",
  "recovery_channel",
  "user_role_or_permission",
  "mfa_status"
]);

function getTopicCategoryHints(
  input: FormatSelectCatalogKnowledgeForTopicOutputInput
): Set<string> {
  return new Set(
    input.input.topicEvidence.relatedTextUnderstandings.flatMap(
      (understanding) => {
        return understanding.broadCategoryHint
          ? [understanding.broadCategoryHint]
          : [];
      }
    )
  );
}

function isCrossTopicField(params: {
  fieldName: string;
  topicCategoryHints: Set<string>;
}): boolean {
  if (
    params.topicCategoryHints.has("access_security") &&
    !params.topicCategoryHints.has("billing") &&
    BILLING_FIELD_NAMES.has(params.fieldName)
  ) {
    return true;
  }

  return params.topicCategoryHints.has("billing") &&
    !params.topicCategoryHints.has("access_security") &&
    ACCESS_FIELD_NAMES.has(params.fieldName);
}

function buildFallback(
  input: FormatSelectCatalogKnowledgeForTopicOutputInput,
  reason: string
): SelectedCatalogKnowledgeForTopic {
  return {
    selectedFields: [],
    selectedGenericKnowledge: [],
    scopeReason: `catalog_selection_fallback:${reason}`,
    rejectedFieldNames: input.input.extractableFieldCatalog.map((field) => {
      return field.fieldName;
    }),
    warnings: [reason]
  };
}

function formatSelectCatalogKnowledgeForTopicOutput(
  input: FormatSelectCatalogKnowledgeForTopicOutputInput
): SelectedCatalogKnowledgeForTopic {
  if (input.rawSelectCatalogKnowledgeForTopic.status !== "completed") {
    return buildFallback(
      input,
      input.rawSelectCatalogKnowledgeForTopic.error?.message ??
        "llm_call_failed"
    );
  }

  if (!isRecord(input.rawSelectCatalogKnowledgeForTopic.parsedResponse)) {
    return buildFallback(input, "invalid_or_missing_parsed_response");
  }

  const raw = input.rawSelectCatalogKnowledgeForTopic
    .parsedResponse as RawSelectedCatalogKnowledgeForTopic;
  const selectedFieldNames = stringArray(raw.selectedFieldNames);
  const selectedGenericKnowledgeIds = stringArray(
    raw.selectedGenericKnowledgeIds
  );
  const rejectedFieldNames = stringArray(raw.rejectedFieldNames);
  const warnings = stringArray(raw.warnings);

  if (
    !selectedFieldNames ||
    !selectedGenericKnowledgeIds ||
    !rejectedFieldNames ||
    !warnings ||
    !isNonEmptyString(raw.scopeReason)
  ) {
    return buildFallback(input, "invalid_selection_contract");
  }

  const allowedFieldNames = new Set(
    input.input.extractableFieldCatalog.map((field) => field.fieldName)
  );
  const topicCategoryHints = getTopicCategoryHints(input);
  const unknownSelectedFields = selectedFieldNames.filter((fieldName) => {
    return !allowedFieldNames.has(fieldName);
  });
  const crossTopicSelectedFields = selectedFieldNames.filter((fieldName) => {
    return allowedFieldNames.has(fieldName) &&
      isCrossTopicField({
        fieldName,
        topicCategoryHints
      });
  });
  const validSelectedFieldNames = selectedFieldNames.filter((fieldName) => {
    return allowedFieldNames.has(fieldName) &&
      !crossTopicSelectedFields.includes(fieldName);
  });
  const validRejectedFieldNames = rejectedFieldNames.filter((fieldName) => {
    return allowedFieldNames.has(fieldName) &&
      !validSelectedFieldNames.includes(fieldName);
  });
  const selectedFields = mapSelectedFields({
    fieldNames: validSelectedFieldNames,
    catalog: input.input.extractableFieldCatalog
  });

  return {
    selectedFields,
    selectedGenericKnowledge: [],
    scopeReason: raw.scopeReason.trim(),
    rejectedFieldNames: Array.from(new Set([
      ...validRejectedFieldNames,
      ...crossTopicSelectedFields
    ])),
    ...(warnings.length > 0 ||
      unknownSelectedFields.length > 0 ||
      crossTopicSelectedFields.length > 0 ||
      selectedGenericKnowledgeIds.length > 0
      ? {
          warnings: Array.from(new Set([
            ...warnings,
            ...unknownSelectedFields.map((fieldName) => {
              return `unknown_selected_field:${fieldName}`;
            }),
            ...crossTopicSelectedFields.map((fieldName) => {
              return `cross_topic_field_rejected:${fieldName}`;
            }),
            ...(selectedGenericKnowledgeIds.length > 0
              ? ["generic_knowledge_not_available_in_input"]
              : [])
          ]))
        }
      : {})
  };
}

export {
  formatSelectCatalogKnowledgeForTopicOutput
};
