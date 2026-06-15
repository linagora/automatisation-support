import type {
  ExtractableFieldDefinition
} from "../typesSupportProcessingPipelineV2.types";

const SUPPORT_IDENTITY_AND_ACCOUNT_FIELDS: ExtractableFieldDefinition[] = [
  {
    fieldName: "user_identifier",
    description:
      "Stable user identity explicitly provided in the message, such as login, username, or user id."
  },
  {
    fieldName: "account_identifier",
    description:
      "Stable account identifier explicitly provided in the message, such as account id, tenant id, or customer id."
  },
  {
    fieldName: "account_status",
    description:
      "Explicit status of the account or access state, such as blocked, suspended, active, or pending."
  }
];

const SUPPORT_ORGANIZATION_AND_PRODUCT_FIELDS: ExtractableFieldDefinition[] = [
  {
    fieldName: "organization_name",
    description:
      "Organization, company, school, or customer entity explicitly named by the user."
  },
  {
    fieldName: "workspace_name",
    description:
      "Workspace, team, room, project, tenant, or shared space explicitly involved in the request."
  },
  {
    fieldName: "product_or_service",
    description:
      "Product, service, application, module, or integration explicitly mentioned as affected."
  },
  {
    fieldName: "feature_or_page",
    description:
      "Specific feature, page, screen, flow, button, or product capability explicitly involved."
  }
];

const SUPPORT_TECHNICAL_ENVIRONMENT_FIELDS: ExtractableFieldDefinition[] = [
  {
    fieldName: "platform",
    description:
      "Execution platform explicitly mentioned by the user, such as web, desktop, mobile, Android, or iOS."
  },
  {
    fieldName: "operating_system",
    description:
      "Operating system explicitly mentioned by the user, including version when provided."
  },
  {
    fieldName: "browser",
    description:
      "Browser or webview explicitly mentioned by the user, including version when provided."
  },
  {
    fieldName: "app_version",
    description:
      "Application, client, plugin, or extension version explicitly provided by the user."
  },
  {
    fieldName: "device",
    description:
      "Device model, hardware, or device category explicitly mentioned by the user."
  }
];

const SUPPORT_OBSERVED_BEHAVIOR_FIELDS: ExtractableFieldDefinition[] = [
  {
    fieldName: "pre_problem_state",
    description:
      "State that existed before the issue started, when explicitly described."
  },
  {
    fieldName: "trigger_action",
    description:
      "User action, event, or condition that explicitly triggers the observed issue."
  },
  {
    fieldName: "error_message",
    description:
      "Exact error text, error code, warning, or failure message displayed to the user."
  },
  {
    fieldName: "observed_result",
    description:
      "What the user says actually happens, including failed outcomes and visible behavior."
  },
  {
    fieldName: "expected_result",
    description:
      "What the user explicitly expected or wanted to happen instead."
  },
  {
    fieldName: "available_workaround",
    description:
      "Workaround explicitly available or unavailable for the user."
  }
];

const SUPPORT_TEMPORALITY_AND_IMPACT_FIELDS: ExtractableFieldDefinition[] = [
  {
    fieldName: "issue_started_at",
    description:
      "Date, time, or relative moment when the issue explicitly started."
  },
  {
    fieldName: "issue_duration",
    description:
      "Explicit duration of the issue, such as since yesterday, for two weeks, or several hours."
  },
  {
    fieldName: "deadline_or_expected_date",
    description:
      "Deadline, expected resolution date, renewal date, or date by which action is needed."
  },
  {
    fieldName: "frequency",
    description:
      "How often the issue occurs when explicitly stated, such as always, sometimes, once, or after each login."
  },
  {
    fieldName: "affected_scope",
    description:
      "Explicit scope of the issue, such as one workspace, one file, all channels, or the whole organization."
  },
  {
    fieldName: "affected_users",
    description:
      "Users, groups, roles, or number of people explicitly affected."
  },
  {
    fieldName: "user_impact",
    description:
      "Explicit business, usage, access, productivity, or user-facing impact caused by the issue."
  }
];

const SUPPORT_ACCESS_AND_AUTH_FIELDS: ExtractableFieldDefinition[] = [
  {
    fieldName: "access_action",
    description:
      "Access or authentication action explicitly attempted or requested, such as login, invite, reset, or unlock."
  },
  {
    fieldName: "auth_method",
    description:
      "Authentication method explicitly mentioned, such as password, SSO, OAuth, magic link, or email code."
  },
  {
    fieldName: "server_or_instance",
    description:
      "Server, instance, tenant, domain, or deployment endpoint explicitly involved."
  },
  {
    fieldName: "recovery_channel",
    description:
      "Recovery channel explicitly mentioned, such as email, SMS, backup code, or administrator approval."
  },
  {
    fieldName: "user_role_or_permission",
    description:
      "Role, permission, entitlement, or authorization level explicitly mentioned."
  },
  {
    fieldName: "mfa_status",
    description:
      "Multi-factor authentication state explicitly mentioned, such as enabled, disabled, required, or unavailable."
  }
];

const SUPPORT_INTEGRATION_AND_SYNC_FIELDS: ExtractableFieldDefinition[] = [
  {
    fieldName: "integration_or_connector",
    description:
      "Integration, connector, external app, bot, or service explicitly involved."
  },
  {
    fieldName: "sync_target",
    description:
      "Explicit object, system, workspace, calendar, file, or destination being synchronized."
  },
  {
    fieldName: "sync_status",
    description:
      "Explicit synchronization state, such as pending, stuck, failed, delayed, duplicated, or complete."
  }
];

