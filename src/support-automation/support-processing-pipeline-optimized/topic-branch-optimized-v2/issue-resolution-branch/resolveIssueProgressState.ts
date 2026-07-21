import type {IssueProgressState} from "./issueResolutionTypes";

const emptyIssueProgressState: IssueProgressState = {
  basicQualification: {
    complete: false,
    fields: [],
    missingRequiredFields: [],
    missingRecommendedFields: [],
    nextAskFields: []
  },
  similarTopic: {
    complete: false,
    status: "not_searched",
    candidateTopics: [],
    selectedTopic: null,
    disambiguationQuestion: null
  },
  deepQualification: {
    complete: false,
    mode: null,
    fields: [],
    missingFields: [],
    nextAskFields: []
  },
  solution: {
    complete: false,
    status: "not_started",
    solution: null,
    confidence: null
  }
};

function resolveIssueProgressState(input: {
  currentTopic: unknown | null;
}): IssueProgressState {
  const storedState = (input.currentTopic as {issueProgressState?: Partial<IssueProgressState>} | null)?.issueProgressState;

  return {
    basicQualification: {...emptyIssueProgressState.basicQualification, ...storedState?.basicQualification},
    similarTopic: {...emptyIssueProgressState.similarTopic, ...storedState?.similarTopic},
    deepQualification: {...emptyIssueProgressState.deepQualification, ...storedState?.deepQualification},
    solution: {...emptyIssueProgressState.solution, ...storedState?.solution}
  };
}

export {resolveIssueProgressState};
