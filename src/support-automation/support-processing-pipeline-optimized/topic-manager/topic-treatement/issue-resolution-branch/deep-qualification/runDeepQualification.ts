import {buildDeepQualificationAsk} from "./buildDeepQualificationAsk";
import {
  buildInitialDeepQualification,
  updateDeepQualificationWithExtractedDetails
} from "./deepQualificationState";

import type {
  LiveMemoryIssueDeepQualification,
  LiveMemoryTopicOptimized
} from "../../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";
import type {SegmentedKnowledgeBySource} from "../retrieve-knowledge/segmentation-knowledge/runSegmentationKnowledge--oneShotStep";

type DeepQualification = LiveMemoryIssueDeepQualification;
type CaseDetailExtracted = LiveMemoryTopicOptimized["sourceAnalyzeSupportText"]["caseDetailsExtracted"][number];

export type RunDeepQualificationInput = {
  supportDomain: string | null;
  previousTopic: LiveMemoryTopicOptimized | null;
  currentCaseDetailsExtracted: CaseDetailExtracted[];
  segmentedKnowledge: SegmentedKnowledgeBySource[] | null;
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

  const previousDeepQualification =
    input.previousTopic?.sourceTopicManager.workflows.issueResolution.deepQualification ?? null;

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
      userFacingKnowledgeText: buildUserFacingKnowledgeText(input.segmentedKnowledge),
      supportDomain: input.supportDomain
    }),
    deepQualification
  };
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

  const cleaned = pieces
    .map((piece) => piece.trim())
    .filter((piece) => piece !== "");

  if (cleaned.length === 0) {
    return null;
  }

  return cleaned.join("\n\n");
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

export {runDeepQualification};
