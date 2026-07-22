type LiveMemoryContextOptimized = {
  topics: LiveMemoryTopicOptimized[];

  previousConversationTurn: {
    previousUserMessage: string | null;
    previousBotMessage: string | null;
  };

  userState: {
    status: "normal" | "safe" | "suspicious" | "dangerous" | string;
    flags: string[];
  };

  securityAlerts: Array<{
    concernedUserMessage: string[];
    concernedAttachment: unknown[];
    flags: string[];
  }>;

  failedPipelineMessage: Array<{
    concernedUserMessage: string[];
    concernedAttachment: unknown[];
    fallbackReason: unknown;
  }>;
};

type LiveMemoryTopicOptimized = {
  topicId: number;
  title: string | null;

  supportNeed: {
    value: "issue_resolution" | "feature_request" | "knowledge_answer" | "support_action" | "unclear" | null;
    evidence: string | null;
  };

  supportDomain: {
    value: string | null; // à terme : union issue du supportDomainCatalog
    evidence: string | null;
  };

  summary: string | null;

  caseDetails: Array<{
    key: string;
    value: string | number | boolean | null;
    evidence: string | null;
    status: "obtained" | "missing_but_asked" | "user_declared_unavailable";
  }>;

  attemptedActions: Array<{
    action: string | null;
    outcome: string | null;
    evidence: string | null;
    status: "obtained" | "missing_but_asked" | "user_declared_unavailable";
  }>;

  topicBranch: {
    supportNeed: "issue_resolution" | "feature_request" | "knowledge_answer" | "support_action" | "unclear";

    currentStep: "basic_qualification" | "similar_topic" | "deep_qualification" | "solution" | "completed" | "fallback";

    stepsProgression: {
      basicQualification: "not_started" | "complete" | "waiting_user" | "fallback";
      similarTopic: "not_searched" | "searched" | "failed" | "not_analyzed" | "identified" | "unclear" | "absent" | "fallback";
      deepQualification: "not_started" | "complete" | "waiting_user" | "fallback";
      solution: "not_started" | "available" | "not_found" | "not_relevant" | "provided" | "fallback";
      idleMode: "not_started" | "active_solved" | "active_unsolved" | "fallback";
    };
  } | null;

  supportKnowledge?: {
    rawRagKnowledge: unknown;
    filteredRagKnowledge: unknown;
    selectionSummary: unknown;

    caseDetailsToAskBecauseOfRag: Array<{
      key: string | null;
      reason: string | null;
    }>;

    attemptedActionsToAskBecauseOfRag: Array<{
      action: string | null;
      reason: string | null;
    }>;

    supportFacingInformation: string | null;
  };
};

export type {
  LiveMemoryContextOptimized,
  LiveMemoryTopicOptimized
};