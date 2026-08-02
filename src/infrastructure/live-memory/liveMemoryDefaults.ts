import type {
  LiveMemoryContextOptimized,
  LiveMemoryTopicOptimized
} from "./liveMemoryContextOptimized.template";

function createEmptySourceAnalyzeSupportText(): LiveMemoryTopicOptimized["sourceAnalyzeSupportText"] {
  return {
    caseDetailsExtracted: [],
    attemptedActionsExtracted: []
  };
}

function createEmptySourceTopicManager(): LiveMemoryTopicOptimized["sourceTopicManager"] {
  return {
    currentStep: null,

    resolutionStatus: {
      value: "in_progress",
      reason: null
    },

    handover: {
      isRequested: false,
      reason: null
    },

    supportNeedResolution: {
      supportNeed: {
        value: "unclear",
        reason: null
      }
    },

    basicQualification: {
      isBuilt: false,
      isCompleted: false,
      caseDetailsToAskBecauseOfBasicQualification: []
    },

    retrieveKnowledge: {
      isCompleted: false,

      rankedSearch: {
        isSearched: false,
        rawRagKnowledge: null
      },

      filter: {
        isFiltered: false,
        keptRawKnowledgeIds: [],
        filterExplanation: null
      },

      selection: {
        isClearSelected: false,
        clarificationQuestion: null,
        selectedRawKnowledgeIds: [],
        selectionExplanation: null
      },

      segmentationKnowledge: {
        isSegmented: false,
        segmentedKnowledge: []
      }
    },

    deepQualification: {
      isBuilt: false,
      isCompleted: false,
      caseDetailsToAskBecauseOfDeepQualification: []
    },

    solution: {
      isActionForUserBuilt: false,
      isActionForSupportBuilt: false,
      isCaseDetailsForSolutionBuilt: false,
      isCompleted: false,
      attemptedActionsToAskBecauseOfSolutionFound: [],
      caseDetailsToAskBecauseOfSolutionFound: [],
      actionToTakeForSupport: null
    },

    idleMode: {
      isActivated: false
    }
  };
}

function createEmptyLiveMemoryTopicOptimized(
  topicId: number
): LiveMemoryTopicOptimized {
  return {
    status: "in_progress",

    sourceAnalyzeSupportText: createEmptySourceAnalyzeSupportText(),

    sourceProposeTopicUpdates: {
      topicId,
      title: null,
      summaryTopic: null,
      supportDomain: {
        value: null,
        reason: null
      }
    },

    sourceTopicManager: createEmptySourceTopicManager()
  };
}

function createEmptyLiveMemoryContextOptimized(): LiveMemoryContextOptimized {
  return {
    isBotActive: true,

    topicsSummary: {
      total: 0,
      byStatus: {
        in_progress: 0,
        solved_by_bot: 0,
        unsolved: 0
      },
      topics: []
    },

    handover: {
      isHandover: false,
      handoverReason: null
    },

    previousConversationTurn: {
      previousUserMessage: null,
      previousBotMessage: null
    },

    failedPipelineMessages: [],
    securityAlerts: [],

    userState: {
      status: "normal",
      flags: []
    },

    topics: null
  };
}

export {
  createEmptyLiveMemoryContextOptimized,
  createEmptyLiveMemoryTopicOptimized,
  createEmptySourceAnalyzeSupportText,
  createEmptySourceTopicManager
};
