import type {TopicUpdatePlan} from "../../../propose-topic-updates-optimized/runProposeTopicUpdates";
import type {LiveMemoryTopicOptimized} from "../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";

type UnclearTopicBranchInput = {
  topicUpdatePlan: TopicUpdatePlan;
  sourceTopicManager: LiveMemoryTopicOptimized["sourceTopicManager"];
};

type UnclearTopicBranchOutput = {
  status: "processed";
  fallbackReason: null;
  say: string;
  topicStatus: LiveMemoryTopicOptimized["status"];
  topicHandoverRequest: {
    isRequested: boolean;
    reason: string | null;
  };
  sourceTopicManager: LiveMemoryTopicOptimized["sourceTopicManager"];
  internalOutputs: {
    branch: "unclear";
  };
};

async function runUnclearTopicBranch(
  input: UnclearTopicBranchInput
): Promise<UnclearTopicBranchOutput> {
  return {
    status: "processed",
    fallbackReason: null,
    say: buildUnclearTopicMessage(),
    topicStatus: "in_progress",
    topicHandoverRequest: {
      isRequested: false,
      reason: null
    },
    sourceTopicManager: {
      ...input.sourceTopicManager
    },
    internalOutputs: {
      branch: "unclear"
    }
  };
}

function buildUnclearTopicMessage(): string {
  return `I have not quite understood the nature of your request. Could you clarify whether you want help resolving a problem, requesting a feature, getting an answer, or asking the support team to take an action?`;
}

export {runUnclearTopicBranch};
export type {UnclearTopicBranchInput, UnclearTopicBranchOutput};
