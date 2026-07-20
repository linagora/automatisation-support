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
  configuration: {
    extractionGuidance: "Use when the topic concerns settings, setup, configuration, admin configuration, or expected configured behavior."
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
  support_process: {
    extractionGuidance: "Use when the topic concerns the support exchange, support process, previous support response, support delay, support handling, proof, attachments, logs, or support constraints."
  },
  product_capability: {
    extractionGuidance: "Use when the topic concerns a product capability, feature behavior, missing capability, desired improvement, product gap, or product area not covered by a more specific domain."
  },
  other: {
    extractionGuidance: "Use only as a fallback when no more specific support domain is clear."
  }
} as const satisfies Record<string, DeepCatalogEntry>;

const supportNeedCatalog = {
  issue_resolution: {
    extractionGuidance: "Use when the topic needs investigation or resolution of a problem, malfunction, blocked state, error, failed workflow, unexpected behavior, or abnormal result."
  },
  knowledge_answer: {
    extractionGuidance: "Use when the topic primarily needs an answer, explanation, how-to guidance, policy, availability, compatibility, pricing, product behavior explanation, or support knowledge."
  },
  support_action: {
    extractionGuidance: "Use when the topic primarily needs support to do, check, change, process, intervene, reset, unlock, refund, escalate, verify, or handle something."
  },
  feature_request: {
    extractionGuidance: "Use when the topic primarily asks for a missing capability, desired product improvement, new feature, product gap, or enhancement request."
  },
  product_feedback: {
    extractionGuidance: "Use when the topic primarily expresses product opinion, complaint, praise, disappointment, preference, or qualitative feedback without a concrete support action or issue to resolve."
  },
  unclear: {
    extractionGuidance: "Use when the support need cannot be chosen confidently between issue_resolution, knowledge_answer, support_action, feature_request, or product_feedback."
  }
} as const satisfies Record<string, DeepCatalogEntry>;

const supportNeedUnclearReasonCatalog = {
  knowledge_answer_or_issue_resolution: {
    extractionGuidance: "Use when the topic may be either a request for instructions/knowledge or a report of being blocked by a malfunction."
  },
  knowledge_answer_or_support_action: {
    extractionGuidance: "Use when the topic may be either a knowledge question or a request for support to perform an action."
  },
  issue_resolution_or_support_action: {
    extractionGuidance: "Use when the topic may be either a problem to investigate or a request for support to take action."
  },
  feature_request_or_issue_resolution: {
    extractionGuidance: "Use when the topic may be either a desired missing feature or a broken/missing behavior that should already work."
  },
  feature_request_or_knowledge_answer: {
    extractionGuidance: "Use when the topic may be either a feature request or a question about whether/how the product already supports the capability."
  },
  feedback_or_issue_resolution: {
    extractionGuidance: "Use when the topic may be either subjective feedback/complaint or a concrete problem requiring investigation."
  },
  too_ambiguous: {
    extractionGuidance: "Use when the topic is too ambiguous to identify a more specific support need ambiguity."
  }
} as const satisfies Record<string, DeepCatalogEntry>;

const messageActCatalog = {
  issue_report: {
    extractionGuidance: "The user reports a failure, blocked state, unwanted behavior, missing behavior, abnormal result, or support problem."
  },
  question: {
    extractionGuidance: "The user asks for information, explanation, possibility, policy, compatibility, pricing, availability, how-to guidance, or support clarification."
  },
  action_request: {
    extractionGuidance: "The user asks support to do, check, change, fix, explain, refund, unlock, reset, intervene, or escalate."
  },
  info_update: {
    extractionGuidance: "The user provides useful information, status, value, context, answer, identifier, version, date, device, environment, result, or clarification."
  },
  confirmation: {
    extractionGuidance: "The user confirms something, answers yes, or validates a previous interpretation."
  },
  denial: {
    extractionGuidance: "The user denies something, answers no, rejects a previous interpretation, or says a suggested condition is not true."
  },
  feedback: {
    extractionGuidance: "The user gives product or support opinion, preference, complaint, praise, disappointment, or qualitative assessment."
  },
  support_context: {
    extractionGuidance: "The user provides metadata about the support exchange itself, such as screenshot/proof/attachment/log availability, user availability, or support-process constraints."
  }
} as const satisfies Record<string, DeepCatalogEntry>;

