import type {RoutedBranchOutput, SupportNeedResolution, TopicBranchContext} from "../runTopicBranch";

type RunSupportActionBranchInput = {
  topicBranchContext: TopicBranchContext;
  supportNeedResolution: SupportNeedResolution;
};

type SupportActionBranchOutput = RoutedBranchOutput & {
  status: "processed";
  fallbackReason: null;
  branch: "support_action";
};

async function runSupportActionBranch(
  input: RunSupportActionBranchInput
): Promise<SupportActionBranchOutput> {
  return {
    status: "processed",
    fallbackReason: null,
    branch: "support_action",
    topicPlannerOutput: {
      topicId: input.topicBranchContext.topicUpdatePlan.targetTopicId,
      say: "Thanks for your request. I understand that you are asking support to take action on something. I cannot process that action directly yet, but please describe exactly what you need support to do, why it is needed, and include any relevant identifiers or context so the support team can handle it properly."
    }
  };
}

export {runSupportActionBranch};
export type {SupportActionBranchOutput, RunSupportActionBranchInput};
