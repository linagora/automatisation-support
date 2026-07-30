type DeepCatalogEntry = {
  extractionGuidance: string;
};

type SupportFieldCatalogEntry = {
  extractionGuidance: string;
  askGuidance?: string;
  askable?: boolean;
};

const supportDomainCatalog = {
  product_behavior: {
    extractionGuidance: "Use when the topic concerns product behavior, broken behavior, unexpected behavior, missing behavior, failed workflow, or general product malfunction not covered by a more specific domain."
  },
  access_security: {
    extractionGuidance: "Use when the topic concerns login, authentication, permissions, roles, account recovery, MFA, or account access."
  },
  billing: {
    extractionGuidance: "Use when the topic concerns invoices, payments, subscriptions, refunds, renewals, duplicate charges, payment methods, pricing, plan changes, or billing status."
  },
  integration_sync: {
    extractionGuidance: "Use when the topic concerns integrations, connectors, synchronization, external services, webhooks, bots, or data sync."
  },
  performance: {
    extractionGuidance: "Use when the topic concerns slow, delayed, degraded, lagging, or performance-related product behavior."
  },
  availability: {
    extractionGuidance: "Use when the topic concerns outage, downtime, unavailable service, service interruption, or broad availability issue."
  },
  data_migration: {
    extractionGuidance: "Use when the topic concerns migration, import, export, rollout, tenant move, transition, or product change context."
  },
  accessibility: {
    extractionGuidance: "Use when the topic concerns assistive technology, accessibility barriers, inaccessible workflows, keyboard navigation, screen readers, or related usability barriers."
  },
  other: {
    extractionGuidance: "Use only as a fallback when no more specific support domain is clear."
  }
} as const satisfies Record<string, DeepCatalogEntry>;

const supportOtherKeyCatalog = {
  fact: {
    extractionGuidance: "Useful support fact that does not fit any selected extractable field."
  },
  limitation: {
    extractionGuidance: "Missing access, missing logs, inability to test, missing proof, or similar support limitation."
  },
  attachment_reference: {
    extractionGuidance: "Reference to a screenshot, file, proof, image, log, document, or attachment provided or mentioned by the user."
  },
  uncertainty: {
    extractionGuidance: "Ambiguous, incomplete, contradictory, or underspecified information that may matter later."
  },
  other: {
    extractionGuidance: "Useful support information that does not fit another available key."
  }
} as const satisfies Record<string, {extractionGuidance: string}>;


const attemptedActionOutcomeCatalog = {
  success: {},
  failed: {},
  partial: {},
  unknown: {}
} as const;

const primaryUserExpectationCatalog = {
  wants_answer: {},
  wants_solution: {},
  wants_support_action: {},
  wants_human_handover: {},
  wants_acknowledgement: {},
  provides_information: {},
  reports_result: {},
  unclear: {}
} as const;

const contextDependencyCatalog = {
  standalone_complete: {},
  standalone_but_may_match_existing: {},
  needs_context_to_interpret: {},
  needs_context_to_place: {}
} as const;

const textUncertaintyReasonCatalog = {
  ambiguous_reference: {},
  missing_context: {},
  unclear_value: {},
  conflicting_information: {}
} as const;

const candidateFactSupportCatalog = {
  explicit: {},
  strongly_implied: {}
} as const;

const testedActionOutcomeCatalog = {
  worked: {},
  failed: {},
  partially_worked: {},
  unclear: {}
} as const;

