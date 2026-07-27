import type {TopicUpdatePlan} from "../../../propose-topic-updates-optimized/runProposeTopicUpdates";
import type {LiveMemoryTopicOptimized} from "../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";

type KnowledgeAnswerBranchInput = {
  topicUpdatePlan: TopicUpdatePlan;
  sourceTopicManager: LiveMemoryTopicOptimized["sourceTopicManager"];
};

type KnowledgeAnswerBranchOutput = {
  status: "processed";
  fallbackReason: null;
  say: string;
  sourceTopicManager: LiveMemoryTopicOptimized["sourceTopicManager"];
  internalOutputs: {
    branch: "knowledge_answer";
  };
};

async function runKnowledgeAnswerBranch(
  input: KnowledgeAnswerBranchInput
): Promise<KnowledgeAnswerBranchOutput> {
  return {
    status: "processed",
    fallbackReason: null,
    say: buildKnowledgeAnswerMessage(),
    sourceTopicManager: {
      ...input.sourceTopicManager,
      currentStep: "idle",
      resolutionStatus: {
        value: "unsolved",
        reason: "The topic is a knowledge question. The dedicated knowledge-answer route is not implemented yet."
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
      branch: "knowledge_answer"
    }
  };
}

function buildKnowledgeAnswerMessage(): string {
  return [
    "I’ve understood this as a question for the support team. The support team will review it.",
    "",
    "In the meantime, I can collect the most useful information to help them answer precisely.",
    "",
    "Please feel free to share as much information as possible about:",
    "- What you would like to understand or achieve, and where you are currently stuck.",
    "- Which product, page, feature, or situation your question is about, and what you have already tried."
  ].join("\n");
}

export {runKnowledgeAnswerBranch};
export type {KnowledgeAnswerBranchInput, KnowledgeAnswerBranchOutput};
