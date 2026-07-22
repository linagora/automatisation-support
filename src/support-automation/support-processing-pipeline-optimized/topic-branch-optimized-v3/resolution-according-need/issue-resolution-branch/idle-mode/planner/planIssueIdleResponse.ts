import type {IssueProgressState, IssueStepPlan} from "../../runIssueResolutionBranch";

function planIssueIdleResponse(input: {issueProgressState: IssueProgressState}): IssueStepPlan {
  return {
    nextIssueProgressState: input.issueProgressState,
    say: buildSay(input.issueProgressState)
  };
}

function buildSay(issueProgressState: IssueProgressState): string {
  if (issueProgressState.idleMode.status === "active_solved") {
    return "Je garde en mémoire que ce sujet semble résolu. Vous pouvez m’envoyer un nouveau détail si quelque chose change.";
  }

  if (issueProgressState.idleMode.status === "active_unsolved") {
    return "Je garde les éléments collectés pour le support. Vous pouvez continuer à ajouter des informations utiles ici, elles seront rattachées au sujet.";
  }

  return "Je garde le sujet ouvert et j’attends votre retour.";
}

export {planIssueIdleResponse};
