export type LiveMemoryContextOptimized = {
  isBotActive: boolean;

  topicsSummary: {
    total: number;

    byStatus: {
      in_progress: number;
      solved_by_bot: number;
      unsolved: number;
    };

    topics: Array<{
      topicId: number;
      title: string | null;
      status: LiveMemoryTopicOptimized["status"];
      supportNeed: string | null;
    }>;
  };

  handover: {
    isHandover: boolean;
    handoverReason: string | null;
  };

  previousConversationTurn: {
    previousUserMessage: string | null;
    previousBotMessage: string | null;
  };

  failedPipelineMessages: Array<{
    concernedUserMessage: string[];
    concernedAttachment: unknown;
    fallbackReason: unknown;
  }>;

  securityAlerts: Array<{
    concernedUserMessage: string[];
    concernedAttachment: unknown[];
    flags: string[];
  }>;

  userState: {
    status: "normal" | "safe" | "suspicious" | "dangerous" | string;
    flags: string[];
  };

  topics: LiveMemoryTopicOptimized[] | null;
};

export type LiveMemoryTopicOptimized = {
  status: "in_progress" | "solved_by_bot" | "unsolved";

  sourceAnalyzeSupportText: {
    caseDetailsExtracted: Array<{
      key: string;
      value: string | number | boolean | null;
      evidence: string | null;
      status: "obtained" | "user_declared_unavailable";
    }>;

    attemptedActionsExtracted: Array<{
      action: string | null;
      outcome: string | null;
      evidence: string | null;
      status: "obtained" | "user_declared_unavailable";
    }>;
  };

  sourceProposeTopicUpdates: {
    topicId: number;
    title: string | null;
    summaryTopic: string | null;

    supportDomain: {
      value: string | null;
      reason: string | null;
    };
  };

  sourceTopicManager: {
    supportNeedResolution: {
      supportNeed: {
        value:
          | "issue_resolution"
          | "feature_request"
          | "knowledge_answer"
          | "support_action"
          | "unclear";
        reason: string | null;
      };
    };

    workflows: {
      issueResolution: {
        basicQualification: {
          isBuilt: boolean;
          isCompleted: boolean;

          caseDetailsToAskBecauseOfBasicQualification: Array<{
            key: string | null;
            reason: string | null;
            status: "asking" | "obtained" | "user_declared_unavailable";
          }>;
        };

        retrieveKnowledge: {
          isCompleted: boolean | "failed";
          activeRetrievalId: string | null;
          retrievalIds: string[];

          rankedSearch: {
            isSearched: boolean;
          };

          filter: {
            isFiltered: boolean;
            keptRawKnowledgeIds: string[];
            filterExplanation: string | null;
          };

          selection: {
            isClearSelected: boolean;
            clarificationQuestion: string | null;
            selectedRawKnowledgeIds: string[];
            selectionExplanation: string | null;
          };

          segmentationKnowledge: {
            isSegmented: boolean;
          };
        };

        solution: {
          isActionForUserBuilt: boolean;
          isActionForSupportBuilt: boolean;
          isCaseDetailsForSolutionBuilt: boolean;
          isCompleted: boolean;

          attemptedActionsToAskBecauseOfSolutionFound: Array<{
            action: string | null;
            reason: string | null;
            status: "asking" | "succeeded" | "failed" | "user_declared_unavailable";
          }>;

          caseDetailsToAskBecauseOfSolutionFound: Array<{
            key: string;
            question: string;
            reason: string | null;
            status: "asking" | "obtained" | "user_declared_unavailable";
          }>;

          actionToTakeForSupport: string | null;
        };

        deepQualification: {
          isBuilt: boolean;
          isCompleted: boolean;

          caseDetailsToAskBecauseOfDeepQualification: Array<{
            key: string | null;
            reason: string | null;
            status: "asking" | "obtained" | "user_declared_unavailable";
          }>;
        };

        idle: {
          isActivated: boolean;
        };
      };

      knowledgeAnswer: {
        idle: {
          isActivated: boolean;
        };
      };

      supportAction: {
        idle: {
          isActivated: boolean;
        };
      };

      featureRequest: {
        idle: {
          isActivated: boolean;
        };
      };
    };
  };
};

export type LiveMemoryIssueResolutionWorkflow =
  LiveMemoryTopicOptimized[
    "sourceTopicManager"
  ]["workflows"]["issueResolution"];

export type LiveMemoryIssueBasicQualification =
  LiveMemoryIssueResolutionWorkflow["basicQualification"];

export type LiveMemoryIssueRetrieveKnowledge =
  LiveMemoryIssueResolutionWorkflow["retrieveKnowledge"];

export type LiveMemoryIssueSolution =
  LiveMemoryIssueResolutionWorkflow["solution"];

export type LiveMemoryIssueDeepQualification =
  LiveMemoryIssueResolutionWorkflow["deepQualification"];

export type LiveMemoryIssueIdle =
  LiveMemoryIssueResolutionWorkflow["idle"];
