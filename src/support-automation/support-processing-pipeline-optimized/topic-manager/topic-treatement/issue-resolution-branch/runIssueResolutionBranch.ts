import {runBasicQualification} from "./basic-qualification/runBasicQualification";
import {runRetrieveKnowledge} from "./retrieve-knowledge/runRetrieveKnowledge";
import {searchSimilarIssueTopics} from "./retrieve-knowledge/ranked-search/runRankedSearch--oneShotStep";
import {runDeepQualification} from "./deep-qualification/runDeepQualification";
import {runSolution} from "./solution/runSolution";
import {runIdleMode} from "./idle-mode/runIdleMode";

import type {TopicUpdatePlan} from "../../../propose-topic-updates-optimized/runProposeTopicUpdates";
import type {KnowledgeMemoryPatch} from "../../../../../infrastructure/live-memory/knowledgeMemoryStore";
import type {KnowledgeMemoryRetrieval} from "../../../../../infrastructure/live-memory/knowledgeMemory.template";
import type {
  LiveMemoryIssueResolutionWorkflow,
  LiveMemoryTopicOptimized
} from "../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";

type CurrentCaseDetailExtracted =
  LiveMemoryTopicOptimized["sourceAnalyzeSupportText"]["caseDetailsExtracted"][number];

type CurrentAttemptedActionExtracted =
  LiveMemoryTopicOptimized["sourceAnalyzeSupportText"]["attemptedActionsExtracted"][number];

type IssueResolutionSourceFacts = {
  caseDetailsExtracted: CurrentCaseDetailExtracted[];
  attemptedActionsExtracted: CurrentAttemptedActionExtracted[];
  otherExtracted: unknown[];
};

type IssueResolutionBranchInput = {
  topicUpdatePlan: TopicUpdatePlan;
  currentTopic: LiveMemoryTopicOptimized | null;
  sourceFacts: IssueResolutionSourceFacts;
  currentUserMessage: {
    content: string;
    channel?: string;
  };
  previousConversationTurn: {
    previousUserMessage: string | null;
    previousBotMessage: string | null;
  };
  sourceTopicManager: LiveMemoryTopicOptimized["sourceTopicManager"];
  activeKnowledgeRetrieval: KnowledgeMemoryRetrieval | null;
};

type IssueResolutionBranchProcessedOutput = {
  status: "processed";
  fallbackReason: null;
  say: string;
  topicStatus: LiveMemoryTopicOptimized["status"];
  topicHandoverRequest: {
    isRequested: boolean;
    reason: string | null;
  };
  knowledgeMemoryPatch: KnowledgeMemoryPatch;
  sourceTopicManager: LiveMemoryTopicOptimized["sourceTopicManager"];
  internalOutputs: IssueResolutionInternalOutputs;
};

type IssueResolutionBranchFallbackOutput = {
  status: "fallback";
  fallbackReason: unknown;
  say: null;
  sourceTopicManager: null;
  internalOutputs: IssueResolutionInternalOutputs;
};

type IssueResolutionBranchOutput =
  | IssueResolutionBranchProcessedOutput
  | IssueResolutionBranchFallbackOutput;

type IssueResolutionInternalOutputs = {
  basicQualificationOutput: Awaited<ReturnType<typeof runBasicQualification>> | null;
  retrieveKnowledgeOutput: Awaited<ReturnType<typeof runRetrieveKnowledge>> | null;
  deepQualificationOutput: Awaited<ReturnType<typeof runDeepQualification>> | null;
  solutionOutput: Awaited<ReturnType<typeof runSolution>> | null;
  idleModeOutput: Awaited<ReturnType<typeof runIdleMode>> | null;
};

