type SupportFieldCatalogEntry = {
  label: string;
  description: string;
  extractionGuidance?: string;
  askGuidance?: string;
  askable?: boolean;
};

type SupportCatalogField = SupportFieldCatalogEntry & {
  key: string;
  /** Backward-compatible alias for old prompt projections. Prefer extractionGuidance. */
  promptHint?: string;
};

const CASE_DETAIL_FIELD_DEFINITIONS = {
  user_identifier: {
    label: "User identifier",
    description: "Login, username, email, user id, or another identifier for the affected user.",
    extractionGuidance: "Extract only when the user gives a concrete login, username, email, or user id.",
    askGuidance: "Ask which user account is affected, using a login, email, username, or user id if available."
  },
  account_identifier: {
    label: "Account identifier",
    description: "Account, tenant, customer id, or account-level identifier.",
    extractionGuidance: "Extract when the user provides an account id, tenant id, customer id, billing account, or similar identifier.",
    askGuidance: "Ask for the relevant account, tenant, or customer identifier if support needs to locate the account."
  },
  account_status: {
    label: "Account status",
    description: "Known state of the account or access, such as blocked, suspended, active, pending, locked, or disabled.",
    extractionGuidance: "Extract when the user explicitly mentions a known account status or access state.",
    askable: false
  },

  organization_name: {
    label: "Organization name",
    description: "Organization, company, school, or customer entity related to the support topic.",
    extractionGuidance: "Extract when the user names the organization, company, school, customer, or legal entity.",
    askGuidance: "Ask which organization or customer entity is concerned if it is needed to route or locate the topic."
  },
  workspace_name: {
    label: "Workspace name",
    description: "Workspace, team, room, project, tenant, shared space, or collaboration space involved in the topic.",
    extractionGuidance: "Extract when the user names a workspace, team, room, project, tenant, or shared space.",
    askGuidance: "Ask which workspace, team, room, project, or shared space is affected."
  },
  product_or_service: {
    label: "Product or service",
    description: "Product, service, app, module, connector, or integration involved in the topic.",
    extractionGuidance: "Extract when the user names the product, service, module, app, connector, or integration. Prefer explicit user wording over assumptions.",
    askGuidance: "Ask which product, service, module, or app the topic concerns."
  },
  feature_or_page: {
    label: "Feature or page",
    description: "Feature, page, screen, flow, button, section, or capability involved in the topic.",
    extractionGuidance: "Extract when the user mentions a specific page, screen, button, feature, flow, or capability.",
    askGuidance: "Ask which feature, page, screen, or action is concerned."
  },

  platform: {
    label: "Access environment",
    description: "Environment used by the user to access the product, such as web, mobile app, desktop app, Android, iOS, Windows, or macOS.",
    extractionGuidance: "Extract this when the user mentions web, browser, mobile, Android, iPhone, iOS, desktop app, Windows app, macOS app, or a similar access context.",
    askGuidance: "Ask how the user accesses the service, for example whether they use a web browser, the mobile app, or the desktop app."
  },
  operating_system: {
    label: "Operating system",
    description: "Operating system used by the user, with version if provided.",
    extractionGuidance: "Extract only the operating system context, such as Android, iOS, Windows, macOS, or Linux, including the version when provided.",
    askGuidance: "Ask which operating system the user is using, including the version if they know it."
  },
  browser: {
    label: "Browser",
    description: "Browser or webview used when the product is accessed from the web, with version if provided.",
    extractionGuidance: "Extract this when the user mentions Chrome, Firefox, Safari, Edge, a webview, or another browser.",
    askGuidance: "Ask which browser the user uses if they access the service through the web version."
  },
  app_version: {
    label: "App version",
    description: "Version of the app, desktop client, mobile client, plugin, extension, or connector.",
    extractionGuidance: "Extract when the user gives a concrete version number or release identifier for an app, client, plugin, extension, or connector.",
    askGuidance: "Ask which app or client version the user is using, if version can affect diagnosis."
  },
  device: {
    label: "Device",
    description: "Device model, hardware, or device category involved in the topic.",
    extractionGuidance: "Extract when the user mentions a device model or category such as iPhone 13, Samsung Galaxy, laptop, tablet, or workstation.",
    askGuidance: "Ask which device the user is using if device context may affect the issue."
  },
  notification_permission_status: {
    label: "Notification permission status",
    description: "Whether the operating system permission to display notifications is granted, denied, or unknown.",
    extractionGuidance: "Extract when the user says OS-level notification permission is enabled, disabled, granted, denied, or checked.",
    askGuidance: "Ask whether notifications are allowed at the operating-system level for the app."
  },
  notification_channel_status: {
    label: "Notification channel status",
    description: "Whether the relevant application notification channel, in-app notification setting, or notification category is enabled.",
    extractionGuidance: "Extract when the user mentions app notification channels, in-app notification settings, notification categories, or per-channel settings.",
    askGuidance: "Ask whether the relevant in-app notification setting or notification channel is enabled."
  },

  pre_problem_state: {
    label: "Pre-problem state",
    description: "State before the issue started, such as what used to work or what changed from normal behavior.",
    extractionGuidance: "Extract when the user explains what worked before, what changed, or what the previous normal state was.",
    askGuidance: "Ask what was working before the issue started, if that helps understand the change."
  },
  trigger_action: {
    label: "Trigger action",
    description: "Action, event, condition, or workflow step that triggers or reveals the issue.",
    extractionGuidance: "Extract the normal product action or event that reveals the issue, not troubleshooting attempts.",
    askGuidance: "Ask what action the user is trying to perform when the issue appears."
  },
  failure_step: {
    label: "Failure step",
    description: "Precise step in the workflow where the issue appears or blocks the user.",
    extractionGuidance: "Extract when the user identifies where in the flow the problem appears, such as after clicking, during login, at upload, or on a specific step.",
    askGuidance: "Ask at which exact step the problem appears or blocks the workflow."
  },
  reproduction_steps: {
    label: "Reproduction steps",
    description: "Sequence of steps the user follows to reproduce or encounter the issue.",
    extractionGuidance: "Extract when the user describes a sequence of actions that leads to the issue.",
    askGuidance: "Ask the user to describe the exact steps they follow before the issue appears."
  },
  workflow_context: {
    label: "Workflow context",
    description: "Business or product workflow context in which the user is trying to complete an action.",
    extractionGuidance: "Extract when the user explains the larger workflow, goal, or context around the requested action or issue.",
    askGuidance: "Ask in which workflow, feature, or usage context the user is trying to achieve the result."
  },
  error_message: {
    label: "Error message",
    description: "Exact error text, error code, warning, or blocking message displayed to the user.",
    extractionGuidance: "Extract only when the user explicitly provides the exact message, error code, or a very close paraphrase.",
    askGuidance: "Ask the user to share the exact error message or code shown on screen, if there is one."
  },
  observed_result: {
    label: "Observed result",
    description: "What actually happens from the user's perspective.",
    extractionGuidance: "Extract the concrete behavior the user observes, including failures, unexpected results, missing results, or current state.",
    askGuidance: "Ask what happens exactly when the user tries the action."
  },
  expected_result: {
    label: "Expected result",
    description: "What the user expected or wanted to happen instead.",
    extractionGuidance: "Extract when the expected behavior is explicit or clearly implied by the reported negative result.",
    askGuidance: "Ask what the user expected to happen instead."
  },
  available_workaround: {
    label: "Available workaround",
    description: "Workaround explicitly available, unavailable, or already used by the user.",
    extractionGuidance: "Extract only when the user explicitly mentions a workaround, temporary solution, or lack of workaround.",
    askGuidance: "Ask whether the user has found or tried any workaround, if this helps prioritize or route the topic."
  },

  issue_started_at: {
    label: "Issue start time",
    description: "When the issue started or was first noticed.",
    extractionGuidance: "Extract dates, times, relative timing, or first-noticed timing related to the start of the issue.",
    askGuidance: "Ask when the issue started or when the user first noticed it."
  },
  issue_duration: {
    label: "Issue duration",
    description: "How long the issue has lasted.",
    extractionGuidance: "Extract a duration such as minutes, hours, days, weeks, or ongoing since a given period.",
    askGuidance: "Ask how long the issue has been happening."
  },
  deadline_or_expected_date: {
    label: "Deadline or expected date",
    description: "Deadline, renewal date, expected action date, expected delivery date, or time-sensitive date.",
    extractionGuidance: "Extract when the user mentions a deadline, expected resolution date, renewal date, scheduled action, or timing constraint.",
    askGuidance: "Ask whether there is a deadline or expected date if timing matters."
  },
  frequency: {
    label: "Frequency",
    description: "How often the issue occurs or whether it is one-off, intermittent, repeated, or systematic.",
    extractionGuidance: "Extract frequency wording such as always, every time, sometimes, intermittent, once, after each email, or only in some cases.",
    askGuidance: "Ask whether it happens every time, only sometimes, or only in specific cases."
  },
  affected_scope: {
    label: "Affected scope",
    description: "Scope affected by the topic, such as one file, folder, room, channel, workspace, organization, integration, or all items.",
    extractionGuidance: "Extract when the user describes what part of the product, data, workspace, or organization is affected.",
    askGuidance: "Ask whether the issue affects one item, several items, a workspace, or everyone."
  },
  affected_users: {
    label: "Affected users",
    description: "Users, groups, roles, accounts, or number of people affected.",
    extractionGuidance: "Extract when the user says who is affected or how many people are affected.",
    askGuidance: "Ask whether the issue affects only the user or other users as well."
  },
  user_impact: {
    label: "User impact",
    description: "Business, usage, access, productivity, operational, or urgency impact for the user or organization.",
    extractionGuidance: "Extract concrete impact such as blocked work, lost access, payment risk, customer impact, production issue, or urgency.",
    askGuidance: "Ask what impact the issue has on the user's work or organization if prioritization needs more context."
  },

  access_action: {
    label: "Access action",
    description: "Access or authentication action involved, such as login, invite, reset, unlock, permission change, or recovery.",
    extractionGuidance: "Extract when the user mentions login, password reset, invite, unlock, permission, recovery, SSO, MFA, or account access action.",
    askGuidance: "Ask which access action the user is trying to perform, such as logging in, resetting a password, accepting an invite, or changing permissions."
  },
  auth_method: {
    label: "Authentication method",
    description: "Authentication method involved, such as password, SSO, OAuth, magic link, email code, SMS code, or MFA.",
    extractionGuidance: "Extract when the user names the authentication method or login mechanism.",
    askGuidance: "Ask which authentication method the user uses, such as password, SSO, magic link, or MFA."
  },
  server_or_instance: {
    label: "Server or instance",
    description: "Server, instance, tenant, domain, endpoint, region, or deployment target involved.",
    extractionGuidance: "Extract when the user mentions an instance, server, domain, endpoint, tenant, region, or deployment context.",
    askGuidance: "Ask which server, instance, tenant, domain, or endpoint is concerned if support needs that context."
  },
  recovery_channel: {
    label: "Recovery channel",
    description: "Recovery or verification channel, such as email, SMS, backup code, admin approval, or recovery contact.",
    extractionGuidance: "Extract when the user mentions a recovery email, SMS, backup code, admin approval, or other recovery channel.",
    askGuidance: "Ask which recovery channel the user is using or expecting, such as email, SMS, backup code, or admin approval."
  },
  user_role_or_permission: {
    label: "User role or permission",
    description: "Role, permission, entitlement, authorization level, admin status, or access rights involved.",
    extractionGuidance: "Extract when the user mentions admin/member/guest roles, permission level, access right, entitlement, or authorization status.",
    askGuidance: "Ask what role or permission level the affected user has."
  },
  mfa_status: {
    label: "MFA status",
    description: "Multi-factor authentication state, such as enabled, disabled, required, unavailable, reset, or failing.",
    extractionGuidance: "Extract when the user mentions MFA, 2FA, authenticator app, one-time code, backup code, or multi-factor requirement/status.",
    askGuidance: "Ask whether MFA or two-factor authentication is enabled, required, or failing for the account."
  },

  integration_or_connector: {
    label: "Integration or connector",
    description: "Integration, connector, external app, bot, webhook, API, or external service involved.",
    extractionGuidance: "Extract when the user names an integration, connector, bot, webhook, API, or external service.",
    askGuidance: "Ask which integration, connector, bot, API, or external service is involved."
  },
  sync_target: {
    label: "Sync target",
    description: "Object, system, workspace, calendar, file, folder, data type, or destination being synced.",
    extractionGuidance: "Extract when the user mentions what is being synced or where sync is expected to happen.",
    askGuidance: "Ask what object, system, file, folder, workspace, or destination should be syncing."
  },
  sync_status: {
    label: "Sync status",
    description: "Sync state, such as pending, stuck, failed, delayed, duplicated, missing, or complete.",
    extractionGuidance: "Extract when the user describes sync as pending, stuck, failed, delayed, duplicated, incomplete, missing, or complete.",
    askGuidance: "Ask what the current sync status is, for example pending, stuck, failed, delayed, or duplicated."
  },

  plan_or_subscription: {
    label: "Plan or subscription",
    description: "Plan, subscription, license, quota, seat, package, or commercial offer involved.",
    extractionGuidance: "Extract when the user mentions a plan, subscription, license, quota, seat count, package, or offer.",
    askGuidance: "Ask which plan, subscription, license, or package is concerned."
  },
  billing_or_payment_status: {
    label: "Billing or payment status",
    description: "Invoice, payment, renewal, refund, charge, subscription, or failure state.",
    extractionGuidance: "Extract when the user describes the current billing or payment state, such as paid, failed, pending, refunded, charged, renewed, or unpaid.",
    askGuidance: "Ask what the current billing or payment status is, if it is needed to understand the case."
  },
  billing_issue_type: {
    label: "Billing issue type",
    description: "Billing problem type, such as invoice issue, refund, renewal, duplicate charge, failed payment, subscription issue, or payment method issue.",
    extractionGuidance: "Extract the billing problem type when the user mentions invoice, payment, duplicate charge, refund, renewal, subscription, or payment method issues.",
    askGuidance: "Ask what kind of billing issue it is, such as invoice, refund, renewal, duplicate charge, failed payment, or subscription issue."
  },
  duplicate_billing_impact: {
    label: "Duplicate billing impact",
    description: "Whether duplicate billing wording refers to duplicate document, duplicate invoice, duplicate payment, or duplicate charge.",
    extractionGuidance: "Extract when the user clarifies whether the duplicate concerns an invoice/document or an actual payment/charge.",
    askGuidance: "Ask whether the duplicate concerns only an invoice/document or whether the user was charged twice."
  },
  billing_provider: {
    label: "Billing provider",
    description: "Payment processor, marketplace, bank, card provider, billing system, or external payment provider.",
    extractionGuidance: "Extract when the user mentions Stripe, Apple, Google, marketplace billing, bank, card provider, or another payment provider.",
    askGuidance: "Ask which billing provider, marketplace, bank, or payment processor was used if relevant."
  },
  amount: {
    label: "Amount",
    description: "Monetary amount, quota amount, billable quantity, or charged amount.",
    extractionGuidance: "Extract numeric amounts, charged amounts, invoice totals, quota quantities, seat counts, or billable quantities when provided.",
    askGuidance: "Ask for the amount concerned, including the charged or invoiced amount if relevant."
  },
  currency: {
    label: "Currency",
    description: "Currency associated with a monetary amount, such as EUR, USD, GBP, or a currency symbol.",
    extractionGuidance: "Extract currency codes or symbols linked to an amount.",
    askGuidance: "Ask which currency the amount is in if the amount is provided without currency."
  },
  billing_date_or_period: {
    label: "Billing date or period",
    description: "Billing, invoice, subscription, renewal, payment, charge, or refund date or period.",
    extractionGuidance: "Extract dates or periods related to invoices, payments, renewals, subscription periods, charges, or refunds.",
    askGuidance: "Ask for the billing date, invoice date, charge date, or subscription period involved."
  },
  payment_method: {
    label: "Payment method",
    description: "Payment method used, such as card, bank transfer, PayPal, SEPA, invoice, marketplace, or account credit.",
    extractionGuidance: "Extract when the user mentions the payment method used or expected.",
    askGuidance: "Ask which payment method was used, such as card, bank transfer, PayPal, SEPA, or invoice."
  },

  question_intent: {
    label: "Question intent",
    description: "User's question purpose, such as how-to, possibility, setup, pricing, compatibility, policy, availability, or explanation.",
    extractionGuidance: "Extract when the user asks a question and its purpose is clear.",
    askGuidance: "Ask what the user wants to know or achieve if the question is too vague."
  },
  gap_observed: {
    label: "Observed gap",
    description: "Missing capability, unsupported behavior, product gap, limitation, or desired improvement.",
    extractionGuidance: "Extract when the user describes what is missing, unsupported, limited, inconvenient, or desired as an improvement.",
    askGuidance: "Ask what is missing today or what capability the user would like to have."
  },

  assistive_technology: {
    label: "Assistive technology",
    description: "Assistive technology used, such as screen reader, keyboard navigation, voice control, magnifier, switch control, or accessibility tool.",
    extractionGuidance: "Extract when the user names assistive technology or accessibility tooling.",
    askGuidance: "Ask which assistive technology or accessibility tool the user is using."
  },
  accessibility_barrier: {
    label: "Accessibility barrier",
    description: "Accessibility barrier, such as missing label, focus issue, contrast issue, keyboard trap, unreadable content, or inaccessible control.",
    extractionGuidance: "Extract when the user describes the type of accessibility barrier encountered.",
    askGuidance: "Ask what accessibility barrier the user encounters, such as focus, label, contrast, keyboard navigation, or screen reader issue."
  },
  inaccessible_element: {
    label: "Inaccessible element",
    description: "UI element, content, page, control, field, button, or workflow that is inaccessible.",
    extractionGuidance: "Extract when the user identifies the inaccessible element, content, page, or workflow.",
    askGuidance: "Ask which element, page, button, field, or workflow is inaccessible."
  },

  migration_or_transition_context: {
    label: "Migration or transition context",
    description: "Migration, rollout, import, export, product change, tenant move, or transition context.",
    extractionGuidance: "Extract when the user mentions a migration, rollout, import, export, product change, tenant move, or transition.",
    askGuidance: "Ask what migration, rollout, import, export, or transition context is involved."
  },
  previous_product_or_service: {
    label: "Previous product or service",
    description: "Previous product, service, plan, tenant, tool, provider, or environment used before a change or migration.",
    extractionGuidance: "Extract when the user mentions the previous product, service, plan, tenant, provider, or tool.",
    askGuidance: "Ask what product, service, plan, tenant, or tool was used before the migration or change."
  },

  provided_url: {
    label: "Provided URL",
    description: "URL, link, domain, callback URL, webhook URL, page address, or endpoint provided by the user.",
    extractionGuidance: "Extract URLs, domains, callback URLs, webhook URLs, page addresses, or endpoints provided by the user.",
    askGuidance: "Ask for the relevant URL, link, domain, webhook URL, callback URL, or endpoint if support needs it."
  },
  reference_id: {
    label: "Reference ID",
    description: "Ticket, invoice, order, transaction, email, request, payment, log, or external reference identifier.",
    extractionGuidance: "Extract when the user provides a reference id, ticket id, invoice id, order id, transaction id, email id, or similar identifier.",
    askGuidance: "Ask for the relevant reference ID, such as ticket, invoice, order, transaction, or request ID."
  },
  visual_evidence: {
    label: "Visual evidence",
    description: "Screenshot, photo, video, or visual proof showing the relevant issue, only when visual evidence is materially useful.",
    extractionGuidance: "Extract when the user has provided, mentions, or describes visual evidence directly related to the issue.",
    askGuidance: "Ask for a screenshot, photo, or video only if visual evidence would materially help understand the issue."
  }
} as const satisfies Record<string, SupportFieldCatalogEntry>;

