import type {IssueProgressState, IssueStepPlan} from "../../../runIssueResolutionBranch";

function planIssueSolutionResponse(input: {issueProgressState: IssueProgressState}): IssueStepPlan {
  if (input.issueProgressState.solution.status === "available") {
    const nextIssueProgressState: IssueProgressState = {
      ...input.issueProgressState,
      solution: {...input.issueProgressState.solution, status: "awaiting_user_result"},
      idleMode: {status: "waiting_user_result", resolution: "unknown", reason: "solution_proposed_waiting_for_user_feedback"}
    };

    return {nextIssueProgressState, say: buildAvailableSolutionSay(input.issueProgressState)};
  }

  if (input.issueProgressState.solution.status === "not_found" || input.issueProgressState.solution.status === "not_relevant") {
    const nextIssueProgressState: IssueProgressState = {
      ...input.issueProgressState,
      idleMode: {status: "active_unsolved", resolution: "unresolved", reason: input.issueProgressState.solution.status}
    };

    return {
      nextIssueProgressState,
      say: "Merci pour ces précisions. Je n’ai pas trouvé de solution automatique suffisamment fiable pour ce cas précis ; le support devra reprendre le sujet avec les éléments collectés. Vous pouvez continuer à envoyer toute information utile ici."
    };
  }

  return {nextIssueProgressState: input.issueProgressState, say: "Merci, je garde les éléments pour le support."};
}

function buildAvailableSolutionSay(issueProgressState: IssueProgressState): string {
  const solutionText = issueProgressState.solution.customerFacingSolution ?? "Je vous propose d’essayer la solution indiquée.";
  const actionList = issueProgressState.solution.attemptedActionsToTry
    .map((action, index) => `${index + 1}. ${action.action}`)
    .join("\n");

  if (actionList.trim() === "") {
    return `${solutionText}\n\nPouvez-vous essayer et me dire si cela résout le problème ?`;
  }

  return `${solutionText}\n\nÀ essayer :\n${actionList}\n\nDites-moi ensuite si cela a résolu le problème.`;
}

export {planIssueSolutionResponse};
