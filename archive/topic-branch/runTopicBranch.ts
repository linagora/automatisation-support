import {runAssessSupportNeed, type AssessSupportNeedInput, type AssessSupportNeedOutput} from "./assess-support-need-optimized/runAssessSupportNeed";
import {assessTopicReadiness, type TopicReadinessAssessment} from "./assess-topic-readiness-optimized/assessTopicReadiness";
import {deriveSupportRouting, type DerivedSupportRouting} from "./derive-support-routing-optimized/deriveSupportRouting";
import {runQualificationOrienter, type QualificationOrienterOutput} from "./qualification-orienter-optimized/runQualificationOrienter";
import {runSearchSimilarity, type SearchSimilarityOutput} from "./search-similarity-optimized/runSearchSimilarity";
import {runSynthesizeRag, type SynthesizeRagOutput} from "./synthesize-rag-optimized/runSynthesizeRag";
import {runTopicPlanner, type TopicPlannerOutput} from "./topic-planner-optimized/runTopicPlanner";

import type {AnalyzeSupportTextUnderstanding} from "../analyze-support-text-optimized/runAnalyzeSupportText";
import type {TopicUpdatePlan as ProposeTopicUpdatePlan} from "../propose-topic-updates-optimized/runProposeTopicUpdates";
import type {SupportNeedAssessment} from "./assess-support-need-optimized/validateAssessSupportNeedOutput";

type TopicUpdatePlan = ProposeTopicUpdatePlan;

type TopicIdentity = {
  topicId: number | null;
  title: string | null;
  supportDomain: string | null;
  summary: string;
};

type TopicBranchInput = {
  input: {
    liveMemory: unknown;
  };
  topicUpdatePlan: TopicUpdatePlan;
  supportUnderstandings: AnalyzeSupportTextUnderstanding[];
  recentInteractionContext: AssessSupportNeedInput["recentInteractionContext"];
};

type TopicBranchOutput = {
  assessSupportNeedOutput: AssessSupportNeedOutput;
  assessTopicReadinessOutput: TopicReadinessAssessment | null;
  deriveSupportRoutingOutput: DerivedSupportRouting | null;
  qualificationOrienterOutput: QualificationOrienterOutput | null;
  searchSimilarityOutput: SearchSimilarityOutput | null;
  synthesizeRagOutput: SynthesizeRagOutput | null;
  topicPlannerOutput: TopicPlannerOutput | null;
};

type TopicBranchProcessedResult = {
  status: "processed";
  fallbackReason: null;
  topicPlannerOutput: TopicPlannerOutput;
  topicBranchOutput: TopicBranchOutput;
};

type TopicBranchFallbackResult = {
  status: "fallback";
  fallbackReason: {source: "brick"; brickOutput: unknown};
  topicPlannerOutput: null;
  topicBranchOutput: TopicBranchOutput;
};

type TopicBranchResult =
  | TopicBranchProcessedResult
  | TopicBranchFallbackResult;

