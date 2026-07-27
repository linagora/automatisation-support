import type {TopicUpdatePlan} from "../../../propose-topic-updates-optimized/runProposeTopicUpdates";
import type {LiveMemoryTopicOptimized} from "../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";

type FeatureRequestBranchInput = {
  topicUpdatePlan: TopicUpdatePlan;
  sourceTopicManager: LiveMemoryTopicOptimized["sourceTopicManager"];
};

type FeatureRequestBranchOutput = {
  status: "processed";
  fallbackReason: null;
  say: string;
  sourceTopicManager: LiveMemoryTopicOptimized["sourceTopicManager"];
  internalOutputs: {
    branch: "feature_request";
  };
};

async function runFeatureRequestBranch(
  input: FeatureRequestBranchInput
): Promise<FeatureRequestBranchOutput> {
  return {
    status: "processed",
    fallbackReason: null,
    say: buildFeatureRequestMessage(),
    sourceTopicManager: {
      ...input.sourceTopicManager,
      currentStep: "idle",
      resolutionStatus: {
        value: "unsolved",
        reason: "The topic is a feature request. The automated issue-resolution route does not treat this branch yet."
      },
      handover: {
        isRequested: false,
        reason: null
      },
      idleMode: {
        isActivated: true
      }
    },
    internalOutputs: {
      branch: "feature_request"
    }
  };
}

function buildFeatureRequestMessage(): string {
  return [
    "I’ve understood this as a feature request. The support team will review it.",
    "",
    "In the meantime, I can collect the most useful information to help them understand the request clearly.",
    "",
    "Please feel free to share as much information as possible about:",
    "- What you would like to add or change, and what you would expect it to do.",
    "- Why you need it, what use case it solves, and how important it is for your workflow."
  ].join("\n");
}

export {runFeatureRequestBranch};
export type {FeatureRequestBranchInput, FeatureRequestBranchOutput};
