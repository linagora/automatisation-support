import {runSupportNeedResolution, type RunSupportNeedResolutionOutput} from "./support-need-resolution/runSupportNeedResolution";
import {runIssueResolutionBranch, type IssueResolutionBranchOutput} from "./topic-treatement/issue-resolution-branch/runIssueResolutionBranch";
import {runFeatureRequestBranch, type FeatureRequestBranchOutput} from "./topic-treatement/feature-request-branch/runFeatureRequestBranch";
import {runKnowledgeAnswerBranch, type KnowledgeAnswerBranchOutput} from "./topic-treatement/knowledge-answer-branch/runKnowledgeAnswerBranch";
import {runSupportActionBranch, type SupportActionBranchOutput} from "./topic-treatement/support-action-branch/runSupportActionBranch";
import {runUnclearTopicBranch, type UnclearTopicBranchOutput} from "./topic-treatement/unclear-topic-branch/runUnclearTopicBranch";

import type {
  AnalyzeSupportTextAttemptedAction,
  AnalyzeSupportTextCaseDetail,
  AnalyzeSupportTextOther
} from "../analyze-support-text-optimized/runAnalyzeSupportText";
import type {TopicUpdatePlan} from "../propose-topic-updates-optimized/runProposeTopicUpdates";
import type {LiveMemoryTopicOptimized} from "../../../infrastructure/live-memory/liveMemoryContextOptimized.template";

type CurrentUserMessage = {
  content: string;
  channel?: string;
};

type PreviousConversationTurn = {
  previousUserMessage: string | null;
  previousBotMessage: string | null;
};

type TopicPlannerOutput = {
  topicId: number | null;
  title: string | null;
  say: string;
};

type TopicRoutedSupportFacts = {
  caseDetailsExtracted: AnalyzeSupportTextCaseDetail[];
  attemptedActionsExtracted: AnalyzeSupportTextAttemptedAction[];
  otherExtracted: AnalyzeSupportTextOther[];
};

type RunTopicManagerInput = {
  topicUpdatePlan: TopicUpdatePlan;
  currentTopic: LiveMemoryTopicOptimized | null;
  sourceFacts: TopicRoutedSupportFacts;
  currentUserMessage: CurrentUserMessage;
  previousConversationTurn: PreviousConversationTurn;
};

type RunTopicManagerProcessedOutput = {
  status: "processed";
  fallbackReason: null;
  topicPlannerOutput: TopicPlannerOutput;
  sourceTopicManager: LiveMemoryTopicOptimized["sourceTopicManager"];
  intermediateOutputs: RunTopicManagerIntermediateOutputs;
};

type RunTopicManagerFallbackOutput = {
  status: "fallback";
  fallbackReason: unknown;
  topicPlannerOutput: null;
  sourceTopicManager: null;
  intermediateOutputs: RunTopicManagerIntermediateOutputs;
};

type RunTopicManagerOutput = RunTopicManagerProcessedOutput | RunTopicManagerFallbackOutput;

type RunTopicManagerIntermediateOutputs = {
  supportNeedResolutionOutput: RunSupportNeedResolutionOutput | null;
  issueResolutionBranchOutput: IssueResolutionBranchOutput | null;
  featureRequestBranchOutput: FeatureRequestBranchOutput | null;
  knowledgeAnswerBranchOutput: KnowledgeAnswerBranchOutput | null;
  supportActionBranchOutput: SupportActionBranchOutput | null;
  unclearTopicBranchOutput: UnclearTopicBranchOutput | null;
};

type TopicTreatmentOutput =
  | IssueResolutionBranchOutput
  | FeatureRequestBranchOutput
  | KnowledgeAnswerBranchOutput
  | SupportActionBranchOutput
  | UnclearTopicBranchOutput;

