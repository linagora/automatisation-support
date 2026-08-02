import {runRankedSearch} from "./ranked-search/runRankedSearch--oneShotStep";
import {runRetrieveKnowledgeFilter} from "./filter/runRetrieveKnowledgeFilter--oneShotStep";
import {runRetrieveKnowledgeSelection} from "./selection/runRetrieveKnowledgeSelection--blockingStep";
import {runSegmentationKnowledge} from "./segmentation-knowledge/runSegmentationKnowledge--oneShotStep";
import {
  createKnowledgeRetrieval,
  type KnowledgeMemoryPatch
} from "../../../../../../infrastructure/live-memory/knowledgeMemoryStore";

import type {
  LiveMemoryIssueRetrieveKnowledge,
  LiveMemoryTopicOptimized
} from "../../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";
import type {KnowledgeMemoryRetrieval} from "../../../../../../infrastructure/live-memory/knowledgeMemory.template";
import type {RawRagKnowledge, SearchSimilarIssueTopics} from "./ranked-search/runRankedSearch--oneShotStep";

type RetrieveKnowledge = LiveMemoryIssueRetrieveKnowledge;

type PreviousConversationTurn = {
  previousUserMessage: string | null;
  previousBotMessage: string | null;
};

export type RunRetrieveKnowledgeInput = {
  previousRetrieveKnowledge: RetrieveKnowledge | null;
  activeKnowledgeRetrieval: KnowledgeMemoryRetrieval | null;
  topicId: number | null;
  summaryTopic: string | null;
  currentUserMessage: {content: string; channel?: string};
  previousConversationTurn: PreviousConversationTurn;
  searchSimilarIssueTopics: SearchSimilarIssueTopics;
};

export type RunRetrieveKnowledgeOutput = {
  say: string | null;
  retrieveKnowledge: RetrieveKnowledge;
  knowledgeMemoryPatch: KnowledgeMemoryPatch;
  ragFailure?: {
    source: "rag";
    reason: "rag_failed";
    errorName: string | null;
    errorMessage: string;
  };
};

