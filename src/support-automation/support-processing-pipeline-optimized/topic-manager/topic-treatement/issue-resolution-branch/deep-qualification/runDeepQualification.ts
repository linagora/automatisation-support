import {buildDeepQualificationAsk} from "./buildDeepQualificationAsk";
import {
  buildInitialDeepQualification,
  updateDeepQualificationWithExtractedDetails
} from "./deepQualificationState";

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

  const deepQualification = updateDeepQualificationWithExtractedDetails({
    deepQualification: baseDeepQualification,
    caseDetailsExtracted: knownCaseDetailsExtracted
  });

  if (deepQualification.isCompleted) {
    return {
      say: null,
      deepQualification
    };
  }

  return {
    say: buildDeepQualificationAsk({
      deepQualification,
      userFacingInformation: input.retrieveKnowledge?.segmentationKnowledge.userFacingInformation ?? null,
      supportDomain: input.supportDomain
    }),
    deepQualification
  };
}

export {runDeepQualification};