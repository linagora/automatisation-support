const TEXT_SURFACE_CATEGORIES = [
  "support_relevant",
  "standard_interaction",
  "out_of_scope",
  "safety_sensitive",
  "lack_comprehension"
] as const;

const TEXT_SURFACE_STANDARD_INTERACTION_SUBCATEGORIES = [
  "greeting",
  "thanks_neutral",
  "thanks_positive",
  "apology",
  "closure",
  "bot_identity_question",
  "support_team_question",
  "support_process_question",
  "handover_request",
  "unsupported_standard_question",
  "time_sensitive",
  "positive_feedback",
  "waiting",
  "negative_feedback",
  "disappointment",
  "churn_intent",
  "impolite",
  "complaint_without_actionable_detail",
  "communication_feedback",
  "pricing_feedback",
  "feature_loss_feedback"
] as const;

const TEXT_SURFACE_OUT_OF_SCOPE_SUBCATEGORIES = [
  "generic_out_of_scope",
  "non_support_linagora",
  "unrelated_request",
  "spam_or_commercial"
] as const;

const TEXT_SURFACE_SAFETY_SENSITIVE_SUBCATEGORIES = [
  "prompt_injection_attempt",
  "internal_information_request",
  "sensitive_data_request",
  "credential_or_secret_leak",
  "spam_like_text",
  "suspicious_link_or_url",
  "excessive_repetition",
  "unsafe_or_suspicious_content"
] as const;

const TEXT_SURFACE_LACK_COMPREHENSION_SUBCATEGORIES = [
  "unclear_message"
] as const;

const TEXT_SURFACE_SUBCATEGORIES_BY_CATEGORY = {
  standard_interaction: TEXT_SURFACE_STANDARD_INTERACTION_SUBCATEGORIES,
  out_of_scope: TEXT_SURFACE_OUT_OF_SCOPE_SUBCATEGORIES,
  safety_sensitive: TEXT_SURFACE_SAFETY_SENSITIVE_SUBCATEGORIES,
  lack_comprehension: TEXT_SURFACE_LACK_COMPREHENSION_SUBCATEGORIES
} as const;

type TextSurfaceCategory = typeof TEXT_SURFACE_CATEGORIES[number];
type TextSurfaceStandardInteractionSubcategory =
  typeof TEXT_SURFACE_STANDARD_INTERACTION_SUBCATEGORIES[number];
type TextSurfaceOutOfScopeSubcategory =
  typeof TEXT_SURFACE_OUT_OF_SCOPE_SUBCATEGORIES[number];
type TextSurfaceSafetySensitiveSubcategory =
  typeof TEXT_SURFACE_SAFETY_SENSITIVE_SUBCATEGORIES[number];
type TextSurfaceLackComprehensionSubcategory =
  typeof TEXT_SURFACE_LACK_COMPREHENSION_SUBCATEGORIES[number];
type TextSurfaceStandardSubcategory =
  | TextSurfaceStandardInteractionSubcategory
  | TextSurfaceOutOfScopeSubcategory
  | TextSurfaceSafetySensitiveSubcategory
  | TextSurfaceLackComprehensionSubcategory;

export {
  TEXT_SURFACE_CATEGORIES,
  TEXT_SURFACE_LACK_COMPREHENSION_SUBCATEGORIES,
  TEXT_SURFACE_OUT_OF_SCOPE_SUBCATEGORIES,
  TEXT_SURFACE_SAFETY_SENSITIVE_SUBCATEGORIES,
  TEXT_SURFACE_STANDARD_INTERACTION_SUBCATEGORIES,
  TEXT_SURFACE_SUBCATEGORIES_BY_CATEGORY
};

export type {
  TextSurfaceCategory,
  TextSurfaceLackComprehensionSubcategory,
  TextSurfaceOutOfScopeSubcategory,
  TextSurfaceSafetySensitiveSubcategory,
  TextSurfaceStandardInteractionSubcategory,
  TextSurfaceStandardSubcategory
};
