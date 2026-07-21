import type {IssueProgressState, IssueStepPlan} from "../../../runIssueResolutionBranch";

function planSimilarTopicDisambiguationAsk(input: {
  issueProgressState: IssueProgressState;
}): IssueStepPlan {
  return {
    nextIssueProgressState: input.issueProgressState,
    say: input.issueProgressState.similarTopic.analysis.disambiguationQuestion ??
      "Votre problème ressemble à plusieurs cas possibles. Pouvez-vous préciser lequel correspond le mieux à votre situation ?"
  };
}

export {planSimilarTopicDisambiguationAsk};
