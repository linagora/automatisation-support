import {buildTopicQualification} from "./buildTopicQualification--oneShotStep";
import {isTopicQualified} from "./isTopicQualified--blockingStep";
import {planIssueBasicQualificationAsk} from "./asking-planner/planIssueBasicQualificationAsk";

import type {LiveMemoryTopicOptimized} from "../../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";

type BasicQualification = LiveMemoryTopicOptimized["sourceTopicManager"]["basicQualification"];
type CaseDetailExtracted = LiveMemoryTopicOptimized["sourceAnalyzeSupportText"]["caseDetailsExtracted"][number];

export type RunBasicQualificationInput = {
  supportDomain: string | null;
  previousTopic: LiveMemoryTopicOptimized | null;
  currentCaseDetailsExtracted: CaseDetailExtracted[];
  currentUserMessage: {content: string; channel?: string};
  previousConversationTurn: {
    previousUserMessage: string | null;
    previousBotMessage: string | null;
  };
};

export type RunBasicQualificationOutput = {
  say: string | null;
  basicQualification: BasicQualification;
};

async function runBasicQualification(input: RunBasicQualificationInput): Promise<RunBasicQualificationOutput> {
  const knownCaseDetailsExtracted = [
    ...(input.previousTopic?.sourceAnalyzeSupportText.caseDetailsExtracted ?? []),
    ...input.currentCaseDetailsExtracted
  ];

  const previousBasicQualification = input.previousTopic?.sourceTopicManager.basicQualification ?? null;
  const baseBasicQualification = previousBasicQualification?.isBuilt === true
    ? previousBasicQualification
    : buildInitialBasicQualification({
      supportDomain: input.supportDomain,
      knownCaseDetailsExtracted
    });

  const {basicQualification} = isTopicQualified({
    basicQualification: baseBasicQualification,
    caseDetailsExtracted: knownCaseDetailsExtracted
  });

  if (basicQualification.isCompleted) {
    return {say: null, basicQualification};
  }

  const askPlan = await planIssueBasicQualificationAsk({
    currentUserMessage: input.currentUserMessage,
    previousConversationTurn: input.previousConversationTurn,
    basicQualification
  });

  return {
    say: askPlan.say,
    basicQualification
  };
}

function buildInitialBasicQualification(input: {
  supportDomain: string | null;
  knownCaseDetailsExtracted: CaseDetailExtracted[];
}): BasicQualification {
  const builtQualification = buildTopicQualification({
    supportDomain: input.supportDomain,
    knownCaseDetailsExtracted: input.knownCaseDetailsExtracted
  });

  const caseDetailsToAskBecauseOfBasicQualification = builtQualification.caseDetailsToAskBecauseOfBasicQualification;
  const isCompleted = caseDetailsToAskBecauseOfBasicQualification.every((caseDetailToAsk) => {
    return caseDetailToAsk.status !== "asking";
  });

  return {
    isBuilt: true,
    isCompleted,
    caseDetailsToAskBecauseOfBasicQualification
  };
}

export {runBasicQualification};
