import {assessIssueBasicQualification} from "./basic-qualification/assessIssueBasicQualification";
import {planIssueBasicQualificationAsk} from "./basic-qualification/planIssueBasicQualificationAsk";
import {assessIssueDeepQualification} from "./deep-qualification/assessIssueDeepQualification";
import {planIssueDeepQualificationAsk} from "./deep-qualification/planIssueDeepQualificationAsk";
import {resolveIssueProgressState} from "./resolveIssueProgressState";
import {planSimilarTopicDisambiguationAsk} from "./similar-topic/planSimilarTopicDisambiguationAsk";
import {searchSimilarIssueTopics} from "./similar-topic/searchSimilarIssueTopics";
import {extractIssueSolution} from "./solution/extractIssueSolution";
import {planIssueSolutionResponse} from "./solution/planIssueSolutionResponse";

import type {SupportNeedResolution, TopicBranchContext} from "../runTopicBranch";
import type {IssueProgressState, IssueResolutionBranchOutput} from "./issueResolutionTypes";

async function runIssueResolutionBranch(input: {
  topicBranchContext: TopicBranchContext;
  supportNeedResolution: SupportNeedResolution;
}): Promise<IssueResolutionBranchOutput> {
  const supportDomain = input.supportNeedResolution.supportDomain;

  if (supportDomain === null) {
    return {
      status: "fallback",
      fallbackReason: {source: "issue_resolution_branch", reason: "Missing supportDomain"},
      topicPlannerOutput: null
    };
  }

  let issueProgressState: IssueProgressState = resolveIssueProgressState({
    currentTopic: input.topicBranchContext.currentTopic
  });

  if (!issueProgressState.basicQualification.complete) {
    issueProgressState = assessIssueBasicQualification({
      supportDomain,
      issueProgressState,
      sourceUnderstandings: input.topicBranchContext.sourceUnderstandings
    });
  }

  if (!issueProgressState.basicQualification.complete) {
    return buildProcessed(planIssueBasicQualificationAsk({
      issueProgressState,
      topicId: input.topicBranchContext.topicUpdatePlan.targetTopicId
    }));
  }

  if (!issueProgressState.similarTopic.complete) {
    issueProgressState = await searchSimilarIssueTopics({
      issueProgressState,
      supportDomain,
      topicSummary: input.topicBranchContext.topicUpdatePlan.topicIdentity.summary ?? "Support issue"
    });
  }

  if (issueProgressState.similarTopic.status === "fallback") {
    return buildFallback("searchSimilarIssueTopics", issueProgressState);
  }

  if (!issueProgressState.similarTopic.complete) {
    return buildProcessed(planSimilarTopicDisambiguationAsk({
      issueProgressState,
      topicId: input.topicBranchContext.topicUpdatePlan.targetTopicId
    }));
  }

  if (!issueProgressState.deepQualification.complete) {
    issueProgressState = assessIssueDeepQualification({
      issueProgressState,
      sourceUnderstandings: input.topicBranchContext.sourceUnderstandings,
      supportDomain
    });
  }

  if (!issueProgressState.deepQualification.complete) {
    return buildProcessed(planIssueDeepQualificationAsk({
      issueProgressState,
      topicId: input.topicBranchContext.topicUpdatePlan.targetTopicId
    }));
  }

  if (!issueProgressState.solution.complete) {
    issueProgressState = await extractIssueSolution({issueProgressState});
  }

  if (issueProgressState.solution.status === "fallback") {
    return buildFallback("extractIssueSolution", issueProgressState);
  }

  return buildProcessed(planIssueSolutionResponse({
    issueProgressState,
    topicId: input.topicBranchContext.topicUpdatePlan.targetTopicId
  }));
}

function buildProcessed(plan: {topicPlannerOutput: NonNullable<IssueResolutionBranchOutput["topicPlannerOutput"]>; nextIssueProgressState: IssueProgressState}): IssueResolutionBranchOutput {
  return {
    status: "processed",
    fallbackReason: null,
    topicPlannerOutput: plan.topicPlannerOutput,
    issueProgressState: plan.nextIssueProgressState
  };
}

function buildFallback(source: string, issueProgressState: IssueProgressState): IssueResolutionBranchOutput {
  return {
    status: "fallback",
    fallbackReason: {source, status: "fallback"},
    topicPlannerOutput: null,
    issueProgressState
  };
}

export {runIssueResolutionBranch};
export type {IssueResolutionBranchOutput};
