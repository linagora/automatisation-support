import {runBuildActionForUser} from "./build-action-for-user/runBuildActionForUser--oneShotStep";
import {runBuildActionForSupport} from "./build-action-for-support/runBuildActionForSupport--oneShotStep";
import {isSolutionCompleted} from "./isSolutionCompleted--blockingStep";
import {planIssueSolutionAsk} from "./asking-planner/planIssueSolutionAsk";

import type {LiveMemoryTopicOptimized} from "../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";

type Solution = LiveMemoryTopicOptimized["sourceTopicManager"]["solution"];
type RetrieveKnowledge = LiveMemoryTopicOptimized["sourceTopicManager"]["retrieveKnowledge"];
type AttemptedActionExtracted = LiveMemoryTopicOptimized["sourceAnalyzeSupportText"]["attemptedActionsExtracted"][number];

export type RunSolutionInput = {
  previousTopic: LiveMemoryTopicOptimized | null;
  retrieveKnowledge: RetrieveKnowledge | null;
  summaryTopic: string | null;
  currentAttemptedActionsExtracted: AttemptedActionExtracted[];
  currentUserMessage: {content: string; channel?: string};
  previousConversationTurn: {
    previousUserMessage: string | null;
    previousBotMessage: string | null;
  };
};

export type RunSolutionOutput = {
  say: string | null;
  solution: Solution;
};

async function runSolution(input: RunSolutionInput): Promise<RunSolutionOutput> {
  let solution = input.previousTopic?.sourceTopicManager.solution ?? buildEmptySolution();

  const retrieveKnowledge = input.retrieveKnowledge ?? input.previousTopic?.sourceTopicManager.retrieveKnowledge ?? null;
  const userFacingInformation = retrieveKnowledge?.segmentationKnowledge.userFacingInformation ?? null;
  const supportFacingInformation = retrieveKnowledge?.segmentationKnowledge.supportFacingInformation ?? null;

  if (!solution.isActionForUserBuilt) {
    const actionForUser = await runBuildActionForUser({
      summaryTopic: input.summaryTopic,
      userFacingInformation,
      currentUserMessage: input.currentUserMessage
    });

    solution = {
      ...solution,
      isActionForUserBuilt: true,
      attemptedActionsToAskBecauseOfSolutionFound: actionForUser.attemptedActionsToAskBecauseOfSolutionFound
    };
  }

  if (!solution.isActionForSupportBuilt) {
    const actionForSupport = await runBuildActionForSupport({
      summaryTopic: input.summaryTopic,
      supportFacingInformation,
      currentUserMessage: input.currentUserMessage
    });

    solution = {
      ...solution,
      isActionForSupportBuilt: true,
      actionToTakeForSupport: actionForSupport.actionToTakeForSupport
    };
  }

  const knownAttemptedActionsExtracted = [
    ...(input.previousTopic?.sourceAnalyzeSupportText.attemptedActionsExtracted ?? []),
    ...input.currentAttemptedActionsExtracted
  ];

  const completedCheck = isSolutionCompleted({
    solution,
    attemptedActionsExtracted: knownAttemptedActionsExtracted
  });

  solution = completedCheck.solution;

  if (solution.isCompleted) {
    return {say: null, solution};
  }

  const askPlan = await planIssueSolutionAsk({
    currentUserMessage: input.currentUserMessage,
    previousConversationTurn: input.previousConversationTurn,
    solution
  });

  return {
    say: askPlan.say,
    solution
  };
}

function buildEmptySolution(): Solution {
  return {
    isActionForUserBuilt: false,
    isActionForSupportBuilt: false,
    isCompleted: false,
    attemptedActionsToAskBecauseOfSolutionFound: [],
    actionToTakeForSupport: null
  };
}

export {
  buildEmptySolution,
  runSolution
};
