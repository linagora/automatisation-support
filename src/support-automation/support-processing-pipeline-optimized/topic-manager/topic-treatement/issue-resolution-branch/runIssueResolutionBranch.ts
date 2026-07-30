import {runBasicQualification} from "./basic-qualification/runBasicQualification";
import {runRetrieveKnowledge} from "./retrieve-knowledge/runRetrieveKnowledge";
import {searchSimilarIssueTopics} from "./retrieve-knowledge/ranked-search/runRankedSearch--oneShotStep";
import {runDeepQualification} from "./deep-qualification/runDeepQualification";
import {runSolution} from "./solution/runSolution";
import {runIdleMode} from "./idle-mode/runIdleMode";

import type {TopicUpdatePlan} from "../../../propose-topic-updates-optimized/runProposeTopicUpdates";
import type {LiveMemoryTopicOptimized} from "../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";

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
};

type IssueResolutionBranchProcessedOutput = {
  status: "processed";
  fallbackReason: null;
  say: string;
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
    const supportDomain = input.topicUpdatePlan.supportDomain.value;
    const summaryTopic = input.topicUpdatePlan.summaryTopic;
    const currentCaseDetailsExtracted = input.sourceFacts.caseDetailsExtracted;
    const currentAttemptedActionsExtracted = input.sourceFacts.attemptedActionsExtracted;

    if (sourceTopicManager.idleMode.isActivated === true) {
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
        currentStep: "idle",
        resolutionStatus: idleModeOutput.resolutionStatus,
        handover: idleModeOutput.handover,
        idleMode: idleModeOutput.idleMode
      };

      return buildProcessedOutput({
        say: idleModeOutput.say ?? buildIdleAcknowledgement(sourceTopicManager),
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
    sourceTopicManager = markInProgress({
      ...sourceTopicManager,
      currentStep: basicQualificationOutput.say ? "basic_qualification" : sourceTopicManager.currentStep,
      basicQualification: basicQualificationOutput.basicQualification,
      idleMode: {
        isActivated: false
      }
    });

    if (basicQualificationOutput.say) {
      return buildProcessedOutput({
        say: basicQualificationOutput.say,
        sourceTopicManager,
        internalOutputs
      });
    }

    const retrieveKnowledgeOutput = await runRetrieveKnowledge({
      previousRetrieveKnowledge: sourceTopicManager.retrieveKnowledge,
      summaryTopic,
      currentUserMessage: input.currentUserMessage,
      previousConversationTurn: input.previousConversationTurn,
      searchSimilarIssueTopics
    });

    internalOutputs.retrieveKnowledgeOutput = retrieveKnowledgeOutput;
    sourceTopicManager = markInProgress({
      ...sourceTopicManager,
      currentStep: retrieveKnowledgeOutput.say ? "retrieve_knowledge" : sourceTopicManager.currentStep,
      retrieveKnowledge: retrieveKnowledgeOutput.retrieveKnowledge,
      idleMode: {
        isActivated: false
      }
    });

    if (retrieveKnowledgeOutput.say) {
      return buildProcessedOutput({
        say: retrieveKnowledgeOutput.say,
        sourceTopicManager,
        internalOutputs
      });
    }

    const solutionOutput = await runSolution({
      previousTopic: input.currentTopic,
      retrieveKnowledge: sourceTopicManager.retrieveKnowledge,
      summaryTopic,
      sourceTopicManager,
      currentCaseDetailsExtracted,
      currentAttemptedActionsExtracted,
      currentUserMessage: input.currentUserMessage,
      previousConversationTurn: input.previousConversationTurn
    });

    internalOutputs.solutionOutput = solutionOutput;
    sourceTopicManager = markInProgress({
      ...sourceTopicManager,
      currentStep: solutionOutput.say ? "solution" : sourceTopicManager.currentStep,
      solution: solutionOutput.solution,
      idleMode: {
        isActivated: false
      }
    });

    if (solutionOutput.say) {
      return buildProcessedOutput({
        say: solutionOutput.say,
        sourceTopicManager,
        internalOutputs
      });
    }

    const deepQualificationOutput = await runDeepQualification({
      supportDomain,
      previousTopic: input.currentTopic,
      currentCaseDetailsExtracted,
      retrieveKnowledge: sourceTopicManager.retrieveKnowledge,
      currentUserMessage: input.currentUserMessage,
      previousConversationTurn: input.previousConversationTurn
    });

    internalOutputs.deepQualificationOutput = deepQualificationOutput;
    sourceTopicManager = markInProgress({
      ...sourceTopicManager,
      currentStep: deepQualificationOutput.say ? "deep_qualification" : sourceTopicManager.currentStep,
      deepQualification: deepQualificationOutput.deepQualification,
      idleMode: {
        isActivated: false
      }
    });

    if (deepQualificationOutput.say) {
      return buildProcessedOutput({
        say: deepQualificationOutput.say,
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
      currentStep: "idle",
      resolutionStatus: idleModeOutput.resolutionStatus,
      handover: idleModeOutput.handover,
      idleMode: idleModeOutput.idleMode
    };

    return buildProcessedOutput({
      say: idleModeOutput.say ?? buildIdleAcknowledgement(sourceTopicManager),
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

function markInProgress(
  sourceTopicManager: LiveMemoryTopicOptimized["sourceTopicManager"]
): LiveMemoryTopicOptimized["sourceTopicManager"] {
  return {
    ...sourceTopicManager,
    resolutionStatus: {
      value: "in_progress",
      reason: "The issue-resolution route is still collecting information or waiting for a user action."
    },
    handover: {
      isRequested: false,
      reason: null
    }
  };
}

function buildIdleAcknowledgement(
  sourceTopicManager: LiveMemoryTopicOptimized["sourceTopicManager"]
): string {
  if (sourceTopicManager.handover.isRequested) {
    return "Thanks. I’ve kept this update with the topic and will pass it to the support team.";
  }

  if (sourceTopicManager.resolutionStatus.value === "solved_by_bot") {
    return "Great, I’m glad this is working now. I’ll keep the topic marked as resolved.";
  }

  return "Thanks. I’ve kept this update with the topic.";
}

function buildProcessedOutput(params: {
  say: string;
  sourceTopicManager: LiveMemoryTopicOptimized["sourceTopicManager"];
  internalOutputs: IssueResolutionInternalOutputs;
}): IssueResolutionBranchProcessedOutput {
  return {
    status: "processed",
    fallbackReason: null,
    say: params.say,
    sourceTopicManager: params.sourceTopicManager,
    internalOutputs: params.internalOutputs
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

export {runIssueResolutionBranch};

export type {
  IssueResolutionBranchInput,
  IssueResolutionBranchOutput,
  IssueResolutionInternalOutputs,
  IssueResolutionSourceFacts
};
