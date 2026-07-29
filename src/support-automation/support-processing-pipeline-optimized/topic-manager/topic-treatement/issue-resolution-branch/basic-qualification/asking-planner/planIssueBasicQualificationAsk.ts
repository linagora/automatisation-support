import {callLLM} from "../../../../../../../infrastructure/llm/llm-client";
import {parseLLMResponse} from "../../../../../../../infrastructure/llm/parseLLMResponse";
import {buildDeterministicBasicQualificationAsk, buildIssueBasicQualificationAskPrompt} from "./buildIssueBasicQualificationAskPrompt";
import {issueQualificationAskPlannerResponseFormat} from "./responseFormat";
import {validateIssueBasicQualificationAskPlannerOutput} from "./validateIssueBasicQualificationAskPlannerOutput";

import type {LiveMemoryTopicOptimized} from "../../../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";

type BasicQualification = LiveMemoryTopicOptimized["sourceTopicManager"]["basicQualification"];
type FieldToAsk = BasicQualification["caseDetailsToAskBecauseOfBasicQualification"][number] & {status: "asking"};

export type PlanIssueBasicQualificationAskInput = {
  summaryTopic: string | null;
  basicQualification: BasicQualification;
};

export type PlanIssueBasicQualificationAskOutput = {
  say: string;
};

async function planIssueBasicQualificationAsk(input: PlanIssueBasicQualificationAskInput): Promise<PlanIssueBasicQualificationAskOutput> {
  const fieldsToAsk = selectFieldsToAsk(input.basicQualification);
  const fallbackSay = buildDeterministicBasicQualificationAsk({
    summaryTopic: input.summaryTopic,
    fieldsToAsk
  });

  const {messages} = buildIssueBasicQualificationAskPrompt({
    summaryTopic: input.summaryTopic,
    fieldsToAsk
  });

  try {
    const result = await callLLM(messages, {
      stage: "issue_basic_qualification_ask_planner",
      preset: "standard",
      temperature: 0.2,
      maxTokens: 450,
      responseFormat: issueQualificationAskPlannerResponseFormat
    });

    if (!result.success || !result.content) {
      return {say: fallbackSay};
    }

    const parsed = parseLLMResponse(result.content);
    const validated = validateIssueBasicQualificationAskPlannerOutput(parsed);

    return {say: validated?.say ?? fallbackSay};
  } catch {
    return {say: fallbackSay};
  }
}

function selectFieldsToAsk(basicQualification: BasicQualification): FieldToAsk[] {
  return basicQualification.caseDetailsToAskBecauseOfBasicQualification
    .filter((field): field is FieldToAsk => field.status === "asking");
}

export {planIssueBasicQualificationAsk};
