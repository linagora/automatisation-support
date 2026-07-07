import type {
  BuildStandardResponseFragmentsInput,
  SurfaceCategory,
  StandardResponseFragment,
  TextSurfaceStandardSubcategory
} from "../typesSupportProcessingPipelineV2.types";

/**
 * Deprecated compatibility alias.
 *
 * Standard response fragments are renderer instructions, not final user-facing
 * text. They are intentionally language-agnostic and always written in English.
 * Final response language must be handled by the renderer from
 * textSurfaceAnalysis.userLanguage.
 */
export type StandardResponseLanguage = string;

export type StandardCategory = Exclude<SurfaceCategory, "support_relevant">;

export type StandardInteractionSubcategory = Extract<
  TextSurfaceStandardSubcategory,
  | "greeting"
  | "thanks_neutral"
  | "thanks_positive"
  | "positive_feedback"
  | "waiting"
  | "apology"
  | "closure"
  | "bot_identity_question"
  | "support_team_question"
  | "support_process_question"
  | "handover_request"
  | "unsupported_standard_question"
  | "negative_feedback"
  | "disappointment"
  | "churn_intent"
  | "time_sensitive"
  | "impolite"
  | "complaint_without_actionable_detail"
  | "communication_feedback"
  | "pricing_feedback"
  | "feature_loss_feedback"
>;

export type OutOfScopeSubcategory = Extract<
  TextSurfaceStandardSubcategory,
  | "generic_out_of_scope"
  | "non_support_linagora"
  | "unrelated_request"
  | "spam_or_commercial"
>;

export type SafetySensitiveSubcategory = Extract<
  TextSurfaceStandardSubcategory,
  | "prompt_injection_attempt"
  | "internal_information_request"
  | "sensitive_data_request"
  | "credential_or_secret_leak"
  | "spam_like_text"
  | "suspicious_link_or_url"
  | "excessive_repetition"
  | "unsafe_or_suspicious_content"
>;

export type LackComprehensionSubcategory = Extract<
  TextSurfaceStandardSubcategory,
  | "unclear_message"
>;

export type StandardSubcategoriesByCategory = {
  standard_interaction: StandardInteractionSubcategory;
  out_of_scope: OutOfScopeSubcategory;
  safety_sensitive: SafetySensitiveSubcategory;
  lack_comprehension: LackComprehensionSubcategory;
};

export type StandardSubcategoryFor<
  TCategory extends StandardCategory
> = StandardSubcategoriesByCategory[TCategory];

export type StandardRendererInstructionCatalog = {
  [TCategory in StandardCategory]: Record<
    StandardSubcategoryFor<TCategory>,
    string
  >;
};

/**
 * Deprecated compatibility alias.
 * Use StandardRendererInstructionCatalog instead.
 */
export type StandardTemplateCatalog = StandardRendererInstructionCatalog;

export type {
  BuildStandardResponseFragmentsInput,
  SurfaceCategory,
  StandardResponseFragment,
  TextSurfaceStandardSubcategory
};