async function runRetrieveKnowledge(input: RunRetrieveKnowledgeInput): Promise<RunRetrieveKnowledgeOutput> {
  let retrieveKnowledge = input.previousRetrieveKnowledge ?? buildEmptyRetrieveKnowledge();
  let activeKnowledgeRetrieval = input.activeKnowledgeRetrieval;
  const upsertRetrievals: KnowledgeMemoryRetrieval[] = [];
  const summaryTopic = normalizeSummaryTopic(input.summaryTopic);

  if (retrieveKnowledge.isCompleted) {
    return buildOutput({say: null, retrieveKnowledge, upsertRetrievals});
  }

  if (!summaryTopic) {
    return {
      say: null,
      retrieveKnowledge: markRetrieveKnowledgeCompleted(retrieveKnowledge),
      knowledgeMemoryPatch: {upsertRetrievals}
    };
  }

  if (!retrieveKnowledge.rankedSearch.isSearched) {
    const preparedRetrieval = ensureActiveKnowledgeRetrieval({
      retrieveKnowledge,
      activeKnowledgeRetrieval,
      topicId: input.topicId
    });
    retrieveKnowledge = preparedRetrieval.retrieveKnowledge;
    activeKnowledgeRetrieval = preparedRetrieval.activeKnowledgeRetrieval;
    upsertRetrievals.push(activeKnowledgeRetrieval);

    let rankedSearch: Awaited<ReturnType<typeof runRankedSearch>>;

    try {
      rankedSearch = await runRankedSearch({
        summaryTopic,
        searchSimilarIssueTopics: input.searchSimilarIssueTopics
      });
    } catch (error) {
      const ragFailure = buildRagFailure(error);

      console.error("[support-rag] retrieve_knowledge_failed_soft", {
        errorName: ragFailure.errorName,
        errorMessage: ragFailure.errorMessage
      });

      return {
        say: null,
        retrieveKnowledge: markRetrieveKnowledgeFailed(retrieveKnowledge),
        knowledgeMemoryPatch: {upsertRetrievals},
        ragFailure
      };
    }

    activeKnowledgeRetrieval = {
      ...activeKnowledgeRetrieval,
      rawRagKnowledge: rankedSearch.rawRagKnowledge
    };
    upsertRetrievals.push(activeKnowledgeRetrieval);
    retrieveKnowledge = {
      ...retrieveKnowledge,
      rankedSearch: {
        isSearched: rankedSearch.isSearched
      }
    };
  }

  const rawRagKnowledge = activeKnowledgeRetrieval?.rawRagKnowledge;

  if (!isRawRagKnowledge(rawRagKnowledge) || rawRagKnowledge.candidates.length === 0) {
    return {
      say: null,
      retrieveKnowledge: markRetrieveKnowledgeCompleted(retrieveKnowledge),
      knowledgeMemoryPatch: {upsertRetrievals}
    };
  }

  if (!activeKnowledgeRetrieval) {
    return {
      say: null,
      retrieveKnowledge: markRetrieveKnowledgeCompleted(retrieveKnowledge),
      knowledgeMemoryPatch: {upsertRetrievals}
    };
  }

  if (!retrieveKnowledge.filter.isFiltered) {
    const filter = await runRetrieveKnowledgeFilter({
      summaryTopic,
      rawKnowledgeCandidates: rawRagKnowledge.candidates
    });

    retrieveKnowledge = {
      ...retrieveKnowledge,
      filter
    };
  }

  if (retrieveKnowledge.filter.keptRawKnowledgeIds.length === 0) {
    return {
      say: null,
      retrieveKnowledge: markRetrieveKnowledgeCompleted(retrieveKnowledge),
      knowledgeMemoryPatch: {upsertRetrievals}
    };
  }

  if (!retrieveKnowledge.selection.isClearSelected) {
    const selection = await runRetrieveKnowledgeSelection({
      summaryTopic,
      rawKnowledgeCandidates: rawRagKnowledge.candidates,
      keptRawKnowledgeIds: retrieveKnowledge.filter.keptRawKnowledgeIds,
      previousSelection: retrieveKnowledge.selection,
      currentUserMessage: input.currentUserMessage,
      previousConversationTurn: input.previousConversationTurn
    });

    retrieveKnowledge = {
      ...retrieveKnowledge,
      selection
    };

    if (!selection.isClearSelected) {
      return {
        say: selection.clarificationQuestion,
        retrieveKnowledge,
        knowledgeMemoryPatch: {upsertRetrievals}
      };
    }
  }

  if (retrieveKnowledge.selection.isClearSelected && retrieveKnowledge.selection.selectedRawKnowledgeIds.length === 0) {
    retrieveKnowledge = {
      ...retrieveKnowledge,
      segmentationKnowledge: buildEmptyCompletedSegmentationKnowledge()
    };

    return {
      say: null,
      retrieveKnowledge: markRetrieveKnowledgeCompleted(retrieveKnowledge),
      knowledgeMemoryPatch: {upsertRetrievals}
    };
  }

  if (!retrieveKnowledge.segmentationKnowledge.isSegmented) {
    const segmentationKnowledge = await runSegmentationKnowledge({
      summaryTopic,
      rawKnowledgeCandidates: rawRagKnowledge.candidates,
      selectedRawKnowledgeIds: retrieveKnowledge.selection.selectedRawKnowledgeIds
    });

    activeKnowledgeRetrieval = {
      ...activeKnowledgeRetrieval,
      segmentedKnowledge: segmentationKnowledge.segmentedKnowledge
    };
    upsertRetrievals.push(activeKnowledgeRetrieval);
    retrieveKnowledge = {
      ...retrieveKnowledge,
      segmentationKnowledge: {
        isSegmented: segmentationKnowledge.isSegmented
      }
    };
  }

  return {
    say: null,
    retrieveKnowledge: markRetrieveKnowledgeCompleted(retrieveKnowledge),
    knowledgeMemoryPatch: {upsertRetrievals}
  };
}