const SUPPORT_METADATA_FIELD_DEFINITIONS = {
  visual_evidence_available: {
    label: "Visual evidence available",
    description: "Whether screenshot, photo, video, or visual proof can be provided or is available for the support exchange.",
    extractionGuidance: "Use for availability of visual proof about the support exchange, not for the underlying product fact."
  },
  attachment_available: {
    label: "Attachment available",
    description: "Whether an attachment can be provided or has been provided.",
    extractionGuidance: "Use when the user mentions the availability, presence, absence, or inability to provide an attachment."
  },
  logs_available: {
    label: "Logs available",
    description: "Whether logs can be provided or are available.",
    extractionGuidance: "Use when the user mentions logs, diagnostic logs, error logs, or inability to provide logs."
  },
  user_availability: {
    label: "User availability",
    description: "When or whether the user can test, answer, meet, provide information, or perform a requested check.",
    extractionGuidance: "Use when the user gives availability or timing constraints for support follow-up or testing."
  },
  support_constraint: {
    label: "Support constraint",
    description: "Constraint affecting the support exchange, such as inability to provide proof, test now, access a device, or answer a specific request.",
    extractionGuidance: "Use when the user describes a constraint on the support process itself."
  },
  proof_available: {
    label: "Proof available",
    description: "Whether proof can be provided or is available.",
    extractionGuidance: "Use when the user mentions proof availability separate from the underlying product facts."
  }
} as const satisfies Record<string, SupportFieldCatalogEntry>;