async function runTopicManager(input: RunTopicManagerInput): Promise<RunTopicManagerOutput> {
  const intermediateOutputs = buildEmptyIntermediateOutputs();

  try {
    let sourceTopicManager = buildInitialSourceTopicManager(input.currentTopic);

    const supportNeedResolutionOutput = await runSupportNeedResolution({
      topicUpdatePlan: input.topicUpdatePlan,
      currentUserMessage: input.currentUserMessage,
      previousSupportNeedResolution:
        input.currentTopic?.sourceTopicManager.supportNeedResolution ?? null,
      previousTopicSummary:
        input.currentTopic?.sourceProposeTopicUpdates.summaryTopic ?? null
    });

    intermediateOutputs.supportNeedResolutionOutput = supportNeedResolutionOutput;

    if (supportNeedResolutionOutput.status === "fallback") {
      return buildFallbackOutput({
        fallbackReason: supportNeedResolutionOutput.fallbackReason,
        intermediateOutputs
      });
    }

    sourceTopicManager = {
      ...sourceTopicManager,
      currentStep: "support_need_resolution",
      supportNeedResolution: supportNeedResolutionOutput.supportNeedResolution,
      resolutionStatus: {
        value: "in_progress",
        reason: "The support need has been reassessed from the latest topic update."
      },
      idleMode: {
        isActivated: false
      }
    };

    const treatmentOutput = await runTopicTreatment({
      input,
      sourceTopicManager,
      intermediateOutputs
    });

    if (treatmentOutput.status === "fallback") {
      return buildFallbackOutput({
        fallbackReason: treatmentOutput.fallbackReason,
        intermediateOutputs
      });
    }

    return buildProcessedOutput({
      topicUpdatePlan: input.topicUpdatePlan,
      say: treatmentOutput.say,
      sourceTopicManager: treatmentOutput.sourceTopicManager,
      intermediateOutputs
    });
  } catch (error) {
    return buildFallbackOutput({
      fallbackReason: {
        source: "topic_manager_runner",
        errorMessage: error instanceof Error ? error.message : error
      },
      intermediateOutputs
    });
  }
}

async function runTopicTreatment(params: {
  input: RunTopicManagerInput;
  sourceTopicManager: LiveMemoryTopicOptimized["sourceTopicManager"];
  intermediateOutputs: RunTopicManagerIntermediateOutputs;
}): Promise<TopicTreatmentOutput> {
  const supportNeed = params.sourceTopicManager.supportNeedResolution.supportNeed.value;

  if (supportNeed === "issue_resolution") {
    const output = await runIssueResolutionBranch({
      topicUpdatePlan: params.input.topicUpdatePlan,
      currentTopic: params.input.currentTopic,
      sourceFacts: params.input.sourceFacts,
      currentUserMessage: params.input.currentUserMessage,
      previousConversationTurn: params.input.previousConversationTurn,
      sourceTopicManager: params.sourceTopicManager
    });

    params.intermediateOutputs.issueResolutionBranchOutput = output;
    return output;
  }

  if (supportNeed === "feature_request") {
    const output = await runFeatureRequestBranch({
      topicUpdatePlan: params.input.topicUpdatePlan,
      sourceTopicManager: params.sourceTopicManager
    });

    params.intermediateOutputs.featureRequestBranchOutput = output;
    return output;
  }

  if (supportNeed === "knowledge_answer") {
    const output = await runKnowledgeAnswerBranch({
      topicUpdatePlan: params.input.topicUpdatePlan,
      sourceTopicManager: params.sourceTopicManager
    });

    params.intermediateOutputs.knowledgeAnswerBranchOutput = output;
    return output;
  }

  if (supportNeed === "support_action") {
    const output = await runSupportActionBranch({
      topicUpdatePlan: params.input.topicUpdatePlan,
      sourceTopicManager: params.sourceTopicManager
    });

    params.intermediateOutputs.supportActionBranchOutput = output;
    return output;
  }

  const output = await runUnclearTopicBranch({
    topicUpdatePlan: params.input.topicUpdatePlan,
    sourceTopicManager: params.sourceTopicManager
  });

  params.intermediateOutputs.unclearTopicBranchOutput = output;
  return output;
}

