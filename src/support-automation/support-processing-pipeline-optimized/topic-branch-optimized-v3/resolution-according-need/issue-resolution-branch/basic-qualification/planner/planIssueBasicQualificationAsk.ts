import {callLLM} from "../../../../../../../infrastructure/llm/llm-client";
import {parseLLMResponse} from "../../../../../../../infrastructure/llm/parseLLMResponse";
import {buildDeterministicBasicQualificationAsk, buildIssueBasicQualificationAskPrompt} from "./buildIssueBasicQualificationAskPrompt";
import {issueQualificationAskPlannerResponseFormat} from "./responseFormat";
import {validateIssueBasicQualificationAskPlannerOutput} from "./validateIssueBasicQualificationAskPlannerOutput";

import type {CurrentUserMessage, PreviousConversationTurn} from "../../../../runTopicBranch";
import type {IssueProgressState, IssueStepPlan} from "../../runIssueResolutionBranch";

async function planIssueBasicQualificationAsk(input: {
  issueProgressState: IssueProgressState;
  currentUserMessage: CurrentUserMessage;
  previousConversationTurn: PreviousConversationTurn;
}): Promise<IssueStepPlan> {
  const nextIssueProgressState = {
    ...input.issueProgressState,
    basicQualification: {
      ...input.issueProgressState.basicQualification,
      fields: markAskedFields(input.issueProgressState.basicQualification.fields, input.issueProgressState.basicQualification.nextAskFields)
    }
  };

  const fallbackSay = buildDeterministicBasicQualificationAsk({issueProgressState: input.issueProgressState});
  const missingFields = input.issueProgressState.basicQualification.nextAskFields
    .map((key) => input.issueProgressState.basicQualification.fields.find((field) => field.key === key))
    .filter((field): field is IssueProgressState["basicQualification"]["fields"][number] => Boolean(field));

  const {messages} = buildIssueBasicQualificationAskPrompt({
    currentUserMessage: input.currentUserMessage,
    previousConversationTurn: input.previousConversationTurn,
    missingFields,
    attemptedActionSignal: input.issueProgressState.basicQualification.attemptedActionSignal
  });

  try {
    const result = await callLLM(messages, {
      stage: "issue_basic_qualification_ask_planner",
      preset: "standard",
      temperature: 0.2,
      maxTokens: 350,
      responseFormat: issueQualificationAskPlannerResponseFormat
    });

    if (!result.success || !result.content) {
      return {nextIssueProgressState, say: fallbackSay};
    }

    const parsed = parseLLMResponse(result.content);
    const validated = validateIssueBasicQualificationAskPlannerOutput(parsed);

    return {
      nextIssueProgressState,
      say: validated?.say ?? fallbackSay
    };
  } catch {
    return {nextIssueProgressState, say: fallbackSay};
  }
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