async function runIssueResolutionBranch(
  input: IssueResolutionBranchInput
): Promise<IssueResolutionBranchOutput> {
  const internalOutputs = buildEmptyIssueResolutionInternalOutputs();

  try {
    let sourceTopicManager = input.sourceTopicManager;
    let activeKnowledgeRetrieval = input.activeKnowledgeRetrieval;
    const supportDomain = input.topicUpdatePlan.supportDomain.value;
    const summaryTopic = input.topicUpdatePlan.summaryTopic;
    const currentCaseDetailsExtracted = input.sourceFacts.caseDetailsExtracted;
    const currentAttemptedActionsExtracted = input.sourceFacts.attemptedActionsExtracted;

    if (sourceTopicManager.workflows.issueResolution.idle.isActivated === true) {
      const idleModeOutput = await runIdleMode({
        mode: "reevaluate_existing_idle",
        topicId: input.topicUpdatePlan.topicId ?? null,
        currentUserMessage: input.currentUserMessage,
        summaryTopic,
        sourceTopicManager
      });

      internalOutputs.idleModeOutput = idleModeOutput;
      sourceTopicManager = {
        ...sourceTopicManager,
        workflows: {
          ...sourceTopicManager.workflows,
          issueResolution: {
            ...sourceTopicManager.workflows.issueResolution,
            idle: idleModeOutput.idleMode
          }
        }
      };

      return buildProcessedOutput({
        say: idleModeOutput.say ?? buildIdleAcknowledgement({
          topicStatus: idleModeOutput.topicStatus,
          topicHandoverRequest: idleModeOutput.topicHandoverRequest
        }),
        topicStatus: idleModeOutput.topicStatus,
        topicHandoverRequest: idleModeOutput.topicHandoverRequest,
        knowledgeMemoryPatch: buildEmptyKnowledgeMemoryPatch(),
        sourceTopicManager,
        internalOutputs
      });
    }

    const basicQualificationOutput = await runBasicQualification({
      supportDomain,
      summaryTopic,
      previousTopic: input.currentTopic,
      currentCaseDetailsExtracted
    });

    internalOutputs.basicQualificationOutput = basicQualificationOutput;
    sourceTopicManager = updateIssueResolution(sourceTopicManager, {
      basicQualification: basicQualificationOutput.basicQualification,
      idle: {isActivated: false}
    });

    if (basicQualificationOutput.say) {
      return buildProcessedOutput({
        say: basicQualificationOutput.say,
        topicStatus: "in_progress",
        topicHandoverRequest: buildNoTopicHandoverRequest(),
        knowledgeMemoryPatch: buildEmptyKnowledgeMemoryPatch(),
        sourceTopicManager,
        internalOutputs
      });
    }

    const retrieveKnowledgeOutput = await runRetrieveKnowledge({
      previousRetrieveKnowledge: sourceTopicManager.workflows.issueResolution.retrieveKnowledge,
      activeKnowledgeRetrieval,
      topicId: input.topicUpdatePlan.topicId ?? null,
      summaryTopic,
      currentUserMessage: input.currentUserMessage,
      previousConversationTurn: input.previousConversationTurn,
      searchSimilarIssueTopics
    });

    internalOutputs.retrieveKnowledgeOutput = retrieveKnowledgeOutput;
    activeKnowledgeRetrieval = getActiveKnowledgeRetrievalAfterPatch({
      previous: activeKnowledgeRetrieval,
      patch: retrieveKnowledgeOutput.knowledgeMemoryPatch,
      activeRetrievalId: retrieveKnowledgeOutput.retrieveKnowledge.activeRetrievalId
    });
    sourceTopicManager = updateIssueResolution(sourceTopicManager, {
      retrieveKnowledge: retrieveKnowledgeOutput.retrieveKnowledge,
      idle: {isActivated: false}
    });

    if (retrieveKnowledgeOutput.say) {
      return buildProcessedOutput({
        say: retrieveKnowledgeOutput.say,
        topicStatus: "in_progress",
        topicHandoverRequest: buildNoTopicHandoverRequest(),
        knowledgeMemoryPatch: retrieveKnowledgeOutput.knowledgeMemoryPatch,
        sourceTopicManager,
        internalOutputs
      });
    }

    const solutionOutput = await runSolution({
      previousTopic: input.currentTopic,
      segmentedKnowledge: activeKnowledgeRetrieval?.segmentedKnowledge ?? null,
      summaryTopic,
      sourceTopicManager,
      currentCaseDetailsExtracted,
      currentAttemptedActionsExtracted,
      currentUserMessage: input.currentUserMessage,
      previousConversationTurn: input.previousConversationTurn
    });

    internalOutputs.solutionOutput = solutionOutput;
    sourceTopicManager = updateIssueResolution(sourceTopicManager, {
      solution: solutionOutput.solution,
      idle: {isActivated: false}
    });

    if (solutionOutput.say) {
      return buildProcessedOutput({
        say: solutionOutput.say,
        topicStatus: "in_progress",
        topicHandoverRequest: buildNoTopicHandoverRequest(),
        knowledgeMemoryPatch: retrieveKnowledgeOutput.knowledgeMemoryPatch,
        sourceTopicManager,
        internalOutputs
      });
    }

    const deepQualificationOutput = await runDeepQualification({
      supportDomain,
      previousTopic: input.currentTopic,
      currentCaseDetailsExtracted,
      segmentedKnowledge: activeKnowledgeRetrieval?.segmentedKnowledge ?? null,
      currentUserMessage: input.currentUserMessage,
      previousConversationTurn: input.previousConversationTurn
    });

    internalOutputs.deepQualificationOutput = deepQualificationOutput;
    sourceTopicManager = updateIssueResolution(sourceTopicManager, {
      deepQualification: deepQualificationOutput.deepQualification,
      idle: {isActivated: false}
    });

    if (deepQualificationOutput.say) {
      return buildProcessedOutput({
        say: deepQualificationOutput.say,
        topicStatus: "in_progress",
        topicHandoverRequest: buildNoTopicHandoverRequest(),
        knowledgeMemoryPatch: retrieveKnowledgeOutput.knowledgeMemoryPatch,
        sourceTopicManager,
        internalOutputs
      });
    }

    const idleModeOutput = await runIdleMode({
      mode: "finalize_after_solution",
      topicId: input.topicUpdatePlan.topicId ?? null,
      currentUserMessage: input.currentUserMessage,
      summaryTopic,
      sourceTopicManager
    });

    internalOutputs.idleModeOutput = idleModeOutput;
    sourceTopicManager = {
      ...sourceTopicManager,
      workflows: {
        ...sourceTopicManager.workflows,
        issueResolution: {
          ...sourceTopicManager.workflows.issueResolution,
          idle: idleModeOutput.idleMode
        }
      }
    };

    return buildProcessedOutput({
      say: idleModeOutput.say ?? buildIdleAcknowledgement({
        topicStatus: idleModeOutput.topicStatus,
        topicHandoverRequest: idleModeOutput.topicHandoverRequest
      }),
      topicStatus: idleModeOutput.topicStatus,
      topicHandoverRequest: idleModeOutput.topicHandoverRequest,
      knowledgeMemoryPatch: retrieveKnowledgeOutput.knowledgeMemoryPatch,
      sourceTopicManager,
      internalOutputs
    });
  } catch (error) {
    return buildFallbackOutput({
      fallbackReason: {
        source: "issue_resolution_branch_runner",
        errorMessage: error instanceof Error ? error.message : error
      },
      internalOutputs
    });
  }
}

