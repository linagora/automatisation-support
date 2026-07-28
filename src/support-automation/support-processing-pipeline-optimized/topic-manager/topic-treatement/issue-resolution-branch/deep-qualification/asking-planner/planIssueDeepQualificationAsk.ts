import {buildDeterministicDeepQualificationAsk} from "./buildIssueDeepQualificationAskPrompt";

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
  supportDomain: string | null;
};

export type PlanIssueDeepQualificationAskOutput = {
  say: string;
};

async function planIssueDeepQualificationAsk(input: PlanIssueDeepQualificationAskInput): Promise<PlanIssueDeepQualificationAskOutput> {
  const fieldsToAsk = selectFieldsToAsk(input.deepQualification);

  return {
    say: buildDeterministicDeepQualificationAsk({
      fieldsToAsk,
      userFacingInformation: input.userFacingInformation,
      supportDomain: input.supportDomain
    })
  };
}

function selectFieldsToAsk(deepQualification: DeepQualification): FieldToAsk[] {
  return deepQualification.caseDetailsToAskBecauseOfDeepQualification.filter((field): field is FieldToAsk => {
    return field.status === "asking";
  });
}

export {planIssueDeepQualificationAsk};