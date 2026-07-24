import type {RoutedTopicBranchInput, RoutedTopicBranchOutput} from "../../runTopicBranch";

type KnowledgeAnswerInternalOutputs = {
  branch: "knowledge_answer";
};

type KnowledgeAnswerBranchOutput = RoutedTopicBranchOutput<KnowledgeAnswerInternalOutputs>;

async function runKnowledgeAnswerBranch(
  _input: RoutedTopicBranchInput
): Promise<KnowledgeAnswerBranchOutput> {
  return {
    status: "processed",
    fallbackReason: null,
    say: "Thanks for your question. I understand that you are looking for an answer or explanation. I cannot provide a detailed knowledge response yet, but please make your question as specific as possible, including the product area, the exact behavior you are asking about, and any relevant context so the support team can answer it properly.",
    internalOutputs: {
      branch: "knowledge_answer"
    }
  };
}

export {runKnowledgeAnswerBranch};
export type {KnowledgeAnswerBranchOutput, KnowledgeAnswerInternalOutputs};
