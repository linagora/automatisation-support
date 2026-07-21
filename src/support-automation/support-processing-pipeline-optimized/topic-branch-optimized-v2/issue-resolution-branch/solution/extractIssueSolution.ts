import type {IssueProgressState} from "../issueResolutionTypes";

async function extractIssueSolution(input: {
  issueProgressState: IssueProgressState;
}): Promise<IssueProgressState> {
  // Structural placeholder. Later this can use RAG/synthesized knowledge.
  const selectedTopic = input.issueProgressState.similarTopic.selectedTopic;

  if (selectedTopic?.solutionSummary) {
    return {
      ...input.issueProgressState,
      solution: {
        complete: true,
        status: "available",
        solution: selectedTopic.solutionSummary,
        confidence: selectedTopic.score
      }
    };
  }

  return {
    ...input.issueProgressState,
    solution: {
      complete: true,
      status: selectedTopic ? "not_relevant" : "not_found",
      solution: null,
      confidence: null
    }
  };
}

export {extractIssueSolution};
