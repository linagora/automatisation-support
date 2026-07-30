export type LiveMemoryContextOptimized = {
  handover: {
    isHandover: boolean;
    handoverReason: "asked_by_user" | "detected_by_system" | null;
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
    currentStep:
      | "support_need_resolution"
      | "basic_qualification"
      | "retrieve_knowledge"
      | "deep_qualification"
      | "solution"
      | "idle"
      | null;

    resolutionStatus: {
      value: "in_progress" | "solved_by_bot" | "unsolved";
      reason: string | null;
    };

    handover: {
      isRequested: boolean;
      reason: string | null;
    };

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

      rankedSearch: {
        isSearched: boolean;
        rawRagKnowledge: unknown;
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
        segmentedKnowledge: Array<{
          rawKnowledgeId: string;
          userFacingKnowledge: Array<{
            text: string;
            sourceHint: string | null;
            sourceSpan: string | null;
          }>;
          supportFacingKnowledge: Array<{
            text: string;
            sourceHint: string | null;
            sourceSpan: string | null;
          }>;
        }>;
      };
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

    idleMode: {
      isActivated: boolean;
    };
  };
};
