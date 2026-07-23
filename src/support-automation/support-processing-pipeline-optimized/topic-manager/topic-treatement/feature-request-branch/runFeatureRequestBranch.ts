import type {RoutedTopicBranchInput, RoutedTopicBranchOutput} from "../../runTopicBranch";

type FeatureRequestInternalOutputs = {
  branch: "feature_request";
};

type FeatureRequestBranchOutput = RoutedTopicBranchOutput<FeatureRequestInternalOutputs>;

async function runFeatureRequestBranch(
  _input: RoutedTopicBranchInput
): Promise<FeatureRequestBranchOutput> {
  return {
    status: "processed",
    fallbackReason: null,
    say: "Thanks for the feature request. I understand that you would like this capability to be considered. I cannot process it in more depth yet, but please share what you would like the feature to do, why it matters to you, and how it would impact your workflow so the support team can review it properly.",
    internalOutputs: {
      branch: "feature_request"
    }
  };
}

export {runFeatureRequestBranch};
export type {FeatureRequestBranchOutput, FeatureRequestInternalOutputs};