async function runTopicBranch(params: TopicBranchInput): Promise<TopicBranchResult> {
  const previousLiveTopic = findPreviousLiveTopic(params.input.liveMemory, params.topicUpdatePlan.targetTopicId);
  const sourceUnderstandings = selectUnderstandings(params.supportUnderstandings, params.topicUpdatePlan.sourceUnderstandingIds);
  const topicIdentity = resolveTopicIdentity(params.topicUpdatePlan, previousLiveTopic, sourceUnderstandings);

  const assessSupportNeedOutput = await runAssessSupportNeed({
    topic: {
      title: topicIdentity.title,
      supportDomain: topicIdentity.supportDomain,
      summary: topicIdentity.summary,
      previousSupportNeedAssessment: readPreviousSupportNeedAssessment(previousLiveTopic),
      previousSupportKnowledgeSummary: readPreviousSupportKnowledgeSummary(previousLiveTopic),
      sourceUnderstandings
    },
    recentInteractionContext: params.recentInteractionContext
  });

  const topicBranchOutput: TopicBranchOutput = {
    assessSupportNeedOutput,
    assessTopicReadinessOutput: null,
    deriveSupportRoutingOutput: null,
    qualificationOrienterOutput: null,
    searchSimilarityOutput: null,
    synthesizeRagOutput: null,
    topicPlannerOutput: null
  };

  if (assessSupportNeedOutput.status === "fallback") return buildBranchFallback(assessSupportNeedOutput, topicBranchOutput);
  if (assessSupportNeedOutput.status !== "analyzed" || assessSupportNeedOutput.supportNeedAssessment === null) throw new Error("Unexpected assessSupportNeedOutput status");

  topicBranchOutput.assessTopicReadinessOutput = assessTopicReadiness({
    supportNeedAssessment: assessSupportNeedOutput.supportNeedAssessment,
    supportDomain: topicIdentity.supportDomain,
    sourceUnderstandings,
    previousSupportKnowledgeSummary: readPreviousSupportKnowledgeSummary(previousLiveTopic)
  });

  topicBranchOutput.deriveSupportRoutingOutput = deriveSupportRouting({
    supportNeedAssessment: assessSupportNeedOutput.supportNeedAssessment,
    topicReadinessAssessment: topicBranchOutput.assessTopicReadinessOutput,
    supportDomain: topicIdentity.supportDomain
  });

  if (topicBranchOutput.deriveSupportRoutingOutput.similarTopicSearchRouting.shouldSearch) {
    const qualificationOrienterPromise = runQualificationOrienter({
      topicUpdatePlan: params.topicUpdatePlan,
      topicIdentity,
      sourceUnderstandings,
      supportNeedAssessment: assessSupportNeedOutput.supportNeedAssessment,
      topicReadinessAssessment: topicBranchOutput.assessTopicReadinessOutput,
      routing: topicBranchOutput.deriveSupportRoutingOutput
    });

    const similarityAndSynthesisPromise = runSearchSimilarity({
      topicUpdatePlan: params.topicUpdatePlan,
      topicIdentity,
      sourceUnderstandings,
      liveMemory: params.input.liveMemory,
      routing: topicBranchOutput.deriveSupportRoutingOutput
    }).then(async (searchSimilarityOutput) => {
      if (searchSimilarityOutput.status === "fallback") return {status: "fallback" as const, fallbackReason: {source: "brick" as const, brickOutput: searchSimilarityOutput}, searchSimilarityOutput, synthesizeRagOutput: null};

      const synthesizeRagOutput = await runSynthesizeRag({
        topicUpdatePlan: params.topicUpdatePlan,
        topicIdentity,
        sourceUnderstandings,
        searchSimilarityOutput
      });

      if (synthesizeRagOutput.status === "fallback") return {status: "fallback" as const, fallbackReason: {source: "brick" as const, brickOutput: synthesizeRagOutput}, searchSimilarityOutput, synthesizeRagOutput};

      return {status: "processed" as const, searchSimilarityOutput, synthesizeRagOutput};
    });

    const [qualificationOrienterOutput, similarityAndSynthesisOutput] = await Promise.all([
      qualificationOrienterPromise,
      similarityAndSynthesisPromise
    ]);

    topicBranchOutput.qualificationOrienterOutput = qualificationOrienterOutput;
    topicBranchOutput.searchSimilarityOutput = similarityAndSynthesisOutput.searchSimilarityOutput;
    topicBranchOutput.synthesizeRagOutput = similarityAndSynthesisOutput.synthesizeRagOutput;

    if (qualificationOrienterOutput.status === "fallback") return buildBranchFallback(qualificationOrienterOutput, topicBranchOutput);
    if (similarityAndSynthesisOutput.status === "fallback") return {status: "fallback", fallbackReason: similarityAndSynthesisOutput.fallbackReason, topicPlannerOutput: null, topicBranchOutput};
  } else {
    topicBranchOutput.qualificationOrienterOutput = await runQualificationOrienter({
      topicUpdatePlan: params.topicUpdatePlan,
      topicIdentity,
      sourceUnderstandings,
      supportNeedAssessment: assessSupportNeedOutput.supportNeedAssessment,
      topicReadinessAssessment: topicBranchOutput.assessTopicReadinessOutput,
      routing: topicBranchOutput.deriveSupportRoutingOutput
    });

    if (topicBranchOutput.qualificationOrienterOutput.status === "fallback") return buildBranchFallback(topicBranchOutput.qualificationOrienterOutput, topicBranchOutput);
  }

  topicBranchOutput.topicPlannerOutput = await runTopicPlanner({
    topicUpdatePlan: params.topicUpdatePlan,
    topicIdentity,
    sourceUnderstandings,
    supportNeedOutput: assessSupportNeedOutput,
    readinessOutput: topicBranchOutput.assessTopicReadinessOutput,
    routingOutput: topicBranchOutput.deriveSupportRoutingOutput,
    qualificationOrienterOutput: topicBranchOutput.qualificationOrienterOutput,
    searchSimilarityOutput: topicBranchOutput.searchSimilarityOutput,
    synthesizeRagOutput: topicBranchOutput.synthesizeRagOutput
  });

  if (topicBranchOutput.topicPlannerOutput.status === "fallback") return buildBranchFallback(topicBranchOutput.topicPlannerOutput, topicBranchOutput);

  return {
    status: "processed",
    fallbackReason: null,
    topicPlannerOutput: topicBranchOutput.topicPlannerOutput,
    topicBranchOutput
  };
}

