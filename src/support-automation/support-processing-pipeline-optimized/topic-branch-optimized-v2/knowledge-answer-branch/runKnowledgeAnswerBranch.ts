import type {RoutedBranchOutput, SupportNeedResolution, TopicBranchContext} from "../runTopicBranch";

type RunKnowledgeAnswerBranchInput = {
  topicBranchContext: TopicBranchContext;
  supportNeedResolution: SupportNeedResolution;
};

type KnowledgeAnswerBranchOutput = RoutedBranchOutput & {
  status: "processed";
  fallbackReason: null;
  branch: "knowledge_answer";
};

async function runKnowledgeAnswerBranch(
  input: RunKnowledgeAnswerBranchInput
): Promise<KnowledgeAnswerBranchOutput> {
  return {
    status: "processed",
    fallbackReason: null,
    branch: "knowledge_answer",
    topicPlannerOutput: {
      topicId: input.topicBranchContext.topicUpdatePlan.targetTopicId,
      say: "Thanks for your question. I understand that you are looking for an answer or explanation. I cannot provide a detailed knowledge response yet, but please make your question as specific as possible, including the product area, the exact behavior you are asking about, and any relevant context so the support team can answer it properly."
    }
  };
}

export {runKnowledgeAnswerBranch};
export type {KnowledgeAnswerBranchOutput, RunKnowledgeAnswerBranchInput};
