import type {IssueProgressState, IssueStepPlan} from "../../../runIssueResolutionBranch";

function planIssueSolutionUserFeedbackResponse(input: {issueProgressState: IssueProgressState}): IssueStepPlan {
  if (input.issueProgressState.idleMode.status === "active_solved" || input.issueProgressState.idleMode.status === "active_unsolved") {
    return {nextIssueProgressState: input.issueProgressState, say: buildIdleTransitionSay(input.issueProgressState)};
  }

  return {
    nextIssueProgressState: input.issueProgressState,
    say: buildWaitingUserResultSay(input.issueProgressState)
  };
}

function buildIdleTransitionSay(issueProgressState: IssueProgressState): string {
  if (issueProgressState.idleMode.status === "active_solved") {
    return "Super, je note que le sujet semble résolu. L’équipe support gardera quand même le contexte si une vérification est nécessaire.";
  }

  return "Merci pour le retour. Je note que la solution proposée n’a pas résolu le problème ; le support reprendra le sujet avec les éléments collectés. Vous pouvez continuer à ajouter des informations utiles ici.";
}

function buildWaitingUserResultSay(issueProgressState: IssueProgressState): string {
  const pendingActions = issueProgressState.solution.attemptedActionsToTry.filter((action) => action.status === "missing_but_asked");

  if (pendingActions.length === 0) {
    return "Merci. Est-ce que la solution proposée a résolu le problème ?";
  }

  return `Merci. Pour confirmer, pouvez-vous me dire si vous avez pu essayer cette action et si elle a résolu le problème : ${pendingActions[0].action}`;
}

export {planIssueSolutionUserFeedbackResponse};
