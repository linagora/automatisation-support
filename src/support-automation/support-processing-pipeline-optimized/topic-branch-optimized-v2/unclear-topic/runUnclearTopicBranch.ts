import {getUnclearTopicFragment} from "../../../support-catalog-optimized/supportTopicBranch.catalog";

import type {RoutedBranchOutput, SupportNeedResolution, TopicBranchContext} from "../runTopicBranch";
import type {UnclearTopicFragmentKey} from "../../../support-catalog-optimized/supportTopicBranch.catalog";

type UnclearTopicBranchOutput = RoutedBranchOutput & {
  unclearTopic?: {
    fragmentKeys: UnclearTopicFragmentKey[];
  };
};

async function runUnclearTopicBranch(input: {
  topicBranchContext: TopicBranchContext;
  supportNeedResolution: SupportNeedResolution;
}): Promise<UnclearTopicBranchOutput> {
  const fragmentKeys = selectFragmentKeys(input.supportNeedResolution);
  const fragments = fragmentKeys.map(getUnclearTopicFragment);

  return {
    status: "processed",
    fallbackReason: null,
    topicPlannerOutput: {
      topicId: input.topicBranchContext.topicUpdatePlan.targetTopicId,
      say: fragments.join(" ")
    },
    unclearTopic: {
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
export type {UnclearTopicBranchOutput};