const supportOtherKeyCatalog = {
  fact: {
    extractionGuidance: "Useful support fact that does not fit any selected extractable field."
  },
  support_context: {
    extractionGuidance: "Context about the support exchange itself, not the product or account state."
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
  expresses_feedback: {},
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
    askGuidance: "Ask which user account is affected, using a login, email, username, or user id if available."
  },
  account_identifier: {
    extractionGuidance: "Extract when the user provides an account id, tenant id, customer id, billing account, or similar identifier.",
    askGuidance: "Ask for the relevant account, tenant, or customer identifier if support needs to locate the account."
  },
  account_status: {
    extractionGuidance: "Extract when the user explicitly mentions a known account status or access state.",
    askable: false
  },

  organization_name: {
    extractionGuidance: "Extract when the user names the organization, company, school, customer, or legal entity.",
    askGuidance: "Ask which organization or customer entity is concerned if it is needed to route or locate the topic."
  },
  workspace_name: {
    extractionGuidance: "Extract when the user names a workspace, team, room, project, tenant, or shared space.",
    askGuidance: "Ask which workspace, team, room, project, or shared space is affected."
  },
  product_or_service: {
    extractionGuidance: "Extract when the user names the product, service, module, app, connector, or integration. Prefer explicit user wording over assumptions.",
    askGuidance: "Ask which product, service, module, or app the topic concerns."
  },
  feature_or_page: {
    extractionGuidance: "Extract when the user mentions a specific page, screen, button, feature, flow, or capability.",
    askGuidance: "Ask which feature, page, screen, or action is concerned."
  },

  platform: {
    extractionGuidance: "Extract this when the user mentions web, browser, mobile, Android, iPhone, iOS, desktop app, Windows app, macOS app, or a similar access context.",
    askGuidance: "Ask how the user accesses the service, for example whether they use a web browser, the mobile app, or the desktop app."
  },
  operating_system: {
    extractionGuidance: "Extract only the operating system context, such as Android, iOS, Windows, macOS, or Linux, including the version when provided.",
    askGuidance: "Ask which operating system the user is using, including the version if they know it."
  },
  browser: {
    extractionGuidance: "Extract this when the user mentions Chrome, Firefox, Safari, Edge, a webview, or another browser.",
    askGuidance: "Ask which browser the user uses if they access the service through the web version."
  },
  app_version: {
    extractionGuidance: "Extract when the user gives a concrete version number or release identifier for an app, client, plugin, extension, or connector.",
    askGuidance: "Ask which app or client version the user is using, if version can affect diagnosis."
  },
  device: {
    extractionGuidance: "Extract when the user mentions a device model or category such as iPhone 13, Samsung Galaxy, laptop, tablet, or workstation.",
    askGuidance: "Ask which device the user is using if device context may affect the issue."
  },
  notification_permission_status: {
    extractionGuidance: "Extract when the user says OS-level notification permission is enabled, disabled, granted, denied, or checked.",
    askGuidance: "Ask whether notifications are allowed at the operating-system level for the app."
  },
  notification_channel_status: {
    extractionGuidance: "Extract when the user mentions app notification channels, in-app notification settings, notification categories, or per-channel settings.",
    askGuidance: "Ask whether the relevant in-app notification setting or notification channel is enabled."
  },

  pre_problem_state: {
    extractionGuidance: "Extract when the user explains what worked before, what changed, or what the previous normal state was.",
    askGuidance: "Ask what was working before the issue started, if that helps understand the change."
  },
  trigger_action: {
    extractionGuidance: "Extract the normal product action or event that reveals the issue, not troubleshooting attempts.",
    askGuidance: "Ask what action the user is trying to perform when the issue appears."
  },
  failure_step: {
    extractionGuidance: "Extract when the user identifies where in the flow the problem appears, such as after clicking, during login, at upload, or on a specific step.",
    askGuidance: "Ask at which exact step the problem appears or blocks the workflow."
  },
  reproduction_steps: {
    extractionGuidance: "Extract when the user describes a sequence of actions that leads to the issue.",
    askGuidance: "Ask the user to describe the exact steps they follow before the issue appears."
  },
  workflow_context: {
    extractionGuidance: "Extract when the user explains the larger workflow, goal, or context around the requested action or issue.",
    askGuidance: "Ask in which workflow, feature, or usage context the user is trying to achieve the result."
  },
  error_message: {
    extractionGuidance: "Extract only when the user explicitly provides the exact message, error code, or a very close paraphrase.",
    askGuidance: "Ask the user to share the exact error message or code shown on screen, if there is one."
  },
  observed_result: {
    extractionGuidance: "Extract the concrete behavior the user observes, including failures, unexpected results, missing results, or current state.",
    askGuidance: "Ask what happens exactly when the user tries the action."
  },
  expected_result: {
    extractionGuidance: "Extract when the expected behavior is explicit or clearly implied by the reported negative result.",
    askGuidance: "Ask what the user expected to happen instead."
  },
  available_workaround: {
    extractionGuidance: "Extract only when the user explicitly mentions a workaround, temporary solution, or lack of workaround.",
    askGuidance: "Ask whether the user has found or tried any workaround, if this helps prioritize or route the topic."
  },

  issue_started_at: {
    extractionGuidance: "Extract dates, times, relative timing, or first-noticed timing related to the start of the issue.",
    askGuidance: "Ask when the issue started or when the user first noticed it."
  },
  issue_duration: {
    extractionGuidance: "Extract a duration such as minutes, hours, days, weeks, or ongoing since a given period.",
    askGuidance: "Ask how long the issue has been happening."
  },
  deadline_or_expected_date: {
    extractionGuidance: "Extract when the user mentions a deadline, expected resolution date, renewal date, scheduled action, or timing constraint.",
    askGuidance: "Ask whether there is a deadline or expected date if timing matters."
  },
  frequency: {
    extractionGuidance: "Extract frequency wording such as always, every time, sometimes, intermittent, once, after each email, or only in some cases.",
    askGuidance: "Ask whether it happens every time, only sometimes, or only in specific cases."
  },
  affected_scope: {
    extractionGuidance: "Extract when the user describes what part of the product, data, workspace, or organization is affected.",
    askGuidance: "Ask whether the issue affects one item, several items, a workspace, or everyone."
  },
  affected_users: {
    extractionGuidance: "Extract when the user says who is affected or how many people are affected.",
    askGuidance: "Ask whether the issue affects only the user or other users as well."
  },
  user_impact: {
    extractionGuidance: "Extract concrete impact such as blocked work, lost access, payment risk, customer impact, production issue, or urgency.",
    askGuidance: "Ask what impact the issue has on the user's work or organization if prioritization needs more context."
  },

  access_action: {
    extractionGuidance: "Extract when the user mentions login, password reset, invite, unlock, permission, recovery, SSO, MFA, or account access action.",
    askGuidance: "Ask which access action the user is trying to perform, such as logging in, resetting a password, accepting an invite, or changing permissions."
  },
  auth_method: {
    extractionGuidance: "Extract when the user names the authentication method or login mechanism.",
    askGuidance: "Ask which authentication method the user uses, such as password, SSO, magic link, or MFA."
  },
  server_or_instance: {
    extractionGuidance: "Extract when the user mentions an instance, server, domain, endpoint, tenant, region, or deployment context.",
    askGuidance: "Ask which server, instance, tenant, domain, or endpoint is concerned if support needs that context."
  },
  recovery_channel: {
    extractionGuidance: "Extract when the user mentions a recovery email, SMS, backup code, admin approval, or other recovery channel.",
    askGuidance: "Ask which recovery channel the user is using or expecting, such as email, SMS, backup code, or admin approval."
  },
  user_role_or_permission: {
    extractionGuidance: "Extract when the user mentions admin/member/guest roles, permission level, access right, entitlement, or authorization status.",
    askGuidance: "Ask what role or permission level the affected user has."
  },
  mfa_status: {
    extractionGuidance: "Extract when the user mentions MFA, 2FA, authenticator app, one-time code, backup code, or multi-factor requirement/status.",
    askGuidance: "Ask whether MFA or two-factor authentication is enabled, required, or failing for the account."
  },

  integration_or_connector: {
    extractionGuidance: "Extract when the user names an integration, connector, bot, webhook, API, or external service.",
    askGuidance: "Ask which integration, connector, bot, API, or external service is involved."
  },
  sync_target: {
    extractionGuidance: "Extract when the user mentions what is being synced or where sync is expected to happen.",
    askGuidance: "Ask what object, system, file, folder, workspace, or destination should be syncing."
  },
  sync_status: {
    extractionGuidance: "Extract when the user describes sync as pending, stuck, failed, delayed, duplicated, incomplete, missing, or complete.",
    askGuidance: "Ask what the current sync status is, for example pending, stuck, failed, delayed, or duplicated."
  },

  plan_or_subscription: {
    extractionGuidance: "Extract when the user mentions a plan, subscription, license, quota, seat count, package, or offer.",
    askGuidance: "Ask which plan, subscription, license, or package is concerned."
  },
  billing_or_payment_status: {
    extractionGuidance: "Extract when the user describes the current billing or payment state, such as paid, failed, pending, refunded, charged, renewed, or unpaid.",
    askGuidance: "Ask what the current billing or payment status is, if it is needed to understand the case."
  },
  billing_issue_type: {
    extractionGuidance: "Extract the billing problem type when the user mentions invoice, payment, duplicate charge, refund, renewal, subscription, or payment method issues.",
    askGuidance: "Ask what kind of billing issue it is, such as invoice, refund, renewal, duplicate charge, failed payment, or subscription issue."
  },
  duplicate_billing_impact: {
    extractionGuidance: "Extract when the user clarifies whether the duplicate concerns an invoice/document or an actual payment/charge.",
    askGuidance: "Ask whether the duplicate concerns only an invoice/document or whether the user was charged twice."
  },
  billing_provider: {
    extractionGuidance: "Extract when the user mentions Stripe, Apple, Google, marketplace billing, bank, card provider, or another payment provider.",
    askGuidance: "Ask which billing provider, marketplace, bank, or payment processor was used if relevant."
  },
  amount: {
    extractionGuidance: "Extract numeric amounts, charged amounts, invoice totals, quota quantities, seat counts, or billable quantities when provided.",
    askGuidance: "Ask for the amount concerned, including the charged or invoiced amount if relevant."
  },
  currency: {
    extractionGuidance: "Extract currency codes or symbols linked to an amount.",
    askGuidance: "Ask which currency the amount is in if the amount is provided without currency."
  },
  billing_date_or_period: {
    extractionGuidance: "Extract dates or periods related to invoices, payments, renewals, subscription periods, charges, or refunds.",
    askGuidance: "Ask for the billing date, invoice date, charge date, or subscription period involved."
  },
  payment_method: {
    extractionGuidance: "Extract when the user mentions the payment method used or expected.",
    askGuidance: "Ask which payment method was used, such as card, bank transfer, PayPal, SEPA, or invoice."
  },

  question_intent: {
    extractionGuidance: "Extract when the user asks a question and its purpose is clear.",
    askGuidance: "Ask what the user wants to know or achieve if the question is too vague."
  },
  gap_observed: {
    extractionGuidance: "Extract when the user describes what is missing, unsupported, limited, inconvenient, or desired as an improvement.",
    askGuidance: "Ask what is missing today or what capability the user would like to have."
  },

  assistive_technology: {
    extractionGuidance: "Extract when the user names assistive technology or accessibility tooling.",
    askGuidance: "Ask which assistive technology or accessibility tool the user is using."
  },
  accessibility_barrier: {
    extractionGuidance: "Extract when the user describes the type of accessibility barrier encountered.",
    askGuidance: "Ask what accessibility barrier the user encounters, such as focus, label, contrast, keyboard navigation, or screen reader issue."
  },
  inaccessible_element: {
    extractionGuidance: "Extract when the user identifies the inaccessible element, content, page, or workflow.",
    askGuidance: "Ask which element, page, button, field, or workflow is inaccessible."
  },

  migration_or_transition_context: {
    extractionGuidance: "Extract when the user mentions a migration, rollout, import, export, product change, tenant move, or transition.",
    askGuidance: "Ask what migration, rollout, import, export, or transition context is involved."
  },
  previous_product_or_service: {
    extractionGuidance: "Extract when the user mentions the previous product, service, plan, tenant, provider, or tool.",
    askGuidance: "Ask what product, service, plan, tenant, or tool was used before the migration or change."
  },

  provided_url: {
    extractionGuidance: "Extract URLs, domains, callback URLs, webhook URLs, page addresses, or endpoints provided by the user.",
    askGuidance: "Ask for the relevant URL, link, domain, webhook URL, callback URL, or endpoint if support needs it."
  },
  reference_id: {
    extractionGuidance: "Extract when the user provides a reference id, ticket id, invoice id, order id, transaction id, email id, or similar identifier.",
    askGuidance: "Ask for the relevant reference ID, such as ticket, invoice, order, transaction, or request ID."
  },
  visual_evidence: {
    extractionGuidance: "Extract when the user has provided, mentions, or describes visual evidence directly related to the issue.",
    askGuidance: "Ask for a screenshot, photo, or video only if visual evidence would materially help understand the issue."
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
type StrictSupportNeed = keyof typeof supportNeedCatalog;
type StrictSupportNeedUnclearReason = keyof typeof supportNeedUnclearReasonCatalog;
type StrictMessageActValue = keyof typeof messageActCatalog;

type SupportCaseDetailFieldName = StrictSupportCaseDetailFieldName | (string & {});
type SupportMetadataFieldName = StrictSupportMetadataFieldName | (string & {});
type SupportDomain = StrictSupportDomain | (string & {});
type SupportNeed = StrictSupportNeed | (string & {});
type SupportNeedUnclearReason = StrictSupportNeedUnclearReason | (string & {});
type MessageActValue = StrictMessageActValue | (string & {});

export {
  attemptedActionOutcomeCatalog,
  candidateFactSupportCatalog,
  caseDetailFieldCatalog,
  contextDependencyCatalog,
  messageActCatalog,
  primaryUserExpectationCatalog,
  supportDomainCatalog,
  supportMetadataFieldCatalog,
  supportNeedCatalog,
  supportNeedUnclearReasonCatalog,
  testedActionOutcomeCatalog,
  textUncertaintyReasonCatalog,
  supportOtherKeyCatalog
};

export type {
  DeepCatalogEntry,
  MessageActValue,
  StrictMessageActValue,
  StrictSupportDomain,
  StrictSupportNeed,
  StrictSupportNeedUnclearReason,
  StrictSupportCaseDetailFieldName,
  StrictSupportMetadataFieldName,
  SupportCaseDetailFieldName,
  SupportDomain,
  SupportFieldCatalogEntry,
  SupportMetadataFieldName,
  SupportNeed,
  SupportNeedUnclearReason
};
