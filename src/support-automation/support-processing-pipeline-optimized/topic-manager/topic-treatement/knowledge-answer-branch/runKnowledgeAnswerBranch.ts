import type {TopicUpdatePlan} from "../../../propose-topic-updates-optimized/runProposeTopicUpdates";
import type {LiveMemoryTopicOptimized} from "../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";

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
    say: buildKnowledgeAnswerMessage(input.topicUpdatePlan),
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

function buildKnowledgeAnswerMessage(topicUpdatePlan: TopicUpdatePlan): string {
  const topic = topicUpdatePlan.summaryTopic ?? topicUpdatePlan.title ?? "your question";

  return `I’ve understood this as a question about ${topic}. I’ve kept the context. This automated branch is not fully implemented yet, so please add any detail that would help the support team answer precisely.`;
}

export {runKnowledgeAnswerBranch};
export type {KnowledgeAnswerBranchInput, KnowledgeAnswerBranchOutput};
