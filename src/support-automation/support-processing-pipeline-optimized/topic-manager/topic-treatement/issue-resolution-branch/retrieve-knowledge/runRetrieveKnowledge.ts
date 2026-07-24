import {runRankedSearch} from "./ranked-search/runRankedSearch--oneShotStep";
import {runRetrieveKnowledgeFilter} from "./filter/runRetrieveKnowledgeFilter--oneShotStep";
import {runRetrieveKnowledgeSelection} from "./selection/runRetrieveKnowledgeSelection--blockingStep";
import {runSegmentationKnowledge} from "./segmentation-knowledge/runSegmentationKnowledge--oneShotStep";

import type {LiveMemoryTopicOptimized} from "../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";
import type {SearchSimilarIssueTopics} from "./ranked-search/runRankedSearch--oneShotStep";

type RetrieveKnowledge = LiveMemoryTopicOptimized["sourceTopicManager"]["retrieveKnowledge"];

type PreviousConversationTurn = {
  previousUserMessage: string | null;
  previousBotMessage: string | null;
};

export type RunRetrieveKnowledgeInput = {
  previousRetrieveKnowledge: RetrieveKnowledge | null;
  summaryTopic: string | null;
  currentUserMessage: {content: string; channel?: string};
  previousConversationTurn: PreviousConversationTurn;
  searchSimilarIssueTopics: SearchSimilarIssueTopics;
};

export type RunRetrieveKnowledgeOutput = {
  say: string | null;
  retrieveKnowledge: RetrieveKnowledge;
};

async function runRetrieveKnowledge(input: RunRetrieveKnowledgeInput): Promise<RunRetrieveKnowledgeOutput> {
  let retrieveKnowledge = input.previousRetrieveKnowledge ?? buildEmptyRetrieveKnowledge();
  const summaryTopic = normalizeSummaryTopic(input.summaryTopic);

  if (retrieveKnowledge.isCompleted) {
    return {say: null, retrieveKnowledge};
  }

  if (!summaryTopic) {
    return {
      say: null,
      retrieveKnowledge: markRetrieveKnowledgeCompleted(retrieveKnowledge)
    };
  }

  if (!retrieveKnowledge.rankedSearch.isSearched) {
    const rankedSearch = await runRankedSearch({
      summaryTopic,
      searchSimilarIssueTopics: input.searchSimilarIssueTopics
    });

    retrieveKnowledge = {
      ...retrieveKnowledge,
      rankedSearch
    };
  }

  if (!hasUsableKnowledge(retrieveKnowledge.rankedSearch.rawRagKnowledge)) {
    return {
      say: null,
      retrieveKnowledge: markRetrieveKnowledgeCompleted(retrieveKnowledge)
    };
  }

  if (!retrieveKnowledge.filter.isFiltered) {
    const filter = await runRetrieveKnowledgeFilter({
      summaryTopic,
      rawRagKnowledge: retrieveKnowledge.rankedSearch.rawRagKnowledge
    });

    retrieveKnowledge = {
      ...retrieveKnowledge,
      filter
    };
  }

  if (!hasUsableKnowledge(retrieveKnowledge.filter.filteredRagKnowledge)) {
    return {
      say: null,
      retrieveKnowledge: markRetrieveKnowledgeCompleted(retrieveKnowledge)
    };
  }

  if (!retrieveKnowledge.selection.isClearSelected) {
    const selection = await runRetrieveKnowledgeSelection({
      summaryTopic,
      filteredRagKnowledge: retrieveKnowledge.filter.filteredRagKnowledge,
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
        retrieveKnowledge
      };
    }
  }

  if (!retrieveKnowledge.segmentationKnowledge.isSegmented) {
    const segmentationKnowledge = await runSegmentationKnowledge({
      summaryTopic,
      selectedfilteredRagKnowledge: retrieveKnowledge.selection.selectedfilteredRagKnowledge
    });

    retrieveKnowledge = {
      ...retrieveKnowledge,
      segmentationKnowledge
    };
  }

  return {
    say: null,
    retrieveKnowledge: markRetrieveKnowledgeCompleted(retrieveKnowledge)
  };
}

function buildEmptyRetrieveKnowledge(): RetrieveKnowledge {
  return {
    isCompleted: false,

    rankedSearch: {
      isSearched: false,
      rawRagKnowledge: null
    },

    filter: {
      isFiltered: false,
      filteredRagKnowledge: null,
      filterExplanation: null
    },

    selection: {
      isClearSelected: false,
      clarificationQuestion: null,
      selectedfilteredRagKnowledge: null,
      selectionExplanation: null
    },

    segmentationKnowledge: {
      isSegmented: false,
      userFacingInformation: null,
      supportFacingInformation: null
    }
  };
}

function markRetrieveKnowledgeCompleted(retrieveKnowledge: RetrieveKnowledge): RetrieveKnowledge {
  return {
    ...retrieveKnowledge,
    isCompleted: true
  };
}

function hasUsableKnowledge(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function normalizeSummaryTopic(summaryTopic: string | null): string | null {
  if (typeof summaryTopic !== "string") return null;
  const trimmedSummaryTopic = summaryTopic.trim();
  return trimmedSummaryTopic === "" ? null : trimmedSummaryTopic;
}

export {
  buildEmptyRetrieveKnowledge,
  hasUsableKnowledge,
  runRetrieveKnowledge
};
