import {buildTopicQualification} from "./buildTopicQualification--oneShotStep";
import {isTopicQualified} from "./isTopicQualified--blockingStep";
import {planIssueDeepQualificationAsk} from "./asking-planner/planIssueDeepQualificationAsk";

import type {LiveMemoryTopicOptimized} from "../../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";

type DeepQualification = LiveMemoryTopicOptimized["sourceTopicManager"]["deepQualification"];
type CaseDetailExtracted = LiveMemoryTopicOptimized["sourceAnalyzeSupportText"]["caseDetailsExtracted"][number];
type RetrieveKnowledge = LiveMemoryTopicOptimized["sourceTopicManager"]["retrieveKnowledge"];

export type RunDeepQualificationInput = {
  supportDomain: string | null;
  previousTopic: LiveMemoryTopicOptimized | null;
  currentCaseDetailsExtracted: CaseDetailExtracted[];
  retrieveKnowledge: RetrieveKnowledge | null;
  currentUserMessage: {content: string; channel?: string};
  previousConversationTurn: {
    previousUserMessage: string | null;
    previousBotMessage: string | null;
  };
};

export type RunDeepQualificationOutput = {
  say: string | null;
  deepQualification: DeepQualification;
};

async function runDeepQualification(input: RunDeepQualificationInput): Promise<RunDeepQualificationOutput> {
  const knownCaseDetailsExtracted = [
    ...(input.previousTopic?.sourceAnalyzeSupportText.caseDetailsExtracted ?? []),
    ...input.currentCaseDetailsExtracted
  ];

  const previousDeepQualification = input.previousTopic?.sourceTopicManager.deepQualification ?? null;
  const baseDeepQualification = previousDeepQualification?.isBuilt === true
    ? previousDeepQualification
    : buildInitialDeepQualification({
      supportDomain: input.supportDomain,
      knownCaseDetailsExtracted
    });

  const {deepQualification} = isTopicQualified({
    deepQualification: baseDeepQualification,
    caseDetailsExtracted: knownCaseDetailsExtracted
  });

  if (deepQualification.isCompleted) {
    return {say: null, deepQualification};
  }

  const askPlan = await planIssueDeepQualificationAsk({
    currentUserMessage: input.currentUserMessage,
    previousConversationTurn: input.previousConversationTurn,
    deepQualification,
    userFacingInformation: input.retrieveKnowledge?.segmentationKnowledge.userFacingInformation ?? null
  });

  return {
    say: askPlan.say,
    deepQualification
  };
}

function buildInitialDeepQualification(input: {
  supportDomain: string | null;
  knownCaseDetailsExtracted: CaseDetailExtracted[];
}): DeepQualification {
  const builtQualification = buildTopicQualification({
    supportDomain: input.supportDomain,
    knownCaseDetailsExtracted: input.knownCaseDetailsExtracted
  });

  const caseDetailsToAskBecauseOfDeepQualification = builtQualification.caseDetailsToAskBecauseOfDeepQualification;
  const isCompleted = caseDetailsToAskBecauseOfDeepQualification.every((caseDetailToAsk) => {
    return caseDetailToAsk.status !== "asking";
  });

  return {
    isBuilt: true,
    isCompleted,
    caseDetailsToAskBecauseOfDeepQualification
  };
}

export {runDeepQualification};
