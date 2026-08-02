import {runBuildActionForUser} from "./build-action-for-user/runBuildActionForUser--oneShotStep";
import {runBuildActionForSupport} from "./build-action-for-support/runBuildActionForSupport--oneShotStep";
import {runBuildCaseDetailsForSolution} from "./build-case-details-for-solution/runBuildCaseDetailsForSolution--oneShotStep";
import {isSolutionCompleted} from "./isSolutionCompleted--blockingStep";
import {planIssueSolutionAsk} from "./asking-planner/planIssueSolutionAsk";

import type {
  LiveMemoryIssueSolution,
  LiveMemoryTopicOptimized
} from "../../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";
import type {SegmentedKnowledgeBySource} from "../retrieve-knowledge/segmentation-knowledge/runSegmentationKnowledge--oneShotStep";

type Solution = LiveMemoryIssueSolution;
type SourceTopicManager = LiveMemoryTopicOptimized["sourceTopicManager"];
type CaseDetailExtracted = LiveMemoryTopicOptimized["sourceAnalyzeSupportText"]["caseDetailsExtracted"][number];
type AttemptedActionExtracted = LiveMemoryTopicOptimized["sourceAnalyzeSupportText"]["attemptedActionsExtracted"][number];

export type RunSolutionInput = {
  previousTopic: LiveMemoryTopicOptimized | null;
  segmentedKnowledge: SegmentedKnowledgeBySource[] | null;
  summaryTopic: string | null;
  sourceTopicManager: SourceTopicManager;
  currentCaseDetailsExtracted: CaseDetailExtracted[];
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
  let solution =
    input.previousTopic?.sourceTopicManager.workflows.issueResolution.solution ??
    buildEmptySolution();

  const userFacingKnowledgeText = buildUserFacingKnowledgeText(input.segmentedKnowledge);
  const supportFacingKnowledgeText = buildSupportFacingKnowledgeText(input.segmentedKnowledge);

  if (userFacingKnowledgeText === null && supportFacingKnowledgeText === null) {
    return {
      say: null,
      solution: {
        ...solution,
        isActionForUserBuilt: true,
        isActionForSupportBuilt: true,
        isCaseDetailsForSolutionBuilt: true,
        isCompleted: true,
        attemptedActionsToAskBecauseOfSolutionFound: [],
        caseDetailsToAskBecauseOfSolutionFound: [],
        actionToTakeForSupport: null
      }
    };
  }

  if (!solution.isActionForUserBuilt) {
    const actionForUser = await runBuildActionForUser({
      summaryTopic: input.summaryTopic,
      userFacingKnowledgeText
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
      supportFacingKnowledgeText
    });

    solution = {
      ...solution,
      isActionForSupportBuilt: true,
      actionToTakeForSupport: actionForSupport.actionToTakeForSupport
    };
  }

  if (!solution.isCaseDetailsForSolutionBuilt) {
    const knownCaseDetailsExtracted = buildKnownCaseDetailsExtracted(input);
    const caseDetailsForSolution = await runBuildCaseDetailsForSolution({
      summaryTopic: input.summaryTopic,
      userFacingKnowledgeText,
      supportFacingKnowledgeText,
      knownCaseDetailsExtracted,
      alreadyRequestedCaseDetailKeys: buildAlreadyRequestedCaseDetailKeys({
        sourceTopicManager: input.sourceTopicManager,
        solution
      }),
      alreadyRequestedCaseDetailQuestions: buildAlreadyRequestedCaseDetailQuestions({
        sourceTopicManager: input.sourceTopicManager,
        solution
      })
    });

    solution = {
      ...solution,
      isCaseDetailsForSolutionBuilt: true,
      caseDetailsToAskBecauseOfSolutionFound: caseDetailsForSolution.caseDetailsToAskBecauseOfSolutionFound
    };
  }

  const knownCaseDetailsExtracted = buildKnownCaseDetailsExtracted(input);
  const knownAttemptedActionsExtracted = [
    ...(input.previousTopic?.sourceAnalyzeSupportText.attemptedActionsExtracted ?? []),
    ...input.currentAttemptedActionsExtracted
  ];

  const completedCheck = isSolutionCompleted({
    solution,
    caseDetailsExtracted: knownCaseDetailsExtracted,
    attemptedActionsExtracted: knownAttemptedActionsExtracted
  });

  solution = completedCheck.solution;

  if (solution.isCompleted) {
    return {say: null, solution};
  }

  const askPlan = await planIssueSolutionAsk({
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
    isCaseDetailsForSolutionBuilt: false,
    isCompleted: false,
    attemptedActionsToAskBecauseOfSolutionFound: [],
    caseDetailsToAskBecauseOfSolutionFound: [],
    actionToTakeForSupport: null
  };
}

function buildKnownCaseDetailsExtracted(input: RunSolutionInput): CaseDetailExtracted[] {
  return [
    ...(input.previousTopic?.sourceAnalyzeSupportText.caseDetailsExtracted ?? []),
    ...input.currentCaseDetailsExtracted
  ];
}

function buildAlreadyRequestedCaseDetailKeys(input: {
  sourceTopicManager: SourceTopicManager;
  solution: Solution;
}): string[] {
  return [
    ...input.sourceTopicManager.workflows.issueResolution.basicQualification.caseDetailsToAskBecauseOfBasicQualification,
    ...input.sourceTopicManager.workflows.issueResolution.deepQualification.caseDetailsToAskBecauseOfDeepQualification,
    ...input.sourceTopicManager.workflows.issueResolution.solution.caseDetailsToAskBecauseOfSolutionFound,
    ...input.solution.caseDetailsToAskBecauseOfSolutionFound
  ]
    .map((caseDetail) => caseDetail.key)
    .filter((key): key is string => typeof key === "string" && key.trim() !== "");
}

function buildAlreadyRequestedCaseDetailQuestions(input: {
  sourceTopicManager: SourceTopicManager;
  solution: Solution;
}): string[] {
  return [
    ...input.sourceTopicManager.workflows.issueResolution.solution.caseDetailsToAskBecauseOfSolutionFound,
    ...input.solution.caseDetailsToAskBecauseOfSolutionFound
  ]
    .map((caseDetail) => caseDetail.question)
    .filter((question): question is string => typeof question === "string" && question.trim() !== "");
}

function buildUserFacingKnowledgeText(
  segmentedKnowledge: SegmentedKnowledgeBySource[] | null | undefined
): string | null {
  const pieces = segmentedKnowledge?.flatMap((source) => {
    return source.userFacingKnowledge.map((piece) => {
      return formatKnowledgePiece(
        source.rawKnowledgeId,
        piece.text,
        piece.sourceHint,
        piece.sourceSpan
      );
    });
  }) ?? [];

  return joinKnowledgePieces(pieces);
}

function buildSupportFacingKnowledgeText(
  segmentedKnowledge: SegmentedKnowledgeBySource[] | null | undefined
): string | null {
  const pieces = segmentedKnowledge?.flatMap((source) => {
    return source.supportFacingKnowledge.map((piece) => {
      return formatKnowledgePiece(
        source.rawKnowledgeId,
        piece.text,
        piece.sourceHint,
        piece.sourceSpan
      );
    });
  }) ?? [];

  return joinKnowledgePieces(pieces);
}

function formatKnowledgePiece(
  rawKnowledgeId: string,
  text: string,
  sourceHint: string | null,
  sourceSpan: string | null
): string {
  const sourceParts = [
    rawKnowledgeId,
    sourceHint,
    sourceSpan
  ].filter((value): value is string => {
    return typeof value === "string" && value.trim() !== "";
  });

  return sourceParts.length > 0
    ? `[${sourceParts.join(" | ")}] ${text}`
    : text;
}

function joinKnowledgePieces(pieces: string[]): string | null {
  const cleaned = pieces
    .map((piece) => piece.trim())
    .filter((piece) => piece !== "");

  if (cleaned.length === 0) {
    return null;
  }

  return cleaned.join("\n\n");
}

export {
  buildEmptySolution,
  runSolution
};
