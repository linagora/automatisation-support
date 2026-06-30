type KnowledgeRetrievalPolicyDecision = {
  enabled: boolean;
  reason: string;
};

const COVERED_CATEGORY_REASONS: Record<string, string> = {
  bug: "rag_enabled_for_bug_topics",
  access_security: "rag_enabled_for_access_security_topics"
};

const DISABLED_CATEGORY_REASONS: Record<string, string> = {
  billing: "rag_disabled_for_billing_topics"
};

function getKnowledgeRetrievalPolicyDecision(
  broadCategoryHint: string | null | undefined
): KnowledgeRetrievalPolicyDecision {
  if (!broadCategoryHint) {
    return {
      enabled: false,
      reason: "rag_disabled_missing_broad_category"
    };
  }

  if (COVERED_CATEGORY_REASONS[broadCategoryHint]) {
    return {
      enabled: true,
      reason: COVERED_CATEGORY_REASONS[broadCategoryHint]
    };
  }

  return {
    enabled: false,
    reason:
      DISABLED_CATEGORY_REASONS[broadCategoryHint] ??
      "rag_disabled_for_category"
  };
}

export {
  getKnowledgeRetrievalPolicyDecision
};
