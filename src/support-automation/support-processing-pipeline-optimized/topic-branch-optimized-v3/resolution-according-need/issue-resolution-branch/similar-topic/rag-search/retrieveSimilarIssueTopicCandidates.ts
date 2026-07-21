import type {SupportUnderstanding} from "../../../../runTopicBranch";
import type {IssueProgressState, SimilarIssueTopicCandidate} from "../../runIssueResolutionBranch";

type SimilarIssueTopicRetrievalInput = {
  issueProgressState: IssueProgressState;
  supportDomain: string;
  topicSummary: string;
  sourceUnderstandings: SupportUnderstanding[];
};

type SimilarIssueTopicRetrievalOutput = {
  status: "processed" | "fallback";
  fallbackReason: unknown | null;
  candidates: SimilarIssueTopicCandidate[];
};

async function retrieveSimilarIssueTopicCandidates(
  input: SimilarIssueTopicRetrievalInput
): Promise<SimilarIssueTopicRetrievalOutput> {
  void input;

  // Structural placeholder for the future RAG connector.
  // It intentionally returns no candidates for now, while preserving the contract:
  // raw retrieval candidates are produced here, and interpreted later by rag-search-analyze.
  return {
    status: "processed",
    fallbackReason: null,
    candidates: []
  };
}

export {retrieveSimilarIssueTopicCandidates};
export type {SimilarIssueTopicRetrievalInput, SimilarIssueTopicRetrievalOutput};