function buildInitialSourceTopicManager(
  currentTopic: LiveMemoryTopicOptimized | null
): LiveMemoryTopicOptimized["sourceTopicManager"] {
  const previousSourceTopicManager = currentTopic?.sourceTopicManager;

  return {
    currentStep: previousSourceTopicManager?.currentStep ?? null,
    supportNeedResolution:
      previousSourceTopicManager?.supportNeedResolution ?? buildEmptySupportNeedResolution(),
    basicQualification: previousSourceTopicManager?.basicQualification ?? buildEmptyBasicQualification(),
    retrieveKnowledge: previousSourceTopicManager?.retrieveKnowledge ?? buildEmptyRetrieveKnowledge(),
    deepQualification: previousSourceTopicManager?.deepQualification ?? buildEmptyDeepQualification(),
    solution: previousSourceTopicManager?.solution ?? buildEmptySolution(),
    idleMode: previousSourceTopicManager?.idleMode ?? {isActivated: false},
    resolutionStatus: previousSourceTopicManager?.resolutionStatus ?? {
      value: "in_progress",
      reason: "The topic manager has started processing this topic."
    },
    handover: previousSourceTopicManager?.handover ?? {
      isRequested: false,
      reason: null
    }
  };
}

function buildEmptySupportNeedResolution(): LiveMemoryTopicOptimized["sourceTopicManager"]["supportNeedResolution"] {
  return {
    supportNeed: {
      value: "unclear",
      reason: null
    }
  };
}

function buildEmptyBasicQualification(): LiveMemoryTopicOptimized["sourceTopicManager"]["basicQualification"] {
  return {
    isBuilt: false,
    isCompleted: false,
    caseDetailsToAskBecauseOfBasicQualification: []
  };
}

function buildEmptyRetrieveKnowledge(): LiveMemoryTopicOptimized["sourceTopicManager"]["retrieveKnowledge"] {
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

function buildEmptyDeepQualification(): LiveMemoryTopicOptimized["sourceTopicManager"]["deepQualification"] {
  return {
    isBuilt: false,
    isCompleted: false,
    caseDetailsToAskBecauseOfDeepQualification: []
  };
}

function buildEmptySolution(): LiveMemoryTopicOptimized["sourceTopicManager"]["solution"] {
  return {
    isActionForUserBuilt: false,
    isActionForSupportBuilt: false,
    isCompleted: false,
    attemptedActionsToAskBecauseOfSolutionFound: [],
    actionToTakeForSupport: null
  };
}

function buildProcessedOutput(params: {
  topicUpdatePlan: TopicUpdatePlan;
  say: string;
  sourceTopicManager: LiveMemoryTopicOptimized["sourceTopicManager"];
  intermediateOutputs: RunTopicManagerIntermediateOutputs;
}): RunTopicManagerProcessedOutput {
  return {
    status: "processed",
    fallbackReason: null,
    topicPlannerOutput: {
      topicId: params.topicUpdatePlan.topicId,
      title: params.topicUpdatePlan.title,
      say: params.say
    },
    sourceTopicManager: params.sourceTopicManager,
    intermediateOutputs: params.intermediateOutputs
  };
}

function buildFallbackOutput(params: {
  fallbackReason: unknown;
  intermediateOutputs: RunTopicManagerIntermediateOutputs;
}): RunTopicManagerFallbackOutput {
  return {
    status: "fallback",
    fallbackReason: params.fallbackReason,
    topicPlannerOutput: null,
    sourceTopicManager: null,
    intermediateOutputs: params.intermediateOutputs
  };
}

function buildEmptyIntermediateOutputs(): RunTopicManagerIntermediateOutputs {
  return {
    supportNeedResolutionOutput: null,
    issueResolutionBranchOutput: null,
    featureRequestBranchOutput: null,
    knowledgeAnswerBranchOutput: null,
    supportActionBranchOutput: null,
    unclearTopicBranchOutput: null
  };
}

export {runTopicManager};

export type {
  CurrentUserMessage,
  PreviousConversationTurn,
  RunTopicManagerInput,
  RunTopicManagerOutput,
  TopicRoutedSupportFacts,
  TopicPlannerOutput
};