function updateIssueResolution(
  sourceTopicManager: LiveMemoryTopicOptimized["sourceTopicManager"],
  patch: Partial<LiveMemoryIssueResolutionWorkflow>
): LiveMemoryTopicOptimized["sourceTopicManager"] {
  return {
    ...sourceTopicManager,
    workflows: {
      ...sourceTopicManager.workflows,
      issueResolution: {
        ...sourceTopicManager.workflows.issueResolution,
        ...patch
      }
    }
  };
}

function buildIdleAcknowledgement(input: {
  topicStatus: LiveMemoryTopicOptimized["status"];
  topicHandoverRequest: {
    isRequested: boolean;
    reason: string | null;
  };
}): string {
  if (input.topicHandoverRequest.isRequested) {
    return "Thanks. I’ve kept this update with the topic and will pass it to the support team.";
  }

  if (input.topicStatus === "solved_by_bot") {
    return "Great, I’m glad this is working now. I’ll keep the topic marked as resolved.";
  }

  return "Thanks. I’ve kept this update with the topic.";
}

function buildProcessedOutput(params: {
  say: string;
  topicStatus: LiveMemoryTopicOptimized["status"];
  topicHandoverRequest: {
    isRequested: boolean;
    reason: string | null;
  };
  knowledgeMemoryPatch: KnowledgeMemoryPatch;
  sourceTopicManager: LiveMemoryTopicOptimized["sourceTopicManager"];
  internalOutputs: IssueResolutionInternalOutputs;
}): IssueResolutionBranchProcessedOutput {
  return {
    status: "processed",
    fallbackReason: null,
    say: params.say,
    topicStatus: params.topicStatus,
    topicHandoverRequest: params.topicHandoverRequest,
    knowledgeMemoryPatch: params.knowledgeMemoryPatch,
    sourceTopicManager: params.sourceTopicManager,
    internalOutputs: params.internalOutputs
  };
}

function getActiveKnowledgeRetrievalAfterPatch(input: {
  previous: KnowledgeMemoryRetrieval | null;
  patch: KnowledgeMemoryPatch;
  activeRetrievalId: string | null;
}): KnowledgeMemoryRetrieval | null {
  if (!input.activeRetrievalId) {
    return null;
  }

  for (let index = input.patch.upsertRetrievals.length - 1; index >= 0; index -= 1) {
    const retrieval = input.patch.upsertRetrievals[index];

    if (retrieval.retrievalId === input.activeRetrievalId) {
      return retrieval;
    }
  }

  return input.previous?.retrievalId === input.activeRetrievalId
    ? input.previous
    : null;
}

function buildEmptyKnowledgeMemoryPatch(): KnowledgeMemoryPatch {
  return {
    upsertRetrievals: []
  };
}

function buildNoTopicHandoverRequest(): {
  isRequested: boolean;
  reason: string | null;
} {
  return {
    isRequested: false,
    reason: null
  };
}

function buildFallbackOutput(params: {
  fallbackReason: unknown;
  internalOutputs: IssueResolutionInternalOutputs;
}): IssueResolutionBranchFallbackOutput {
  return {
    status: "fallback",
    fallbackReason: params.fallbackReason,
    say: null,
    sourceTopicManager: null,
    internalOutputs: params.internalOutputs
  };
}

function buildEmptyIssueResolutionInternalOutputs(): IssueResolutionInternalOutputs {
  return {
    basicQualificationOutput: null,
    retrieveKnowledgeOutput: null,
    deepQualificationOutput: null,
    solutionOutput: null,
    idleModeOutput: null
  };
}

export {
  getActiveKnowledgeRetrievalAfterPatch,
  runIssueResolutionBranch
};

export type {
  IssueResolutionBranchInput,
  IssueResolutionBranchOutput,
  IssueResolutionInternalOutputs,
  IssueResolutionSourceFacts
};
