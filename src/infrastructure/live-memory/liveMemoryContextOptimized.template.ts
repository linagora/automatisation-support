type LiveMemoryContextOptimized = {
  topics: LiveMemoryTopicOptimized[];

  previousConversationTurn: {
    previousUserVerbatim: string | null;
    previousBotVerbatim: string | null;
  };

  userState: {
    status: "normal" | string;
    flags: string[];
  };
};

type LiveMemoryTopicOptimized = {
  topicId: number;
  title: string;
  broadCategoryHint: string | null;
  summary: string;

  caseDetails: Array<{
    key: string;
    value: string | number | boolean | null;
    evidence: string | null;
    status?: "obtained" | "missing" | "asked" | "user_declared_unavailable";
  }>;

  attemptedActions: Array<{
    action: string;
    outcome: string | null;
    evidence: string | null;
  }>;

  supportKnowledgeSummary?: {
    summary: string | null;
    customerFacing: string | null;
    supportFacing: string | null;
  };

  unansweredRequestedFieldNames?: string[];

  issueProgressState?: unknown;

  supportNeedResolution?: unknown;
};

export type {
  LiveMemoryContextOptimized,
  LiveMemoryTopicOptimized
};
