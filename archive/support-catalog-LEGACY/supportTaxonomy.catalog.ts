type PromptTaxonomyEntry = {
  label: string;
  promptDefinition: string;
};

type PromptDescribedValue<TValue extends string> = {
  value: TValue;
  label: string;
  promptDefinition: string;
  /** Backward-compatible alias. Prefer promptDefinition. */
  description: string;
};

const BROAD_CATEGORY_HINTS = [
  "bug",
  "access_security",
  "billing",
  "configuration",
  "integration_sync",
  "performance",
  "availability",
  "data_migration",
  "accessibility",
  "question_faq",
  "feature_request",
  "support_action",
  "product_feedback",
  "support_experience_issue",
  "other"
] as const;

const BROAD_CATEGORY_DEFINITIONS = {
  bug: {
    label: "Bug or product failure",
    promptDefinition: "Use when the topic is about broken, failed, unexpected, blocked, or missing product behavior."
  },
  access_security: {
    label: "Access and security",
    promptDefinition: "Use when the topic concerns login, authentication, permissions, roles, account recovery, MFA, or account access."
  },
  billing: {
    label: "Billing and payment",
    promptDefinition: "Use when the topic concerns invoices, payments, subscriptions, refunds, renewals, duplicate charges, payment methods, or billing status."
  },
  configuration: {
    label: "Configuration",
    promptDefinition: "Use when the topic concerns settings, setup, configuration, admin configuration, or expected configured behavior."
  },
  integration_sync: {
    label: "Integration and sync",
    promptDefinition: "Use when the topic concerns integrations, connectors, synchronization, external services, webhooks, bots, or data sync."
  },
  performance: {
    label: "Performance",
    promptDefinition: "Use when the topic concerns slow, delayed, degraded, lagging, or performance-related product behavior."
  },
  availability: {
    label: "Availability",
    promptDefinition: "Use when the topic concerns outage, downtime, unavailable service, service interruption, or broad availability issue."
  },
  data_migration: {
    label: "Data migration",
    promptDefinition: "Use when the topic concerns migration, import, export, rollout, tenant move, transition, or product change context."
  },
  accessibility: {
    label: "Accessibility",
    promptDefinition: "Use when the topic concerns assistive technology, accessibility barriers, inaccessible workflows, keyboard navigation, screen readers, or related usability barriers."
  },
  question_faq: {
    label: "Question or FAQ",
    promptDefinition: "Use when the topic is primarily a product, support, how-to, policy, setup, compatibility, pricing, or availability question."
  },
  feature_request: {
    label: "Feature request",
    promptDefinition: "Use when the topic concerns a missing capability, desired improvement, feature request, or product gap."
  },
  support_action: {
    label: "Support action",
    promptDefinition: "Use when the user asks support to do, check, change, process, intervene, escalate, unlock, reset, refund, or handle something."
  },
  product_feedback: {
    label: "Product feedback",
    promptDefinition: "Use when the topic is primarily product opinion, complaint, praise, qualitative feedback, or subjective assessment."
  },
  support_experience_issue: {
    label: "Support experience issue",
    promptDefinition: "Use when the topic concerns the support exchange, support process, previous support response, support delay, or support handling."
  },
  other: {
    label: "Other support topic",
    promptDefinition: "Use only as a fallback when no more specific broad support category is clear."
  }
} as const satisfies Record<typeof BROAD_CATEGORY_HINTS[number], PromptTaxonomyEntry>;

const BROAD_INTENT_MODES = [
  "issue",
  "faq",
  "request",
  "unclear"
] as const;

const BROAD_INTENT_DEFINITIONS_BY_MODE = {
  issue: {
    label: "Issue",
    promptDefinition: "Use when the user reports a problem, blockage, failure, unexpected behavior, access issue, billing issue, sync issue, performance issue, configuration issue, data issue, or other support problem."
  },
  faq: {
    label: "FAQ",
    promptDefinition: "Use when the user asks for information, instructions, possibility, policy, compatibility, pricing, availability, how-to guidance, or a product/support explanation."
  },
  request: {
    label: "Request",
    promptDefinition: "Use when the user asks for an action, change, feature, improvement, configuration change, support intervention, account/billing modification, or product request."
  },
  unclear: {
    label: "Unclear",
    promptDefinition: "Use when it is not clear whether the user is asking a question, reporting an issue, or making a request."
  }
} as const satisfies Record<typeof BROAD_INTENT_MODES[number], PromptTaxonomyEntry>;

const MESSAGE_KIND_VALUES = [
  "issue_report",
  "question",
  "action_request",
  "info_update",
  "confirmation",
  "denial",
  "feedback",
  "support_context"
] as const;

