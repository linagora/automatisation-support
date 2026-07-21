import {runFeatureRequestBranch, type FeatureRequestBranchOutput} from "./resolution-according-need/feature-request-branch/runFeatureRequestBranch";
import {runIssueResolutionBranch, type IssueResolutionBranchOutput} from "./resolution-according-need/issue-resolution-branch/runIssueResolutionBranch";
import {runKnowledgeAnswerBranch, type KnowledgeAnswerBranchOutput} from "./resolution-according-need/knowledge-answer-branch/runKnowledgeAnswerBranch";
import {runSupportActionBranch, type SupportActionBranchOutput} from "./resolution-according-need/support-action-branch/runSupportActionBranch";
import {runSupportNeedResolutionBranch, type SupportNeedResolutionBranchOutput} from "./support-need-resolution/runSupportNeedResolutionBranch";
import {runUnclearTopicBranch, type UnclearTopicBranchOutput} from "./resolution-according-need/unclear-topic-branch/runUnclearTopicBranch";

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

type LiveMemoryTopicOptimized = {
  topicId: number;
  title?: string | null;
  broadCategoryHint?: string | null;
  summary?: string | null;
  caseDetails?: Array<{key: string; value: Primitive; evidence?: string | null; status?: string}>;
  attemptedActions?: Array<{action: string; outcome?: string | null; evidence?: string | null}>;
  issueProgressState?: unknown;
  supportKnowledgeSummary?: unknown;
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

type CurrentUserMessage = {
  content: string;
};

type PreviousConversationTurn = {
  previousUserVerbatim: string | null;
  previousBotVerbatim: string | null;
};

type TopicBranchInput = {
  topicUpdatePlan: TopicUpdatePlan;
  currentTopic: LiveMemoryTopicOptimized | null;
  sourceUnderstandings: SupportUnderstanding[];
  currentUserMessage: CurrentUserMessage;
  previousConversationTurn: PreviousConversationTurn;
};

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

type RoutedTopicBranchInput = {
  topicBranchInput: TopicBranchInput;
  supportNeedResolution: SupportNeedResolution;
};

type RoutedTopicBranchOutput<TInternalOutputs = unknown> =
  | {
      status: "processed";
      fallbackReason: null;
      say: string;
      internalOutputs: TInternalOutputs;
    }
  | {
      status: "fallback";
      fallbackReason: unknown;
      say: null;
      internalOutputs: TInternalOutputs;
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

async function runTopicBranch(topicBranchInput: TopicBranchInput): Promise<TopicBranchOutput> {
  const intermediateOutputs = buildEmptyIntermediateOutputs();

  try {
    // 1. Resolve the global support need for this already-scoped topic.
    // This is the only LLM decision before routing. It does not write the final answer.
    const supportNeedResolutionOutput = await runSupportNeedResolutionBranch({topicBranchInput});
    intermediateOutputs.supportNeedResolutionOutput = supportNeedResolutionOutput;

    if (supportNeedResolutionOutput.status === "fallback") {
      return buildFallback(supportNeedResolutionOutput, intermediateOutputs);
    }

    // 2. Build the common input for the selected resolution branch.
    // All final branches receive the same shape and return only a say + internalOutputs.
    const supportNeedResolution = supportNeedResolutionOutput.supportNeedResolution;
    const routedInput = {topicBranchInput, supportNeedResolution};
    let routedBranchOutput: RoutedTopicBranchOutput;

    // 3. Route according to the resolved support need.
    // If the need or domain is unclear, the unclear branch has priority over every specific route.
    if (!supportNeedResolution.supportNeedIsClear || !supportNeedResolution.supportDomainIsClear || supportNeedResolution.supportNeed === "unclear") {
      const unclearTopicBranchOutput = await runUnclearTopicBranch(routedInput);
      routedBranchOutput = unclearTopicBranchOutput;
      intermediateOutputs.unclearTopicBranchOutput = unclearTopicBranchOutput;
    } else if (supportNeedResolution.supportNeed === "issue_resolution") {
      const issueResolutionBranchOutput = await runIssueResolutionBranch(routedInput);
      routedBranchOutput = issueResolutionBranchOutput;
      intermediateOutputs.issueResolutionBranchOutput = issueResolutionBranchOutput;
    } else if (supportNeedResolution.supportNeed === "knowledge_answer") {
      const knowledgeAnswerBranchOutput = await runKnowledgeAnswerBranch(routedInput);
      routedBranchOutput = knowledgeAnswerBranchOutput;
      intermediateOutputs.knowledgeAnswerBranchOutput = knowledgeAnswerBranchOutput;
    } else if (supportNeedResolution.supportNeed === "support_action") {
      const supportActionBranchOutput = await runSupportActionBranch(routedInput);
      routedBranchOutput = supportActionBranchOutput;
      intermediateOutputs.supportActionBranchOutput = supportActionBranchOutput;
    } else {
      const featureRequestBranchOutput = await runFeatureRequestBranch(routedInput);
      routedBranchOutput = featureRequestBranchOutput;
      intermediateOutputs.featureRequestBranchOutput = featureRequestBranchOutput;
    }

    // 4. Bubble up branch fallbacks with all intermediate outputs collected so far.
    if (routedBranchOutput.status === "fallback") {
      return buildFallback(routedBranchOutput, intermediateOutputs);
    }

    // 5. Convert the branch-local say into the topic-level planner output.
    // The branch does not own topicId; topicId is attached here from the topic update plan.
    return {
      status: "processed",
      fallbackReason: null,
      topicPlannerOutput: {
        topicId: topicBranchInput.topicUpdatePlan.targetTopicId,
        say: routedBranchOutput.say
      },
      intermediateOutputs
    };
  } catch (error) {
    return buildFallback(
      {source: "topic_branch_runner", errorMessage: error instanceof Error ? error.message : error},
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
  CurrentUserMessage,
  PreviousConversationTurn,
  Primitive,
  RoutedTopicBranchInput,
  RoutedTopicBranchOutput,
  SupportNeedResolution,
  SupportUnderstanding,
  TopicBranchInput,
  TopicBranchIntermediateOutputs,
  TopicBranchOutput,
  TopicPlannerOutput,
  TopicUpdatePlan
};
