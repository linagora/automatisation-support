import {runFeatureRequestBranch, type FeatureRequestBranchOutput} from "./feature-request-branch/runFeatureRequestBranch";
import {runIssueResolutionBranch} from "./issue-resolution-branch/runIssueResolutionBranch";
import {runKnowledgeAnswerBranch, type KnowledgeAnswerBranchOutput} from "./knowledge-answer-branch/runKnowledgeAnswerBranch";
import {runSupportActionBranch, type SupportActionBranchOutput} from "./support-action-branch/runSupportActionBranch";
import {runSupportNeedResolutionBranch, type SupportNeedResolutionBranchOutput} from "./support-need-resolution/runSupportNeedResolutionBranch";
import {runUnclearTopicBranch, type UnclearTopicBranchOutput} from "./unclear-topic/runUnclearTopicBranch";

import type {IssueResolutionBranchOutput} from "./issue-resolution-branch/issueResolutionTypes";
import type {SupportNeed, SupportNeedUnclearReason} from "../../support-catalog-optimized/supportTopicBranch.catalog";

type Primitive = string | number | boolean | null;

type SupportUnderstanding = {
  understandingId: string;
  sourceSegmentIds: string[];
  extractedFields: Array<{key: string; value: Primitive; evidence: string}>;
  attemptedActions: Array<{action: string; outcome: string; evidence: string}>;
  other: Array<{key: string; value: Primitive; evidence: string}>;
  summary: string;
  supportDomain: string;
};

type AnalyzeSupportTextUnderstanding = SupportUnderstanding;

type LiveMemoryTopicOptimized = {
  topicId: number;
  [key: string]: unknown;
};

type TopicUpdatePlan = {
  operation: "create" | "update";
  sourceUnderstandingIds: string[];
  targetTopicId: number | null;
  topicIdentity: {
    title: string | null;
    supportDomain: string | null;
    summary: string | null;
  };
};

type PreviousConversationTurn = {
  previousUserVerbatim: string | null;
  previousBotVerbatim: string | null;
};

type TopicBranchInput = {
  topicUpdatePlan: TopicUpdatePlan;
  currentTopic: LiveMemoryTopicOptimized | null;
  sourceUnderstandings: SupportUnderstanding[];
  currentUserMessage: {
    content: string;
  };
  previousConversationTurn: PreviousConversationTurn;
};

type TopicBranchContext = TopicBranchInput;

type SupportNeedResolution = {
  supportNeed: SupportNeed;
  unclearReason: SupportNeedUnclearReason | null;
  supportDomain: string | null;
  supportNeedIsClear: boolean;
  supportDomainIsClear: boolean;
  reason: string;
};

type TopicPlannerOutput = {
  topicId: number | null;
  say: string;
};

type RoutedBranchOutput =
  | {
      status: "processed";
      fallbackReason: null;
      topicPlannerOutput: TopicPlannerOutput;
      [key: string]: unknown;
    }
  | {
      status: "fallback";
      fallbackReason: unknown;
      topicPlannerOutput: null;
      [key: string]: unknown;
    };

type TopicBranchIntermediateOutputs = {
  supportNeedResolutionOutput: SupportNeedResolutionBranchOutput | null;
  unclearTopicBranchOutput: UnclearTopicBranchOutput | null;
  issueResolutionBranchOutput: IssueResolutionBranchOutput | null;
  knowledgeAnswerBranchOutput: KnowledgeAnswerBranchOutput | null;
  supportActionBranchOutput: SupportActionBranchOutput | null;
  featureRequestBranchOutput: FeatureRequestBranchOutput | null;
};

type TopicBranchOutput =
  | {
      status: "processed";
      fallbackReason: null;
      topicPlannerOutput: TopicPlannerOutput;
      intermediateOutputs: TopicBranchIntermediateOutputs;
    }
  | {
      status: "fallback";
      fallbackReason: unknown;
      topicPlannerOutput: null;
      intermediateOutputs: TopicBranchIntermediateOutputs;
    };

