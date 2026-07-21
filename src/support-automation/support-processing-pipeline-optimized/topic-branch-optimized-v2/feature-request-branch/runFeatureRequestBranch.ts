import type {RoutedBranchOutput, SupportNeedResolution, TopicBranchContext} from "../runTopicBranch";

type RunFeatureRequestBranchInput = {
  topicBranchContext: TopicBranchContext;
  supportNeedResolution: SupportNeedResolution;
};

type FeatureRequestBranchOutput = RoutedBranchOutput & {
  status: "processed";
  fallbackReason: null;
  branch: "feature_request";
};

async function runFeatureRequestBranch(
  input: RunFeatureRequestBranchInput
): Promise<FeatureRequestBranchOutput> {
  return {
    status: "processed",
    fallbackReason: null,
    branch: "feature_request",
    topicPlannerOutput: {
      topicId: input.topicBranchContext.topicUpdatePlan.targetTopicId,
      say: "Thanks for the feature request. I understand that you would like this capability to be considered. I cannot process it in more depth yet, but please share what you would like the feature to do, why it matters to you, and how it would impact your workflow so the support team can review it properly."
    }
  };
}

export {runFeatureRequestBranch};
export type {FeatureRequestBranchOutput, RunFeatureRequestBranchInput};
