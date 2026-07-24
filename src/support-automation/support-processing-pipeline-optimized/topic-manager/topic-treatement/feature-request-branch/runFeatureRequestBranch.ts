import type {TopicUpdatePlan} from "../../../propose-topic-updates-optimized/runProposeTopicUpdates";
import type {LiveMemoryTopicOptimized} from "../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";

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
    say: buildFeatureRequestMessage(input.topicUpdatePlan),
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

function buildFeatureRequestMessage(topicUpdatePlan: TopicUpdatePlan): string {
  const topic = topicUpdatePlan.summaryTopic ?? topicUpdatePlan.title ?? "this request";

  return `Thanks, I’ve understood this as a feature request about ${topic}. I’ve kept the context. You can add what you would expect the feature to do, why it matters, and how it would improve your workflow.`;
}

export {runFeatureRequestBranch};
export type {FeatureRequestBranchInput, FeatureRequestBranchOutput};
