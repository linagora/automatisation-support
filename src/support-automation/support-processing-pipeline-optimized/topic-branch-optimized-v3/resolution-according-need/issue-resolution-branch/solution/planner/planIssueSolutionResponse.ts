import type {IssueProgressState, IssueStepPlan} from "../../runIssueResolutionBranch";

function planIssueSolutionResponse(input: {
  issueProgressState: IssueProgressState;
}): IssueStepPlan {
  const shouldMarkSolutionProvided = input.issueProgressState.solution.status === "available";
  const nextIssueProgressState = shouldMarkSolutionProvided
    ? {...input.issueProgressState, solution: {...input.issueProgressState.solution, status: "provided" as const}}
    : input.issueProgressState;

  return {
    nextIssueProgressState,
    say: buildSay(input.issueProgressState)
  };
}

function buildSay(issueProgressState: IssueProgressState): string {
  if (issueProgressState.solution.status === "available" && issueProgressState.solution.customerFacingSolution) {
    return issueProgressState.solution.customerFacingSolution;
  }

  if (issueProgressState.solution.status === "provided" || issueProgressState.solution.status === "awaiting_user_result") {
    return "Est-ce que la solution proposée a résolu le problème ?";
  }

  if (issueProgressState.solution.status === "not_relevant") {
    return "Je n’ai pas trouvé de solution automatique suffisamment fiable pour ce cas précis. Je vais donc transmettre les éléments au support pour une prise en charge plus approfondie.";
  }

  return "Merci pour ces précisions. Je n’ai pas encore trouvé de solution automatique fiable avec les informations disponibles ; le support devra reprendre ce cas avec les éléments collectés.";
}

export {planIssueSolutionResponse};
