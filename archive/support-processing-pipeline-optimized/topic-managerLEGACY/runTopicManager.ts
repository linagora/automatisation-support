import {
  runIssueResolutionBranch,
  type IssueResolutionBranchOutput
} from "./topic-treatement/issue-resolution-branch/runIssueResolutionBranch";

import type {AnalyzeSupportTextUnderstanding} from "../analyze-support-text-optimized/runAnalyzeSupportText";
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

type RunTopicManagerInput = {
  topicUpdatePlan: TopicUpdatePlan;
  currentTopic: LiveMemoryTopicOptimized | null;
  sourceUnderstandings: AnalyzeSupportTextUnderstanding[];
  currentUserMessage: CurrentUserMessage;
  previousConversationTurn: PreviousConversationTurn;
};

type RunTopicManagerProcessedOutput = {
  status: "processed";
  fallbackReason: null;
  topicPlannerOutput: TopicPlannerOutput;
  sourceTopicManager: LiveMemoryTopicOptimized["sourceTopicManager"];
  intermediateOutputs: {
    issueResolutionBranchOutput: IssueResolutionBranchOutput | null;
  };
};

type RunTopicManagerFallbackOutput = {
  status: "fallback";
  fallbackReason: unknown;
  topicPlannerOutput: null;
  sourceTopicManager: null;
  intermediateOutputs: {
    issueResolutionBranchOutput: IssueResolutionBranchOutput | null;
  };
};

type RunTopicManagerOutput = RunTopicManagerProcessedOutput | RunTopicManagerFallbackOutput;

type SupportNeedValue = LiveMemoryTopicOptimized["sourceTopicManager"]["supportNeedResolution"]["supportNeed"]["value"];

async function runTopicManager(input: RunTopicManagerInput): Promise<RunTopicManagerOutput> {
  const intermediateOutputs: RunTopicManagerProcessedOutput["intermediateOutputs"] = {
    issueResolutionBranchOutput: null
  };

  try {
    const sourceTopicManager = buildInitialSourceTopicManager(input);
    const supportNeed = sourceTopicManager.supportNeedResolution.supportNeed.value;

    if (supportNeed === "unclear") {
      return buildProcessedOutput({
        topicUpdatePlan: input.topicUpdatePlan,
        say: buildSupportNeedClarificationMessage(input.topicUpdatePlan.summaryTopic),
        sourceTopicManager: {
          ...sourceTopicManager,
          currentStep: "support_need_resolution",
          resolutionStatus: {
            value: "in_progress",
            reason: "The support need is still unclear."
          },
          handover: {
            isRequested: false,
            reason: null
          },
          idleMode: {
            isActivated: false
          }
        },
        intermediateOutputs
      });
    }

    if (supportNeed === "issue_resolution") {
      const issueResolutionBranchOutput = await runIssueResolutionBranch({
        topicUpdatePlan: input.topicUpdatePlan,
        currentTopic: input.currentTopic,
        sourceUnderstandings: input.sourceUnderstandings,
        currentUserMessage: input.currentUserMessage,
        previousConversationTurn: input.previousConversationTurn,
        sourceTopicManager
      });

      intermediateOutputs.issueResolutionBranchOutput = issueResolutionBranchOutput;

      if (issueResolutionBranchOutput.status === "fallback") {
        return buildFallbackOutput({
          fallbackReason: issueResolutionBranchOutput.fallbackReason,
          intermediateOutputs
        });
      }

      return buildProcessedOutput({
        topicUpdatePlan: input.topicUpdatePlan,
        say: issueResolutionBranchOutput.say,
        sourceTopicManager: issueResolutionBranchOutput.sourceTopicManager,
        intermediateOutputs
      });
    }

    return buildProcessedOutput({
      topicUpdatePlan: input.topicUpdatePlan,
      say: buildNonIssueSupportNeedMessage(supportNeed),
      sourceTopicManager: {
        ...sourceTopicManager,
        currentStep: "idle",
        resolutionStatus: {
          value: "solved_by_human",
          reason: `The topic was classified as ${supportNeed}, but this optimized route is not implemented yet.`
        },
        handover: {
          isRequested: true,
          reason: `The ${supportNeed} route should be handled by support.`
        },
        idleMode: {
          isActivated: true
        }
      },
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

function buildInitialSourceTopicManager(
  input: RunTopicManagerInput
): LiveMemoryTopicOptimized["sourceTopicManager"] {
  const previousSourceTopicManager = input.currentTopic?.sourceTopicManager;
  const supportNeedValue = resolveSupportNeedValue(input);

  return {
    currentStep: null,

    supportNeedResolution: {
      supportNeed: {
        value: supportNeedValue,
        reason: resolveSupportNeedReason(input, supportNeedValue)
      }
    },

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

function resolveSupportNeedValue(input: RunTopicManagerInput): SupportNeedValue {
  const previousSupportNeed = input.currentTopic?.sourceTopicManager.supportNeedResolution.supportNeed.value;

  if (previousSupportNeed && previousSupportNeed !== "unclear") {
    return previousSupportNeed;
  }

  if (input.topicUpdatePlan.summaryTopic || input.sourceUnderstandings.length > 0) {
    return "issue_resolution";
  }

  return "unclear";
}

function resolveSupportNeedReason(
  input: RunTopicManagerInput,
  supportNeedValue: SupportNeedValue
): string | null {
  const previousReason = input.currentTopic?.sourceTopicManager.supportNeedResolution.supportNeed.reason;

  if (previousReason && supportNeedValue !== "unclear") {
    return previousReason;
  }

  if (supportNeedValue === "issue_resolution") {
    return "The optimized issue-resolution route is the implemented treatment route for this support topic.";
  }

  return "The topic does not contain enough information to select a treatment route.";
}

function buildProcessedOutput(params: {
  topicUpdatePlan: TopicUpdatePlan;
  say: string;
  sourceTopicManager: LiveMemoryTopicOptimized["sourceTopicManager"];
  intermediateOutputs: RunTopicManagerProcessedOutput["intermediateOutputs"];
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
  intermediateOutputs: RunTopicManagerFallbackOutput["intermediateOutputs"];
}): RunTopicManagerFallbackOutput {
  return {
    status: "fallback",
    fallbackReason: params.fallbackReason,
    topicPlannerOutput: null,
    sourceTopicManager: null,
    intermediateOutputs: params.intermediateOutputs
  };
}

function buildSupportNeedClarificationMessage(summaryTopic: string | null): string {
  const topicIntro = summaryTopic
    ? `I understand the topic as: ${summaryTopic}`
    : "I understand that you need help, but I cannot safely classify the request yet.";

  return `${topicIntro}\n\nCould you clarify whether you want help resolving a problem, requesting a feature, getting an answer, or asking the support team to take an action?`;
}

function buildNonIssueSupportNeedMessage(supportNeed: SupportNeedValue): string {
  return `I have classified this topic as ${supportNeed}. A support team member should take over from here.`;
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

export {runTopicManager};

export type {
  CurrentUserMessage,
  PreviousConversationTurn,
  RunTopicManagerInput,
  RunTopicManagerOutput,
  TopicPlannerOutput
};