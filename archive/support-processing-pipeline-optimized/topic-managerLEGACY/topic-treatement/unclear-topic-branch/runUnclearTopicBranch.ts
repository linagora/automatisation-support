import {getUnclearTopicFragment} from "../../../../support-catalog-optimized/supportTopicBranch.catalog";

import type {RoutedTopicBranchInput, RoutedTopicBranchOutput, SupportNeedResolution} from "../../runTopicBranch";
import type {UnclearTopicFragmentKey} from "../../../../support-catalog-optimized/supportTopicBranch.catalog";

type UnclearTopicInternalOutputs = {
  fragmentKeys: UnclearTopicFragmentKey[];
};

type UnclearTopicBranchOutput = RoutedTopicBranchOutput<UnclearTopicInternalOutputs>;

async function runUnclearTopicBranch(input: RoutedTopicBranchInput): Promise<UnclearTopicBranchOutput> {
  const fragmentKeys = selectFragmentKeys(input.supportNeedResolution);
  const fragments = fragmentKeys.map(getUnclearTopicFragment);

  return {
    status: "processed",
    fallbackReason: null,
    say: fragments.join(" "),
    internalOutputs: {
      fragmentKeys
    }
  };
}

function selectFragmentKeys(resolution: SupportNeedResolution): UnclearTopicFragmentKey[] {
  const fragmentKeys: UnclearTopicFragmentKey[] = [];

  if (!resolution.supportDomainIsClear) fragmentKeys.push("support_domain_unclear");

  if (!resolution.supportNeedIsClear) {
    fragmentKeys.push(resolution.unclearReason ?? "support_need_unclear");
  }

  return fragmentKeys.length > 0 ? fragmentKeys : ["too_ambiguous"];
}

export {runUnclearTopicBranch};
export type {UnclearTopicBranchOutput, UnclearTopicInternalOutputs};
