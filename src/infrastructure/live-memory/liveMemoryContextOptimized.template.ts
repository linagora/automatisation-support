export type LiveMemoryContextOptimized = {
  handover: {
    isHandover: boolean;
    handoverReason: asked_by_user | detected_by_system | null;
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
  status: "solved_by_bot" | "solved_by_human" | "unsolved" | "in_progress" ;
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
//case details created in asking and obtained after the built. Status are changed according to what is obtained in extracted details.
      caseDetailsToAskBecauseOfBasicQualification: Array<{
        key: string | null;
        reason: string | null;
        status: "asking" | "obtained" | "user_declared_unavailable";
      }>;
    };

    retrieveKnowledge: {
      isCompleted: boolean;

      rankedSearch: {
        isSearched: boolean;
        rawRagKnowledge: unknown;
      };

      filter: {
        isFiltered: boolean;
        filteredRagKnowledge: unknown;
        filterExplanation: string | null;
      };

      selection: {
        isClearSelected: boolean;
        clarificationQuestion: string | null;
        selectedfilteredRagKnowledge: unknown;
        selectionExplanation: string | null;
      };

      segmentationKnowledge: {
        isSegmented: boolean;
        userFacingInformation: string | null;
        supportFacingInformation: string | null;
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
      isCompleted: boolean;

      attemptedActionsToAskBecauseOfSolutionFound: Array<{
        action: string | null;
        reason: string | null;
        status: "asking" | "succeeded" | "failed" | "user_declared_unavailable";
      }>;

      actionToTakeForSupport: string | null;
    };

    idleMode: {
      isActivated: boolean;
    };
  };
};