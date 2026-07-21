import {retrieveSimilarIssueTopicCandidates} from "./retrieveSimilarIssueTopicCandidates";

import type {SupportUnderstanding} from "../../../../runTopicBranch";
import type {IssueProgressState, SimilarIssueTopicCandidate} from "../../runIssueResolutionBranch";
import type {SimilarIssueTopicRetrievalOutput} from "./retrieveSimilarIssueTopicCandidates";

type SimilarIssueTopicSearchOutput = {
  status: "processed" | "fallback";
  fallbackReason: unknown | null;
  issueProgressState: IssueProgressState;
  retrievedCandidates: SimilarIssueTopicCandidate[];
  retrievalOutput: SimilarIssueTopicRetrievalOutput | null;
};

async function searchSimilarIssueTopics(input: {
  issueProgressState: IssueProgressState;
  supportDomain: string;
  topicSummary: string;
  sourceUnderstandings: SupportUnderstanding[];
}): Promise<SimilarIssueTopicSearchOutput> {
  const retrievalOutput = await retrieveSimilarIssueTopicCandidates(input);

  if (retrievalOutput.status === "fallback") {
    const issueProgressState = {
      ...input.issueProgressState,
      similarTopic: {
        ...input.issueProgressState.similarTopic,
        ragSearch: {
          status: "fallback" as const,
          retrievedCandidates: [],
          fallbackReason: retrievalOutput.fallbackReason
        }
      }
    };

    return {
      status: "fallback",
      fallbackReason: retrievalOutput.fallbackReason,
      issueProgressState,
      retrievedCandidates: [],
      retrievalOutput
    };
  }

  const issueProgressState = {
    ...input.issueProgressState,
    similarTopic: {
      ...input.issueProgressState.similarTopic,
      ragSearch: {
        status: "completed" as const,
        retrievedCandidates: retrievalOutput.candidates,
        fallbackReason: null
      }
    }
  };

  return {
    status: "processed",
    fallbackReason: null,
    issueProgressState,
    retrievedCandidates: retrievalOutput.candidates,
    retrievalOutput
  };
}

export {searchSimilarIssueTopics};
export type {SimilarIssueTopicSearchOutput};
