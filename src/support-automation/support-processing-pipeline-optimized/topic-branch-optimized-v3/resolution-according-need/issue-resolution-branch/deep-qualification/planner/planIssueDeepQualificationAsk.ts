import {callLLM} from "../../../../../../../infrastructure/llm/llm-client";
import {parseLLMResponse} from "../../../../../../../infrastructure/llm/parseLLMResponse";
import {buildDeterministicDeepQualificationAsk, buildIssueDeepQualificationAskPrompt} from "./buildIssueDeepQualificationAskPrompt";
import {issueDeepQualificationAskPlannerResponseFormat} from "./responseFormat";
import {validateIssueDeepQualificationAskPlannerOutput} from "./validateIssueDeepQualificationAskPlannerOutput";

import type {CurrentUserMessage, PreviousConversationTurn} from "../../../../runTopicBranch";
import type {IssueProgressState, IssueStepPlan} from "../../runIssueResolutionBranch";

async function planIssueDeepQualificationAsk(input: {
  issueProgressState: IssueProgressState;
  currentUserMessage: CurrentUserMessage;
  previousConversationTurn: PreviousConversationTurn;
}): Promise<IssueStepPlan> {
  const nextIssueProgressState = {
    ...input.issueProgressState,
    deepQualification: {
      ...input.issueProgressState.deepQualification,
      fields: markAskedFields(input.issueProgressState.deepQualification.fields, input.issueProgressState.deepQualification.nextAskFields)
    }
  };

  const fallbackSay = buildDeterministicDeepQualificationAsk({issueProgressState: input.issueProgressState});
  const missingFields = input.issueProgressState.deepQualification.nextAskFields
    .map((key) => input.issueProgressState.deepQualification.fields.find((field) => field.key === key))
    .filter((field): field is IssueProgressState["deepQualification"]["fields"][number] => Boolean(field));

  const {messages} = buildIssueDeepQualificationAskPrompt({
    currentUserMessage: input.currentUserMessage,
    previousConversationTurn: input.previousConversationTurn,
    missingFields,
    mode: input.issueProgressState.deepQualification.mode
  });

  try {
    const result = await callLLM(messages, {
      stage: "issue_deep_qualification_ask_planner",
      preset: "standard",
      temperature: 0.2,
      maxTokens: 350,
      responseFormat: issueDeepQualificationAskPlannerResponseFormat
    });

    if (!result.success || !result.content) {
      return {nextIssueProgressState, say: fallbackSay};
    }

    const parsed = parseLLMResponse(result.content);
    const validated = validateIssueDeepQualificationAskPlannerOutput(parsed);

    return {
      nextIssueProgressState,
      say: validated?.say ?? fallbackSay
    };
  } catch {
    return {nextIssueProgressState, say: fallbackSay};
  }
}

function markAskedFields(fields: IssueProgressState["deepQualification"]["fields"], nextAskFields: string[]): IssueProgressState["deepQualification"]["fields"] {
  const askSet = new Set(nextAskFields);

  return fields.map((field) => {
    if (!askSet.has(field.key) || field.status === "obtained" || field.status === "user_declared_unavailable") return field;
    const askedCount = field.askedCount + 1;
    return {...field, askedCount, status: askedCount >= 2 ? "asked_again" : "asked_once"};
  });
}

export {planIssueDeepQualificationAsk};