const caseDetailFieldCatalog = {
  user_identifier: {
    extractionGuidance: "Extract only when the user gives a concrete login, username, email, or user id.",
    askGuidance: "Which user account is affected? Send the login, email, username, or user ID if available."
  },
  account_identifier: {
    extractionGuidance: "Extract when the user provides an account id, tenant id, customer id, billing account, or similar identifier.",
    askGuidance: "Which account should support check? Send the account ID, tenant ID, customer ID, or billing account if available."
  },
  account_status: {
    extractionGuidance: "Extract when the user explicitly mentions a known account status or access state.",
    askable: false
  },

  organization_name: {
    extractionGuidance: "Extract when the user names the organization, company, school, customer, or legal entity.",
    askGuidance: "Which organization or customer entity is concerned?"
  },
  workspace_name: {
    extractionGuidance: "Extract when the user names a workspace, team, room, project, tenant, or shared space.",
    askGuidance: "Which workspace, team, room, project, tenant, or shared space is affected?"
  },
  product_or_service: {
    extractionGuidance: "Extract when the user names the product, service, module, app, connector, or integration. Prefer explicit user wording over assumptions.",
    askGuidance: "Which product, service, module, or app is concerned?"
  },
  feature_or_page: {
    extractionGuidance: "Extract when the user mentions a specific page, screen, button, feature, flow, or capability.",
    askGuidance: "Where does the issue happen? Name the feature, page, screen, button, or action you are using."
  },

  platform: {
    extractionGuidance: "Extract this when the user mentions web, browser, mobile, mobile app, phone, smartphone, téléphone, Android, iPhone, iOS, desktop app, Windows app, macOS app, or a similar access context. For a generic phone/téléphone mention, prefer platform = mobile.",
    askGuidance: "How do you access the service: web browser, mobile app, or desktop app?"
  },
  operating_system: {
    extractionGuidance: "Extract only the operating system context, such as Android, iOS, Windows, macOS, or Linux, including the version when provided.",
    askGuidance: "Which operating system are you using? Include the version if you know it."
  },
  browser: {
    extractionGuidance: "Extract this when the user mentions Chrome, Firefox, Safari, Edge, a webview, or another browser.",
    askGuidance: "Which browser are you using for the web version?"
  },
  app_version: {
    extractionGuidance: "Extract when the user gives a concrete version number or release identifier for an app, client, plugin, extension, or connector.",
    askGuidance: "Which app, client, plugin, or connector version are you using?"
  },
  device: {
    extractionGuidance: "Extract when the user mentions a device model or hardware category such as iPhone 13, Samsung Galaxy, phone, smartphone, téléphone, laptop, tablet, or workstation.",
    askGuidance: "Which device are you using? Include the model if available."
  },
  notification_permission_status: {
    extractionGuidance: "Extract when the user says OS-level notification permission is enabled, disabled, granted, denied, or checked.",
    askGuidance: "Are notifications allowed for this app in your device or operating system settings?"
  },
  notification_channel_status: {
    extractionGuidance: "Extract when the user mentions app notification channels, in-app notification settings, notification categories, or per-channel settings.",
    askGuidance: "Is the relevant notification setting or channel enabled inside the app?"
  },

  pre_problem_state: {
    extractionGuidance: "Extract when the user explains what worked before, what changed, or what the previous normal state was.",
    askGuidance: "What was working before the issue started?"
  },
  trigger_action: {
    extractionGuidance: "Extract the normal product action or event that reveals the issue, not a troubleshooting attempt. Examples: clicking a notification, opening a channel, sending a message, saving a file, starting login.",
    askGuidance: "What normal action or event makes the issue appear?"
  },
  failure_step: {
    extractionGuidance: "Extract the moment, screen, or step in the user flow where the mismatch or failure becomes visible, such as after clicking, during login, after redirect, when the channel opens, or at upload. Do not use failure_step for the incorrect result itself.",
    askGuidance: "At which step, screen, or moment does the issue become visible or block you?"
  },
  error_message: {
    extractionGuidance: "Extract only when the user explicitly provides the exact message, error code, or a very close paraphrase.",
    askGuidance: "What exact error message or code is shown on screen?"
  },
  observed_result: {
    extractionGuidance: "Extract the concrete incorrect result, missing state, failure, unexpected behavior, or current state observed by the user. Do not use observed_result for the flow step itself.",
    askGuidance: "What happens exactly when you try the action?"
  },
  expected_result: {
    extractionGuidance: "Extract when the expected behavior is explicit or clearly implied by the reported negative result.",
    askGuidance: "What did you expect to happen instead?"
  },
  issue_started_at: {
    extractionGuidance: "Extract dates, times, relative timing, or first-noticed timing related to the start of the issue.",
    askGuidance: "When did the issue start or when did you first notice it?"
  },
  frequency: {
    extractionGuidance: "Extract frequency wording such as always, every time, sometimes, intermittent, once, after each email, or only in some cases.",
    askGuidance: "Does it happen every time, sometimes, or only in specific cases?"
  },
  affected_scope: {
    extractionGuidance: "Extract when the user describes what part of the product, data, workspace, or organization is affected.",
    askGuidance: "What is affected: one item, several items, one workspace, or everyone?"
  },
  affected_users: {
    extractionGuidance: "Extract when the user says who is affected or how many people are affected.",
    askGuidance: "Does this affect only you or other users too?"
  },
  user_impact: {
    extractionGuidance: "Extract concrete impact such as blocked work, lost access, payment risk, customer impact, production issue, or urgency.",
    askGuidance: "What impact does this issue have on your work or organization?"
  },

  access_action: {
    extractionGuidance: "Extract when the user mentions login, password reset, invite, unlock, permission, recovery, SSO, MFA, or account access action.",
    askGuidance: "Which access action are you trying to perform: login, password reset, invite, unlock, recovery, or permission change?"
  },
  auth_method: {
    extractionGuidance: "Extract when the user names the authentication method or login mechanism.",
    askGuidance: "Which authentication method are you using: password, SSO, magic link, MFA, or another method?"
  },
  server_or_instance: {
    extractionGuidance: "Extract when the user mentions an instance, server, domain, endpoint, tenant, region, or deployment context.",
    askGuidance: "Which server, instance, tenant, domain, region, or endpoint is concerned?"
  },
  recovery_channel: {
    extractionGuidance: "Extract when the user mentions a recovery email, SMS, backup code, admin approval, or other recovery channel.",
    askGuidance: "Which recovery channel are you using or expecting: email, SMS, backup code, or admin approval?"
  },
  user_role_or_permission: {
    extractionGuidance: "Extract when the user mentions admin/member/guest roles, permission level, access right, entitlement, or authorization status.",
    askGuidance: "What role or permission level does the affected user have?"
  },
  mfa_status: {
    extractionGuidance: "Extract when the user mentions MFA, 2FA, authenticator app, one-time code, backup code, or multi-factor requirement/status.",
    askGuidance: "Is MFA or two-factor authentication enabled, required, or failing for the account?"
  },

  integration_or_connector: {
    extractionGuidance: "Extract when the user names an integration, connector, bot, webhook, API, or external service.",
    askGuidance: "Which integration, connector, bot, API, webhook, or external service is involved?"
  },
  sync_target: {
    extractionGuidance: "Extract when the user mentions what is being synced or where sync is expected to happen.",
    askGuidance: "What should be syncing, and where should it sync to?"
  },
  sync_status: {
    extractionGuidance: "Extract when the user describes sync as pending, stuck, failed, delayed, duplicated, incomplete, missing, or complete.",
    askGuidance: "What is the current sync status: pending, stuck, failed, delayed, duplicated, or something else?"
  },

  plan_or_subscription: {
    extractionGuidance: "Extract when the user mentions a plan, subscription, license, quota, seat count, package, or offer.",
    askGuidance: "Which plan, subscription, license, package, or quota is concerned?"
  },
  billing_or_payment_status: {
    extractionGuidance: "Extract when the user describes the current billing or payment state, such as paid, failed, pending, refunded, charged, renewed, or unpaid.",
    askGuidance: "What is the current billing or payment status: paid, failed, pending, refunded, charged, renewed, or unpaid?"
  },
  billing_issue_type: {
    extractionGuidance: "Extract the billing problem type when the user mentions invoice, payment, duplicate charge, refund, renewal, subscription, or payment method issues.",
    askGuidance: "What kind of billing issue is it: invoice, refund, renewal, duplicate charge, failed payment, or subscription issue?"
  },
  duplicate_billing_impact: {
    extractionGuidance: "Extract when the user clarifies whether the duplicate concerns an invoice/document or an actual payment/charge.",
    askGuidance: "Is the duplicate only an invoice or document, or were you charged twice?"
  },
  billing_provider: {
    extractionGuidance: "Extract when the user mentions Stripe, Apple, Google, marketplace billing, bank, card provider, or another payment provider.",
    askGuidance: "Which billing provider, marketplace, bank, card provider, or payment processor was used?"
  },
  amount: {
    extractionGuidance: "Extract numeric amounts, charged amounts, invoice totals, quota quantities, seat counts, or billable quantities when provided.",
    askGuidance: "What amount is concerned? Include the charged or invoiced amount if relevant."
  },
  currency: {
    extractionGuidance: "Extract currency codes or symbols linked to an amount.",
    askGuidance: "Which currency is the amount in?"
  },
  billing_date_or_period: {
    extractionGuidance: "Extract dates or periods related to invoices, payments, renewals, subscription periods, charges, or refunds.",
    askGuidance: "Which billing date, invoice date, charge date, or subscription period is involved?"
  },
  payment_method: {
    extractionGuidance: "Extract when the user mentions the payment method used or expected.",
    askGuidance: "Which payment method was used: card, bank transfer, PayPal, SEPA, invoice, or another method?"
  },

  assistive_technology: {
    extractionGuidance: "Extract when the user names assistive technology or accessibility tooling.",
    askGuidance: "Which assistive technology or accessibility tool are you using?"
  },
  accessibility_barrier: {
    extractionGuidance: "Extract when the user describes the type of accessibility barrier encountered.",
    askGuidance: "What accessibility barrier do you encounter: focus, label, contrast, keyboard navigation, screen reader, or another issue?"
  },
  inaccessible_element: {
    extractionGuidance: "Extract when the user identifies the inaccessible element, content, page, or workflow.",
    askGuidance: "Which element is inaccessible? Name the page, button, field, content, or workflow."
  },

  migration_or_transition_context: {
    extractionGuidance: "Extract when the user mentions a migration, rollout, import, export, product change, tenant move, or transition.",
    askGuidance: "What migration, rollout, import, export, tenant move, or transition is involved?"
  },
  previous_product_or_service: {
    extractionGuidance: "Extract when the user mentions the previous product, service, plan, tenant, provider, or tool.",
    askGuidance: "What product, service, plan, tenant, provider, or tool was used before the migration or change?"
  },

  provided_url: {
    extractionGuidance: "Extract URLs, domains, callback URLs, webhook URLs, page addresses, or endpoints provided by the user.",
    askGuidance: "What relevant URL, link, domain, webhook URL, callback URL, or endpoint should support check?"
  },
  reference_id: {
    extractionGuidance: "Extract when the user provides a reference id, ticket id, invoice id, order id, transaction id, email id, or similar identifier.",
    askGuidance: "What reference ID is relevant? Send the ticket, invoice, order, transaction, email, or request ID."
  },
  visual_evidence: {
    extractionGuidance: "Extract when the user has provided, mentions, or describes visual evidence directly related to the issue.",
    askGuidance: "Can you send a screenshot, photo, or video that shows the issue?"
  }
} as const satisfies Record<string, SupportFieldCatalogEntry>;

