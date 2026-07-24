import {callLLM} from "../../../../../../../infrastructure/llm/llm-client";
import {parseLLMResponse} from "../../../../../../../infrastructure/llm/parseLLMResponse";
import {buildDeterministicDeepQualificationAsk, buildIssueDeepQualificationAskPrompt} from "./buildIssueDeepQualificationAskPrompt";
import {issueDeepQualificationAskPlannerResponseFormat} from "./responseFormat";
import {validateIssueDeepQualificationAskPlannerOutput} from "./validateIssueDeepQualificationAskPlannerOutput";

import type {LiveMemoryTopicOptimized} from "../../../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";

type DeepQualification = LiveMemoryTopicOptimized["sourceTopicManager"]["deepQualification"];
type FieldToAsk = DeepQualification["caseDetailsToAskBecauseOfDeepQualification"][number] & {status: "asking"};

export type PlanIssueDeepQualificationAskInput = {
  currentUserMessage: {content: string; channel?: string};
  previousConversationTurn: {
    previousUserMessage: string | null;
    previousBotMessage: string | null;
  };
  deepQualification: DeepQualification;
  userFacingInformation: string | null;
};

export type PlanIssueDeepQualificationAskOutput = {
  say: string;
};

async function planIssueDeepQualificationAsk(input: PlanIssueDeepQualificationAskInput): Promise<PlanIssueDeepQualificationAskOutput> {
  const fieldsToAsk = selectFieldsToAsk(input.deepQualification);
  const fallbackSay = buildDeterministicDeepQualificationAsk({
    fieldsToAsk,
    userFacingInformation: input.userFacingInformation
  });

  const {messages} = buildIssueDeepQualificationAskPrompt({
    currentUserMessage: input.currentUserMessage,
    previousConversationTurn: input.previousConversationTurn,
    fieldsToAsk,
    userFacingInformation: input.userFacingInformation
  });

  try {
    const result = await callLLM(messages, {
      stage: "issue_deep_qualification_ask_planner",
      preset: "standard",
      temperature: 0.2,
      maxTokens: 450,
      responseFormat: issueDeepQualificationAskPlannerResponseFormat
    });

    if (!result.success || !result.content) {
      return {say: fallbackSay};
    }

    const parsed = parseLLMResponse(result.content);
    const validated = validateIssueDeepQualificationAskPlannerOutput(parsed);

    return {say: validated?.say ?? fallbackSay};
  } catch {
    return {say: fallbackSay};
  }
}

function selectFieldsToAsk(deepQualification: DeepQualification): FieldToAsk[] {
  return deepQualification.caseDetailsToAskBecauseOfDeepQualification.filter((field): field is FieldToAsk => {
    return field.status === "asking";
  });
}

export {planIssueDeepQualificationAsk};
