import type {IssueProgressState, SimilarIssueTopicCandidate} from "../issueResolutionTypes";

async function searchSimilarIssueTopics(input: {
  issueProgressState: IssueProgressState;
  supportDomain: string;
  topicSummary: string;
}): Promise<IssueProgressState> {
  // Structural placeholder. Replace with actual similarity/RAG connector later.
  const candidates = await searchCandidatesPlaceholder(input);

  if (candidates.length === 1) {
    return {
      ...input.issueProgressState,
      similarTopic: {
        complete: true,
        status: "identified",
        candidateTopics: candidates,
        selectedTopic: candidates[0],
        disambiguationQuestion: null
      }
    };
  }

  if (candidates.length > 1) {
    return {
      ...input.issueProgressState,
      similarTopic: {
        complete: false,
        status: "unclear",
        candidateTopics: candidates,
        selectedTopic: null,
        disambiguationQuestion: buildDisambiguationQuestion(candidates)
      }
    };
  }

  return {
    ...input.issueProgressState,
    similarTopic: {
      complete: true,
      status: "absent",
      candidateTopics: [],
      selectedTopic: null,
      disambiguationQuestion: null
    }
  };
}

async function searchCandidatesPlaceholder(_input: {
  issueProgressState: IssueProgressState;
  supportDomain: string;
  topicSummary: string;
}): Promise<SimilarIssueTopicCandidate[]> {
  return [];
}

function buildDisambiguationQuestion(candidates: SimilarIssueTopicCandidate[]): string {
  const titles = candidates.slice(0, 3).map((candidate) => candidate.title).join(", ");
  return `Votre problème peut correspondre à plusieurs cas proches (${titles}). Pouvez-vous préciser lequel ressemble le plus à votre situation ?`;
}

export {searchSimilarIssueTopics};
