import type {
  ExtractableFieldDefinition
} from "../typesSupportProcessingPipelineV2.types";

function field(
  fieldName: ExtractableFieldDefinition["fieldName"],
  description: string,
  askableByUser: boolean = true
): ExtractableFieldDefinition {
  return {
    fieldName,
    description,
    askableByUser
  };
}

const SUPPORT_IDENTITY_AND_ACCOUNT_FIELDS: ExtractableFieldDefinition[] = [
  field("user_identifier", "Login, username or user id."),
  field("account_identifier", "Account, tenant or customer id."),
  field(
    "account_status",
    "Account/access status: blocked, suspended, active, pending.",
    false
  )
];

const SUPPORT_ORGANIZATION_AND_PRODUCT_FIELDS: ExtractableFieldDefinition[] = [
  field("organization_name", "Organization, company, school or customer entity."),
  field("workspace_name", "Workspace, team, room, project, tenant or shared space."),
  field("product_or_service", "Product, service, app, module or integration."),
  field("feature_or_page", "Feature, page, screen, flow, button or capability.")
];

const SUPPORT_TECHNICAL_ENVIRONMENT_FIELDS: ExtractableFieldDefinition[] = [
  field("platform", "Platform: web, desktop, mobile, Android, iOS."),
  field("operating_system", "Operating system, with version if provided."),
  field("browser", "Browser or webview, with version if provided."),
  field("app_version", "App, client, plugin or extension version."),
  field("device", "Device model, hardware or device category."),
  field(
    "notification_permission_status",
    "Whether the operating system permission to display notifications is granted."
  ),
  field(
    "notification_channel_status",
    "Whether the relevant application notification channel is enabled."
  )
];

const SUPPORT_OBSERVED_BEHAVIOR_FIELDS: ExtractableFieldDefinition[] = [
  field("pre_problem_state", "State before the issue started."),
  field("trigger_action", "Action, event or condition triggering the issue."),
  field("error_message", "Exact error text, error code or warning."),
  field("observed_result", "What actually happens."),
  field("expected_result", "What the user expected instead."),
  field("available_workaround", "Workaround explicitly available or unavailable.")
];

const SUPPORT_TEMPORALITY_AND_IMPACT_FIELDS: ExtractableFieldDefinition[] = [
  field("issue_started_at", "When the issue started."),
  field("issue_duration", "How long the issue has lasted."),
  field("deadline_or_expected_date", "Deadline, renewal date or expected action date."),
  field("frequency", "How often the issue occurs."),
  field("affected_scope", "Affected scope: file, workspace, channel, organization, etc."),
  field("affected_users", "Users, groups, roles or number of people affected."),
  field("user_impact", "Business, usage, access or productivity impact.")
];

const SUPPORT_ACCESS_AND_AUTH_FIELDS: ExtractableFieldDefinition[] = [
  field("access_action", "Access/auth action: login, invite, reset, unlock."),
  field("auth_method", "Auth method: password, SSO, OAuth, magic link, email code."),
  field("server_or_instance", "Server, instance, tenant, domain or endpoint."),
  field("recovery_channel", "Recovery channel: email, SMS, backup code, admin approval."),
  field("user_role_or_permission", "Role, permission, entitlement or authorization level."),
  field("mfa_status", "MFA state: enabled, disabled, required, unavailable.")
];

const SUPPORT_INTEGRATION_AND_SYNC_FIELDS: ExtractableFieldDefinition[] = [
  field("integration_or_connector", "Integration, connector, external app, bot or service."),
  field("sync_target", "Object, system, workspace, calendar, file or destination being synced."),
  field("sync_status", "Sync state: pending, stuck, failed, delayed, duplicated, complete.")
];

const SUPPORT_BILLING_AND_PAYMENT_FIELDS: ExtractableFieldDefinition[] = [
  field("plan_or_subscription", "Plan, subscription, license, quota or package."),
  field("billing_or_payment_status", "Invoice, payment, renewal, refund, charge or failure state."),
  field("billing_issue_type", "Issue type: invoice, refund, renewal, duplicate charge, failed payment."),
  field(
    "duplicate_billing_impact",
    "Whether duplicate billing wording means duplicate document only or duplicate payment/charge too."
  ),
  field("billing_provider", "Payment processor, marketplace, bank or card provider."),
  field("amount", "Monetary amount, quota amount or billable quantity."),
  field("currency", "Currency: EUR, USD, symbol, etc."),
  field("billing_date_or_period", "Billing, invoice, subscription, renewal or payment period."),
  field("payment_method", "Payment method: card, bank transfer, PayPal, SEPA, invoice.")
];

const SUPPORT_PRODUCT_QUESTION_FIELDS: ExtractableFieldDefinition[] = [
  field("question_intent", "Question intent: how-to, possibility, setup, pricing, compatibility."),
  field("gap_observed", "Missing capability, unsupported behavior or product gap.")
];

const SUPPORT_ACCESSIBILITY_FIELDS: ExtractableFieldDefinition[] = [
  field("assistive_technology", "Screen reader, keyboard navigation, voice control, magnifier, etc."),
  field("accessibility_barrier", "Barrier: label, focus, contrast, keyboard trap, etc."),
  field("inaccessible_element", "UI element, content or workflow that is inaccessible.")
];

const SUPPORT_MIGRATION_FIELDS: ExtractableFieldDefinition[] = [
  field("migration_or_transition_context", "Migration, rollout, import, export or product change."),
  field("previous_product_or_service", "Previous product, service, plan, tenant or tool.")
];

const SUPPORT_REFERENCE_FIELDS: ExtractableFieldDefinition[] = [
  field("provided_url", "URL, link, domain, callback URL, webhook URL or page address."),
  field("reference_id", "Ticket, invoice, order, transaction, email or request id."),
  field(
    "visual_evidence",
    "Screenshot, photo or video showing the relevant issue, only when visual evidence is materially useful."
  )
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

  for (const fieldDefinition of DEFAULT_SUPPORT_EXTRACTABLE_FIELD_CATALOG) {
    fieldByName.set(fieldDefinition.fieldName, fieldDefinition);
  }

  for (const override of overrides) {
    fieldByName.set(override.fieldName, override);
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
