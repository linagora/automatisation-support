import type {IssueProgressState, IssueStepPlan} from "../issueResolutionTypes";

function planIssueSolutionResponse(input: {
  issueProgressState: IssueProgressState;
  topicId: number | null;
}): IssueStepPlan {
  const shouldMarkSolutionProvided = input.issueProgressState.solution.status === "available";
  const nextIssueProgressState = shouldMarkSolutionProvided
    ? {...input.issueProgressState, solution: {...input.issueProgressState.solution, status: "provided" as const}}
    : input.issueProgressState;

  return {
    nextIssueProgressState,
    topicPlannerOutput: {
      topicId: input.topicId,
      say: buildSay(input.issueProgressState)
    }
  };
}

function buildSay(issueProgressState: IssueProgressState): string {
  if (issueProgressState.solution.status === "available" && issueProgressState.solution.solution) {
    return issueProgressState.solution.solution;
  }

  if (issueProgressState.solution.status === "provided" || issueProgressState.solution.status === "awaiting_user_result") {
    return "Est-ce que la solution proposée a résolu le problème ?";
  }

  if (issueProgressState.solution.status === "not_relevant") {
    return "Je n’ai pas trouvé de solution suffisamment fiable pour ce cas précis. Je vais donc le traiter comme un cas à remonter au support.";
  }

  return "Je n’ai pas encore de solution fiable à proposer avec les informations disponibles.";
}

export {planIssueSolutionResponse};