const MESSAGE_KIND_DEFINITIONS_BY_VALUE = {
  issue_report: {
    label: "Issue report",
    promptDefinition: "The user reports a failure, blocked state, unwanted behavior, missing behavior, abnormal result, or support problem."
  },
  question: {
    label: "Question",
    promptDefinition: "The user asks for information, explanation, possibility, policy, compatibility, pricing, availability, how-to guidance, or support clarification."
  },
  action_request: {
    label: "Action request",
    promptDefinition: "The user asks support to do, check, change, fix, explain, refund, unlock, reset, intervene, or escalate."
  },
  info_update: {
    label: "Information update",
    promptDefinition: "The user provides useful information, status, value, context, answer, identifier, version, date, device, environment, result, or clarification."
  },
  confirmation: {
    label: "Confirmation",
    promptDefinition: "The user confirms something, answers yes, or validates a previous interpretation."
  },
  denial: {
    label: "Denial",
    promptDefinition: "The user denies something, answers no, rejects a previous interpretation, or says a suggested condition is not true."
  },
  feedback: {
    label: "Feedback",
    promptDefinition: "The user gives product or support opinion, preference, complaint, praise, disappointment, or qualitative assessment."
  },
  support_context: {
    label: "Support context",
    promptDefinition: "The user provides metadata about the support exchange itself, such as screenshot/proof/attachment/log availability, user availability, or support-process constraints."
  }
} as const satisfies Record<typeof MESSAGE_KIND_VALUES[number], PromptTaxonomyEntry>;

function describedValues<
  TValue extends string,
  TDefinition extends Record<TValue, PromptTaxonomyEntry>
>(
  values: readonly TValue[],
  definitions: TDefinition
): Array<PromptDescribedValue<TValue>> {
  return values.map((value) => {
    const definition = definitions[value];
    return {
      value,
      label: definition.label,
      promptDefinition: definition.promptDefinition,
      description: definition.promptDefinition
    };
  });
}

const BROAD_CATEGORY_HINT_DEFINITIONS = describedValues(
  BROAD_CATEGORY_HINTS,
  BROAD_CATEGORY_DEFINITIONS
);

const BROAD_INTENT_DEFINITIONS = describedValues(
  BROAD_INTENT_MODES,
  BROAD_INTENT_DEFINITIONS_BY_MODE
);

const MESSAGE_KIND_DEFINITIONS = describedValues(
  MESSAGE_KIND_VALUES,
  MESSAGE_KIND_DEFINITIONS_BY_VALUE
);

const ATTEMPTED_ACTION_OUTCOME_VALUES = [
  "success",
  "failed",
  "partial",
  "unknown"
] as const;

const PRIMARY_USER_EXPECTATIONS = [
  "wants_answer",
  "wants_solution",
  "wants_support_action",
  "wants_human_handover",
  "wants_acknowledgement",
  "provides_information",
  "reports_result",
  "expresses_feedback",
  "unclear"
] as const;

const SUPPORT_NEEDS = [
  "possible_bug",
  "possible_product_limitation",
  "possible_feature_gap",
  "possible_account_or_access_action",
  "possible_billing_or_payment_action",
  "possible_support_experience_issue"
] as const;

const CONTEXT_DEPENDENCIES = [
  "standalone_complete",
  "standalone_but_may_match_existing",
  "needs_context_to_interpret",
  "needs_context_to_place"
] as const;

const TEXT_UNCERTAINTY_REASONS = [
  "ambiguous_reference",
  "missing_context",
  "unclear_value",
  "conflicting_information"
] as const;

const CANDIDATE_FACT_SUPPORT_VALUES = [
  "explicit",
  "strongly_implied"
] as const;

const TESTED_ACTION_OUTCOMES = [
  "worked",
  "failed",
  "partially_worked",
  "unclear"
] as const;

export {
  ATTEMPTED_ACTION_OUTCOME_VALUES,
  BROAD_CATEGORY_DEFINITIONS,
  BROAD_CATEGORY_HINT_DEFINITIONS,
  BROAD_CATEGORY_HINTS,
  BROAD_INTENT_DEFINITIONS,
  BROAD_INTENT_DEFINITIONS_BY_MODE,
  BROAD_INTENT_MODES,
  CANDIDATE_FACT_SUPPORT_VALUES,
  CONTEXT_DEPENDENCIES,
  MESSAGE_KIND_DEFINITIONS,
  MESSAGE_KIND_DEFINITIONS_BY_VALUE,
  MESSAGE_KIND_VALUES,
  PRIMARY_USER_EXPECTATIONS,
  SUPPORT_NEEDS,
  TESTED_ACTION_OUTCOMES,
  TEXT_UNCERTAINTY_REASONS
};

export type {
  PromptDescribedValue,
  PromptTaxonomyEntry
};