function buildEmptyRetrieveKnowledge(): RetrieveKnowledge {
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

function buildEmptyCompletedSegmentationKnowledge(): RetrieveKnowledge["segmentationKnowledge"] {
  return {
    isSegmented: true,
  };
}

function markRetrieveKnowledgeCompleted(retrieveKnowledge: RetrieveKnowledge): RetrieveKnowledge {
  return {
    ...retrieveKnowledge,
    isCompleted: true
  };
}

function markRetrieveKnowledgeFailed(retrieveKnowledge: RetrieveKnowledge): LiveMemoryIssueRetrieveKnowledge {
  return {
    ...retrieveKnowledge,
    isCompleted: "failed",

    rankedSearch: {
      isSearched: true
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

function ensureActiveKnowledgeRetrieval(input: {
  retrieveKnowledge: RetrieveKnowledge;
  activeKnowledgeRetrieval: KnowledgeMemoryRetrieval | null;
  topicId: number | null;
}): {
  retrieveKnowledge: RetrieveKnowledge;
  activeKnowledgeRetrieval: KnowledgeMemoryRetrieval;
} {
  if (input.retrieveKnowledge.activeRetrievalId && input.activeKnowledgeRetrieval) {
    return {
      retrieveKnowledge: input.retrieveKnowledge,
      activeKnowledgeRetrieval: input.activeKnowledgeRetrieval
    };
  }

  if (input.retrieveKnowledge.activeRetrievalId) {
    return {
      retrieveKnowledge: input.retrieveKnowledge,
      activeKnowledgeRetrieval: {
        retrievalId: input.retrieveKnowledge.activeRetrievalId,
        topicId: input.topicId,
        workflow: "issueResolution",
        rawRagKnowledge: null,
        segmentedKnowledge: []
      }
    };
  }

  const activeKnowledgeRetrieval = createKnowledgeRetrieval({
    topicId: input.topicId,
    workflow: "issueResolution"
  });

  return {
    retrieveKnowledge: {
      ...input.retrieveKnowledge,
      activeRetrievalId: activeKnowledgeRetrieval.retrievalId,
      retrievalIds: [
        ...input.retrieveKnowledge.retrievalIds,
        activeKnowledgeRetrieval.retrievalId
      ]
    },
    activeKnowledgeRetrieval
  };
}

function buildOutput(input: {
  say: string | null;
  retrieveKnowledge: RetrieveKnowledge;
  upsertRetrievals: KnowledgeMemoryRetrieval[];
}): RunRetrieveKnowledgeOutput {
  return {
    say: input.say,
    retrieveKnowledge: input.retrieveKnowledge,
    knowledgeMemoryPatch: {
      upsertRetrievals: input.upsertRetrievals
    }
  };
}

function buildRagFailure(error: unknown): {
  source: "rag";
  reason: "rag_failed";
  errorName: string | null;
  errorMessage: string;
} {
  return {
    source: "rag",
    reason: "rag_failed",
    errorName: error instanceof Error ? error.name : null,
    errorMessage: error instanceof Error ? error.message : String(error)
  };
}

function isRawRagKnowledge(value: unknown): value is RawRagKnowledge {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const rawRagKnowledge = value as Partial<RawRagKnowledge>;

  return Array.isArray(rawRagKnowledge.candidates);
}

function normalizeSummaryTopic(summaryTopic: string | null): string | null {
  if (typeof summaryTopic !== "string") return null;
  const trimmedSummaryTopic = summaryTopic.trim();
  return trimmedSummaryTopic === "" ? null : trimmedSummaryTopic;
}

export {
  buildEmptyRetrieveKnowledge,
  runRetrieveKnowledge
};
