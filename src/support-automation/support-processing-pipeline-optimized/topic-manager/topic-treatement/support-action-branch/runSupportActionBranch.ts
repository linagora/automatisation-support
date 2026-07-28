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
    say: buildSupportActionMessage(),
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

function buildSupportActionMessage(): string {
  return [
    "I’ve understood this as a request for the support team to take action. The support team will review it.",
    "",
    "In the meantime, I can collect the most useful information to help them handle the request clearly.",
    "",
    "Please feel free to share as much information as possible about:",
    "- What you would like the support team to do, and what item, account, file, ticket, or situation is affected.",
    "- Why this action is needed, how urgent it is, and whether you have already tried anything."
  ].join("\n");
}
export {runSupportActionBranch};
export type {SupportActionBranchInput, SupportActionBranchOutput};