async function runTopicBranch(params: TopicBranchInput): Promise<TopicBranchOutput> {
  const intermediateOutputs = buildEmptyIntermediateOutputs();

  try {
    const topicBranchContext: TopicBranchContext = params;

    const supportNeedResolutionOutput = await runSupportNeedResolutionBranch({topicBranchContext});
    intermediateOutputs.supportNeedResolutionOutput = supportNeedResolutionOutput;

    if (supportNeedResolutionOutput.status === "fallback") {
      return buildFallback(supportNeedResolutionOutput, intermediateOutputs);
    }

    const supportNeedResolution = supportNeedResolutionOutput.supportNeedResolution;
    let routedBranchOutput: RoutedBranchOutput;

    if (!supportNeedResolution.supportNeedIsClear || !supportNeedResolution.supportDomainIsClear || supportNeedResolution.supportNeed === "unclear") {
      routedBranchOutput = await runUnclearTopicBranch({topicBranchContext, supportNeedResolution});
      intermediateOutputs.unclearTopicBranchOutput = routedBranchOutput;
    } else if (supportNeedResolution.supportNeed === "issue_resolution") {
      routedBranchOutput = await runIssueResolutionBranch({topicBranchContext, supportNeedResolution});
      intermediateOutputs.issueResolutionBranchOutput = routedBranchOutput;
    } else if (supportNeedResolution.supportNeed === "knowledge_answer") {
      const knowledgeAnswerBranchOutput = await runKnowledgeAnswerBranch({topicBranchContext, supportNeedResolution});
      routedBranchOutput = knowledgeAnswerBranchOutput;
      intermediateOutputs.knowledgeAnswerBranchOutput = knowledgeAnswerBranchOutput;
    } else if (supportNeedResolution.supportNeed === "support_action") {
      const supportActionBranchOutput = await runSupportActionBranch({topicBranchContext, supportNeedResolution});
      routedBranchOutput = supportActionBranchOutput;
      intermediateOutputs.supportActionBranchOutput = supportActionBranchOutput;
    } else {
      const featureRequestBranchOutput = await runFeatureRequestBranch({topicBranchContext, supportNeedResolution});
      routedBranchOutput = featureRequestBranchOutput;
      intermediateOutputs.featureRequestBranchOutput = featureRequestBranchOutput;
    }

    if (routedBranchOutput.status === "fallback") {
      return buildFallback(routedBranchOutput, intermediateOutputs);
    }

    return {
      status: "processed",
      fallbackReason: null,
      topicPlannerOutput: routedBranchOutput.topicPlannerOutput,
      intermediateOutputs
    };
  } catch (error) {
    return buildFallback(
      {source: "runner_or_unexpected", errorMessage: error instanceof Error ? error.message : error},
      intermediateOutputs
    );
  }
}

function buildEmptyIntermediateOutputs(): TopicBranchIntermediateOutputs {
  return {
    supportNeedResolutionOutput: null,
    unclearTopicBranchOutput: null,
    issueResolutionBranchOutput: null,
    knowledgeAnswerBranchOutput: null,
    supportActionBranchOutput: null,
    featureRequestBranchOutput: null
  };
}

function buildFallback(
  fallbackReason: unknown,
  intermediateOutputs: TopicBranchIntermediateOutputs
): TopicBranchOutput {
  return {
    status: "fallback",
    fallbackReason,
    topicPlannerOutput: null,
    intermediateOutputs
  };
}

export {runTopicBranch};
export type {
  LiveMemoryTopicOptimized,
  AnalyzeSupportTextUnderstanding,
  PreviousConversationTurn,
  RoutedBranchOutput,
  SupportNeedResolution,
  SupportUnderstanding,
  TopicBranchContext,
  TopicBranchInput,
  TopicBranchIntermediateOutputs,
  TopicBranchOutput,
  TopicPlannerOutput,
  TopicUpdatePlan
};
