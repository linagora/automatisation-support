import type {IssueProgressState, IssueStepPlan} from "../issueResolutionTypes";

function planSimilarTopicDisambiguationAsk(input: {
  issueProgressState: IssueProgressState;
  topicId: number | null;
}): IssueStepPlan {
  return {
    nextIssueProgressState: input.issueProgressState,
    topicPlannerOutput: {
      topicId: input.topicId,
      say: input.issueProgressState.similarTopic.disambiguationQuestion ??
        "Votre problème ressemble à plusieurs cas possibles. Pouvez-vous préciser lequel correspond le mieux à votre situation ?"
    }
  };
}

export {planSimilarTopicDisambiguationAsk};