type CaseDetailFieldDefinitionKey = keyof typeof CASE_DETAIL_FIELD_DEFINITIONS;
type SupportMetadataFieldDefinitionKey = keyof typeof SUPPORT_METADATA_FIELD_DEFINITIONS;

function materializeField<TKey extends string>(
  key: TKey,
  entry: SupportFieldCatalogEntry
): SupportCatalogField & { key: TKey } {
  return {
    key,
    ...entry,
    ...(entry.extractionGuidance ? { promptHint: entry.extractionGuidance } : {})
  };
}

function materializeFields<TKey extends CaseDetailFieldDefinitionKey>(
  keys: readonly TKey[]
): Array<SupportCatalogField & { key: TKey }> {
  return keys.map((key) => materializeField(key, CASE_DETAIL_FIELD_DEFINITIONS[key]));
}

function materializeMetadataFields<TKey extends SupportMetadataFieldDefinitionKey>(
  keys: readonly TKey[]
): Array<SupportCatalogField & { key: TKey }> {
  return keys.map((key) => materializeField(key, SUPPORT_METADATA_FIELD_DEFINITIONS[key]));
}

function getCaseDetailFieldsByName<TKey extends CaseDetailFieldDefinitionKey>(
  keys: readonly TKey[]
): Array<SupportCatalogField & { key: TKey }> {
  return materializeFields(keys);
}

function getSupportMetadataFieldsByName<TKey extends SupportMetadataFieldDefinitionKey>(
  keys: readonly TKey[]
): Array<SupportCatalogField & { key: TKey }> {
  return materializeMetadataFields(keys);
}

const CASE_DETAIL_FIELDS = materializeFields(
  Object.keys(CASE_DETAIL_FIELD_DEFINITIONS) as CaseDetailFieldDefinitionKey[]
);

const SUPPORT_METADATA_FIELDS = materializeMetadataFields(
  Object.keys(SUPPORT_METADATA_FIELD_DEFINITIONS) as SupportMetadataFieldDefinitionKey[]
);

export {
  CASE_DETAIL_FIELD_DEFINITIONS,
  CASE_DETAIL_FIELDS,
  SUPPORT_METADATA_FIELD_DEFINITIONS,
  SUPPORT_METADATA_FIELDS,
  getCaseDetailFieldsByName,
  getSupportMetadataFieldsByName
};

export type {
  SupportCatalogField,
  SupportFieldCatalogEntry
};
