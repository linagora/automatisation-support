import {getBasicIssueFieldAskPrompt} from "./issueBasicQualification.catalog";

import type {IssueProgressState, IssueStepPlan} from "../issueResolutionTypes";

function planIssueBasicQualificationAsk(input: {
  issueProgressState: IssueProgressState;
  topicId: number | null;
}): IssueStepPlan {
  const nextIssueProgressState = {
    ...input.issueProgressState,
    basicQualification: {
      ...input.issueProgressState.basicQualification,
      fields: markAskedFields(input.issueProgressState.basicQualification.fields, input.issueProgressState.basicQualification.nextAskFields)
    }
  };

  return {
    nextIssueProgressState,
    topicPlannerOutput: {
      topicId: input.topicId,
      say: buildFragments(input.issueProgressState).join(" ")
    }
  };
}

function buildFragments(issueProgressState: IssueProgressState): string[] {
  const fieldsByKey = new Map(issueProgressState.basicQualification.fields.map((field) => [field.key, field]));

  return issueProgressState.basicQualification.nextAskFields.map((key) => {
    const field = fieldsByKey.get(key);
    const askPrompt = getBasicIssueFieldAskPrompt(key);

    if (!field) return askPrompt;
    if (field.askedCount >= 1) return `${askPrompt} If you cannot provide this information, please say so and I can continue with what is available.`;
    return askPrompt;
  });
}

function markAskedFields(fields: IssueProgressState["basicQualification"]["fields"], nextAskFields: string[]): IssueProgressState["basicQualification"]["fields"] {
  const askSet = new Set(nextAskFields);

  return fields.map((field) => {
    if (!askSet.has(field.key) || field.status === "obtained" || field.status === "user_declared_unavailable") return field;
    const askedCount = field.askedCount + 1;
    return {...field, askedCount, status: askedCount >= 2 ? "asked_again" : "asked_once"};
  });
}

export {planIssueBasicQualificationAsk};
