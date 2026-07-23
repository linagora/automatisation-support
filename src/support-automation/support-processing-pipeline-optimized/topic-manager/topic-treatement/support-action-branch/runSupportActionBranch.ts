import type {RoutedTopicBranchInput, RoutedTopicBranchOutput} from "../../runTopicBranch";

type SupportActionInternalOutputs = {
  branch: "support_action";
};

type SupportActionBranchOutput = RoutedTopicBranchOutput<SupportActionInternalOutputs>;

async function runSupportActionBranch(
  _input: RoutedTopicBranchInput
): Promise<SupportActionBranchOutput> {
  return {
    status: "processed",
    fallbackReason: null,
    say: "Thanks for your request. I understand that you are asking support to take action on something. I cannot process that action directly yet, but please describe exactly what you need support to do, why it is needed, and include any relevant identifiers or context so the support team can handle it properly.",
    internalOutputs: {
      branch: "support_action"
    }
  };
}

export {runSupportActionBranch};
export type {SupportActionBranchOutput, SupportActionInternalOutputs};