const supportMetadataFieldCatalog = {
  visual_evidence_available: {
    extractionGuidance: "Use for availability of visual proof about the support exchange, not for the underlying product fact."
  },
  attachment_available: {
    extractionGuidance: "Use when the user mentions the availability, presence, absence, or inability to provide an attachment."
  },
  logs_available: {
    extractionGuidance: "Use when the user mentions logs, diagnostic logs, error logs, or inability to provide logs."
  },
  user_availability: {
    extractionGuidance: "Use when the user gives availability or timing constraints for support follow-up or testing."
  },
  support_constraint: {
    extractionGuidance: "Use when the user describes a constraint on the support process itself."
  },
  proof_available: {
    extractionGuidance: "Use when the user mentions proof availability separate from the underlying product facts."
  }
} as const satisfies Record<string, SupportFieldCatalogEntry>;


type StrictSupportCaseDetailFieldName = keyof typeof caseDetailFieldCatalog;
type StrictSupportMetadataFieldName = keyof typeof supportMetadataFieldCatalog;
type StrictSupportDomain = keyof typeof supportDomainCatalog;

type SupportCaseDetailFieldName = StrictSupportCaseDetailFieldName | (string & {});
type SupportMetadataFieldName = StrictSupportMetadataFieldName | (string & {});
type SupportDomain = StrictSupportDomain | (string & {});

export {
  attemptedActionOutcomeCatalog,
  candidateFactSupportCatalog,
  caseDetailFieldCatalog,
  contextDependencyCatalog,
  primaryUserExpectationCatalog,
  supportDomainCatalog,
  supportMetadataFieldCatalog,
  testedActionOutcomeCatalog,
  textUncertaintyReasonCatalog,
  supportOtherKeyCatalog
};

export type {
  DeepCatalogEntry,
  StrictSupportDomain,
  StrictSupportCaseDetailFieldName,
  StrictSupportMetadataFieldName,
  SupportCaseDetailFieldName,
  SupportDomain,
  SupportFieldCatalogEntry,
  SupportMetadataFieldName
};
