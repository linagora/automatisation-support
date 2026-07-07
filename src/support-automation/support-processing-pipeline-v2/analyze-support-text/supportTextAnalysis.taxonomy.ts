import {
  BROAD_CATEGORY_HINTS,
  CANDIDATE_FACT_SUPPORT_VALUES,
  CONTEXT_DEPENDENCIES,
  PRIMARY_USER_EXPECTATIONS,
  SUPPORT_NEEDS,
  TESTED_ACTION_OUTCOMES,
  TEXT_UNCERTAINTY_REASONS
} from "../../support-catalog";

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
