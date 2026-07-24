import type {TopicUpdatePlan} from "../../../propose-topic-updates-optimized/runProposeTopicUpdates";
import type {LiveMemoryTopicOptimized} from "../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";

type UnclearTopicBranchInput = {
  topicUpdatePlan: TopicUpdatePlan;
  sourceTopicManager: LiveMemoryTopicOptimized["sourceTopicManager"];
};

type UnclearTopicBranchOutput = {
  status: "processed";
  fallbackReason: null;
  say: string;
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
    say: buildUnclearTopicMessage(input),
    sourceTopicManager: {
      ...input.sourceTopicManager,
      currentStep: "support_need_resolution",
      resolutionStatus: {
        value: "in_progress",
        reason: "The system needs the user to clarify the kind of support needed."
      },
      handover: {
        isRequested: false,
        reason: null
      },
      idleMode: {
        isActivated: false
      }
    },
    internalOutputs: {
      branch: "unclear"
    }
  };
}

function buildUnclearTopicMessage(input: UnclearTopicBranchInput): string {
  const topicIntro = input.topicUpdatePlan.summaryTopic
    ? `I understand the topic as: ${input.topicUpdatePlan.summaryTopic}`
    : "I understand that you need help, but I cannot safely classify the request yet.";

  return `${topicIntro}\n\nCould you clarify whether you want help resolving a problem, requesting a feature, getting an answer, or asking the support team to take an action?`;
}

export {runUnclearTopicBranch};
export type {UnclearTopicBranchInput, UnclearTopicBranchOutput};
