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

type PrimaryUserExpectation = typeof PRIMARY_USER_EXPECTATIONS[number];
type SupportNeed = typeof SUPPORT_NEEDS[number];
type BroadCategoryHint = typeof BROAD_CATEGORY_HINTS[number];
type ContextDependency = typeof CONTEXT_DEPENDENCIES[number];
type TextUncertaintyReason = typeof TEXT_UNCERTAINTY_REASONS[number];
type CandidateFactSupport = typeof CANDIDATE_FACT_SUPPORT_VALUES[number];
type TestedActionOutcome = typeof TESTED_ACTION_OUTCOMES[number];

export {
  BROAD_CATEGORY_HINTS,
  CANDIDATE_FACT_SUPPORT_VALUES,
  CONTEXT_DEPENDENCIES,
  PRIMARY_USER_EXPECTATIONS,
  SUPPORT_NEEDS,
  TESTED_ACTION_OUTCOMES,
  TEXT_UNCERTAINTY_REASONS
};

export type {
  BroadCategoryHint,
  CandidateFactSupport,
  ContextDependency,
  PrimaryUserExpectation,
  SupportNeed,
  TestedActionOutcome,
  TextUncertaintyReason
};