function buildBranchFallback(brickOutput: unknown, topicBranchOutput: TopicBranchOutput): TopicBranchFallbackResult {
  return {
    status: "fallback",
    fallbackReason: {source: "brick", brickOutput},
    topicPlannerOutput: null,
    topicBranchOutput
  };
}

function findPreviousLiveTopic(liveMemory: unknown, targetTopicId: number | null): unknown | null {
  if (targetTopicId === null) return null;
  const topics = readRecordArray(readRecord(liveMemory)?.topics);
  return topics.find((topic) => readRecord(topic)?.topicId === targetTopicId) ?? null;
}

function selectUnderstandings(
  supportUnderstandings: AnalyzeSupportTextUnderstanding[],
  sourceUnderstandingIds: string[]
): AnalyzeSupportTextUnderstanding[] {
  const selectedIds = new Set(sourceUnderstandingIds);
  return supportUnderstandings.filter((understanding) => selectedIds.has(understanding.understandingId));
}

function resolveTopicIdentity(
  topicUpdatePlan: TopicUpdatePlan,
  previousLiveTopic: unknown | null,
  sourceUnderstandings: AnalyzeSupportTextUnderstanding[]
): TopicIdentity {
  const previousTopic = readRecord(previousLiveTopic);

  return {
    topicId: topicUpdatePlan.targetTopicId,
    title: topicUpdatePlan.topicIdentity.title ?? readStringOrNull(previousTopic?.title),
    supportDomain: topicUpdatePlan.topicIdentity.supportDomain ?? readStringOrNull(previousTopic?.supportDomain),
    summary: topicUpdatePlan.topicIdentity.summary ?? readStringOrNull(previousTopic?.summary) ?? summarizeUnderstandings(sourceUnderstandings)
  };
}

function summarizeUnderstandings(sourceUnderstandings: AnalyzeSupportTextUnderstanding[]): string {
  const summaries = sourceUnderstandings.map((understanding) => understanding.summary).filter((summary) => summary.trim() !== "");
  return summaries.length > 0 ? summaries.join(" ") : "Support topic from the latest user message.";
}

function readPreviousSupportNeedAssessment(previousLiveTopic: unknown | null): SupportNeedAssessment | null {
  const assessment = readRecord(readRecord(previousLiveTopic)?.supportNeedAssessment);

  if (
    typeof assessment?.supportNeed === "string" &&
    (typeof assessment.unclearReason === "string" || assessment.unclearReason === null) &&
    typeof assessment.reason === "string"
  ) {
    return assessment as SupportNeedAssessment;
  }

  return null;
}

function readPreviousSupportKnowledgeSummary(previousLiveTopic: unknown | null): string | null {
  const topic = readRecord(previousLiveTopic);
  const supportKnowledgeSummary = readRecord(topic?.supportKnowledgeSummary);

  return readStringOrNull(topic?.previousSupportKnowledgeSummary)
    ?? readStringOrNull(supportKnowledgeSummary?.summary)
    ?? readStringOrNull(supportKnowledgeSummary?.supportFacing)
    ?? null;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function readRecordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => readRecord(item) !== null) : [];
}

function readStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

export {runTopicBranch};

export type {
  TopicBranchInput,
  TopicBranchOutput,
  TopicBranchResult,
  TopicIdentity,
  TopicUpdatePlan
};