const SUPPORT_BILLING_AND_PAYMENT_FIELDS: ExtractableFieldDefinition[] = [
  {
    fieldName: "plan_or_subscription",
    description:
      "Plan, subscription, license, quota, entitlement, or package explicitly mentioned."
  },
  {
    fieldName: "billing_or_payment_status",
    description:
      "Invoice, payment, billing state, renewal, refund, charge, or payment failure explicitly mentioned."
  },
  {
    fieldName: "billing_issue_type",
    description:
      "Billing issue type explicitly stated, such as invoice, refund, renewal, duplicate charge, or failed payment."
  },
  {
    fieldName: "billing_provider",
    description:
      "Payment processor, billing provider, marketplace, bank, or card provider explicitly mentioned."
  },
  {
    fieldName: "amount",
    description:
      "Monetary amount, quota amount, or billable quantity explicitly mentioned."
  },
  {
    fieldName: "currency",
    description:
      "Currency explicitly mentioned, such as EUR, USD, or a currency symbol."
  },
  {
    fieldName: "billing_date_or_period",
    description:
      "Billing date, invoice period, subscription period, renewal period, or payment date explicitly mentioned."
  },
  {
    fieldName: "payment_method",
    description:
      "Payment method explicitly mentioned, such as card, bank transfer, PayPal, SEPA, or invoice."
  }
];

const SUPPORT_PRODUCT_QUESTION_FIELDS: ExtractableFieldDefinition[] = [
  {
    fieldName: "question_intent",
    description:
      "Intent of a product question explicitly asked, such as how-to, possibility, configuration, pricing, or compatibility."
  },
  {
    fieldName: "gap_observed",
    description:
      "Missing capability, unsupported behavior, or product gap explicitly observed by the user."
  }
];

const SUPPORT_ACCESSIBILITY_FIELDS: ExtractableFieldDefinition[] = [
  {
    fieldName: "assistive_technology",
    description:
      "Assistive technology explicitly mentioned, such as screen reader, keyboard navigation, voice control, or magnifier."
  },
  {
    fieldName: "accessibility_barrier",
    description:
      "Accessibility barrier explicitly described, such as unreadable label, missing focus, contrast issue, or keyboard trap."
  },
  {
    fieldName: "inaccessible_element",
    description:
      "UI element, control, content, or workflow explicitly identified as inaccessible."
  }
];

const SUPPORT_MIGRATION_FIELDS: ExtractableFieldDefinition[] = [
  {
    fieldName: "migration_or_transition_context",
    description:
      "Migration, transition, rollout, import, export, or product change context explicitly mentioned."
  },
  {
    fieldName: "previous_product_or_service",
    description:
      "Previous product, service, plan, tenant, or tool explicitly referenced in a migration or transition."
  }
];

const SUPPORT_REFERENCE_FIELDS: ExtractableFieldDefinition[] = [
  {
    fieldName: "provided_url",
    description:
      "URL, link, domain, callback URL, webhook URL, or page address explicitly provided."
  },
  {
    fieldName: "reference_id",
    description:
      "Ticket id, invoice id, order id, transaction id, email id, request id, or other explicit reference identifier."
  }
];

const DEFAULT_SUPPORT_EXTRACTABLE_FIELD_CATALOG: ExtractableFieldDefinition[] = [
  ...SUPPORT_IDENTITY_AND_ACCOUNT_FIELDS,
  ...SUPPORT_ORGANIZATION_AND_PRODUCT_FIELDS,
  ...SUPPORT_TECHNICAL_ENVIRONMENT_FIELDS,
  ...SUPPORT_OBSERVED_BEHAVIOR_FIELDS,
  ...SUPPORT_TEMPORALITY_AND_IMPACT_FIELDS,
  ...SUPPORT_ACCESS_AND_AUTH_FIELDS,
  ...SUPPORT_INTEGRATION_AND_SYNC_FIELDS,
  ...SUPPORT_BILLING_AND_PAYMENT_FIELDS,
  ...SUPPORT_PRODUCT_QUESTION_FIELDS,
  ...SUPPORT_ACCESSIBILITY_FIELDS,
  ...SUPPORT_MIGRATION_FIELDS,
  ...SUPPORT_REFERENCE_FIELDS
];

function buildSupportExtractableFieldCatalog(
  overrides: ExtractableFieldDefinition[] = []
): ExtractableFieldDefinition[] {
  const fieldByName = new Map<string, ExtractableFieldDefinition>();

  for (const field of DEFAULT_SUPPORT_EXTRACTABLE_FIELD_CATALOG) {
    fieldByName.set(field.fieldName, field);
  }

  for (const field of overrides) {
    fieldByName.set(field.fieldName, field);
  }

  return Array.from(fieldByName.values());
}

export {
  DEFAULT_SUPPORT_EXTRACTABLE_FIELD_CATALOG,
  SUPPORT_ACCESSIBILITY_FIELDS,
  SUPPORT_ACCESS_AND_AUTH_FIELDS,
  SUPPORT_BILLING_AND_PAYMENT_FIELDS,
  SUPPORT_IDENTITY_AND_ACCOUNT_FIELDS,
  SUPPORT_INTEGRATION_AND_SYNC_FIELDS,
  SUPPORT_MIGRATION_FIELDS,
  SUPPORT_OBSERVED_BEHAVIOR_FIELDS,
  SUPPORT_ORGANIZATION_AND_PRODUCT_FIELDS,
  SUPPORT_PRODUCT_QUESTION_FIELDS,
  SUPPORT_REFERENCE_FIELDS,
  SUPPORT_TECHNICAL_ENVIRONMENT_FIELDS,
  SUPPORT_TEMPORALITY_AND_IMPACT_FIELDS,
  buildSupportExtractableFieldCatalog
};
