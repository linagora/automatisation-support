import type {TopicUpdatePlan} from "../../../propose-topic-updates-optimized/runProposeTopicUpdates";
import type {LiveMemoryTopicOptimized} from "../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";

type SupportActionBranchInput = {
  topicUpdatePlan: TopicUpdatePlan;
  sourceTopicManager: LiveMemoryTopicOptimized["sourceTopicManager"];
};

type SupportActionBranchOutput = {
  status: "processed";
  fallbackReason: null;
  say: string;
  sourceTopicManager: LiveMemoryTopicOptimized["sourceTopicManager"];
  internalOutputs: {
    branch: "support_action";
  };
};

async function runSupportActionBranch(
  input: SupportActionBranchInput
): Promise<SupportActionBranchOutput> {
  return {
    status: "processed",
    fallbackReason: null,
    say: buildSupportActionMessage(input.topicUpdatePlan),
    sourceTopicManager: {
      ...input.sourceTopicManager,
      currentStep: "idle",
      resolutionStatus: {
        value: "unsolved",
        reason: "The topic requires a support action rather than automated issue resolution."
      },
      handover: {
        isRequested: true,
        reason: "A support team member must take or review the requested action."
      },
      idleMode: {
        isActivated: true
      }
    },
    internalOutputs: {
      branch: "support_action"
    }
  };
}

function buildSupportActionMessage(topicUpdatePlan: TopicUpdatePlan): string {
  const topic = topicUpdatePlan.summaryTopic ?? topicUpdatePlan.title ?? "this request";

  return `I’ve understood this as a request for the support team to take action on ${topic}. I’ve kept the context and will recommend human handover for this topic.`;
}

export {runSupportActionBranch};
export type {SupportActionBranchInput, SupportActionBranchOutput};
