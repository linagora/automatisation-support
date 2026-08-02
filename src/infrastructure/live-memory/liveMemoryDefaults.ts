import type {
  LiveMemoryContextOptimized,
  LiveMemoryIssueBasicQualification,
  LiveMemoryIssueDeepQualification,
  LiveMemoryIssueIdle,
  LiveMemoryIssueRetrieveKnowledge,
  LiveMemoryIssueSolution,
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
    supportNeedResolution: {
      supportNeed: {
        value: "unclear",
        reason: null
      }
    },

    workflows: {
      issueResolution: {
        basicQualification: createEmptyBasicQualification(),
        retrieveKnowledge: createEmptyRetrieveKnowledge(),
        solution: createEmptySolution(),
        deepQualification: createEmptyDeepQualification(),
        idle: createEmptyIdle()
      },
      knowledgeAnswer: {
        idle: createEmptyIdle()
      },
      supportAction: {
        idle: createEmptyIdle()
      },
      featureRequest: {
        idle: createEmptyIdle()
      }
    }
  };
}

function createEmptyBasicQualification(): LiveMemoryIssueBasicQualification {
  return {
    isBuilt: false,
    isCompleted: false,
    caseDetailsToAskBecauseOfBasicQualification: []
  };
}

function createEmptyRetrieveKnowledge(): LiveMemoryIssueRetrieveKnowledge {
  return {
    isCompleted: false,
    activeRetrievalId: null,
    retrievalIds: [],

    rankedSearch: {
      isSearched: false
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
      isSegmented: false
    }
  };
}

function createEmptySolution(): LiveMemoryIssueSolution {
  return {
    isActionForUserBuilt: false,
    isActionForSupportBuilt: false,
    isCaseDetailsForSolutionBuilt: false,
    isCompleted: false,
    attemptedActionsToAskBecauseOfSolutionFound: [],
    caseDetailsToAskBecauseOfSolutionFound: [],
    actionToTakeForSupport: null
  };
}

function createEmptyDeepQualification(): LiveMemoryIssueDeepQualification {
  return {
    isBuilt: false,
    isCompleted: false,
    caseDetailsToAskBecauseOfDeepQualification: []
  };
}

function createEmptyIdle(): LiveMemoryIssueIdle {
  return {
    isActivated: false
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
