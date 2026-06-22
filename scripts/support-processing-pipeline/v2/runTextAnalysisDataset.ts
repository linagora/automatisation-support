/**
 * Manual runner for the implemented V2 text analysis steps.
 *
 * Usage:
 *   npm run support:v2:text-dataset -- --list
 *   npm run support:v2:text-dataset
 *   npm run support:v2:text-dataset -- --all
 *   npm run support:v2:text-dataset -- --case mixed
 *   npm run support:v2:text-dataset -- --case mixed --until surface
 *   npm run support:v2:text-dataset -- --case mixed --until topics
 *   npm run support:v2:text-dataset -- --case mixed --until knowledge
 *   npm run support:v2:text-dataset -- --case mixed --until response-plan
 *   npm run support:v2:text-dataset -- --case mixed --until render
 *   npm run support:v2:text-dataset -- --case mixed --until topics --full-input
 *   npm run support:v2:text-dataset -- --case mixed --until topics --debug
 */

import "dotenv/config";

import {
  analyzeSupportText,
  selectSupportSegments
} from "../../../src/support-processing-pipeline/v2/analyze-support-text/analyzeSupportText";
import {
  buildAnalyzeSupportTextPrompt
} from "../../../src/support-processing-pipeline/v2/analyze-support-text/buildAnalyzeSupportTextPrompt";
import {
  formatSupportTextAnalysisOutputWithDebug
} from "../../../src/support-processing-pipeline/v2/analyze-support-text/formatSupportTextAnalysisOutput";
import {
  requestSupportTextAnalysis
} from "../../../src/support-processing-pipeline/v2/analyze-support-text/requestSupportTextAnalysis";
import {
  analyzeTextSurface
} from "../../../src/support-processing-pipeline/v2/analyze-text-surface/analyzeTextSurface";
import {
  buildFallbackTextSurfaceAnalysis
} from "../../../src/support-processing-pipeline/v2/analyze-text-surface/analyzeTextSurface";
import {
  buildAnalyzeTextSurfacePrompt
} from "../../../src/support-processing-pipeline/v2/analyze-text-surface/buildAnalyzeTextSurfacePrompt";
import {
  formatTextSurfaceAnalysisOutput
} from "../../../src/support-processing-pipeline/v2/analyze-text-surface/formatTextSurfaceAnalysisOutput";
import {
  requestTextSurfaceAnalysis
} from "../../../src/support-processing-pipeline/v2/analyze-text-surface/requestTextSurfaceAnalysis";
import {
  buildStandardResponseFragments
} from "../../../src/support-processing-pipeline/v2/build-standard-response-fragments/buildStandardResponseFragments";
import {
  detectSuspiciousPromptPatterns
} from "../../../src/support-processing-pipeline/v2/detect-suspicious-prompt-patterns/detectSuspiciousPromptPatterns";
import {
  planTurnAnalysis
} from "../../../src/support-processing-pipeline/v2/plan-turn-analysis/planTurnAnalysis";
import {
  planKnowledgeEnrichment
} from "../../../src/support-processing-pipeline/v2/plan-knowledge-enrichment/planKnowledgeEnrichment";
import {
  planSupportResponse
} from "../../../src/support-processing-pipeline/v2/plan-support-response/planSupportResponse";
import {
  selectCatalogKnowledgeForTopic
} from "../../../src/support-processing-pipeline/v2/select-catalog-knowledge-for-topic/selectCatalogKnowledgeForTopic";
import {
  renderSupportResponse
} from "../../../src/support-processing-pipeline/v2/response-renderer/renderSupportResponse";
import {
  assignTopicResponsePlanIds,
  buildTopicResponsePlanDebug
} from "../../../src/support-processing-pipeline/v2/responsePlanIds";
import {
  proposeTopicUpdates
} from "../../../src/support-processing-pipeline/v2/propose-topic-updates/proposeTopicUpdates";
import {
  textAnalysisDataset,
  type TextAnalysisDatasetCase
} from "./textAnalysisDataset";

import type {
  KnowledgeChunk,
  KnowledgeEnrichmentPlan,
  RetrievedKnowledgeSynthesis,
  SelectedCatalogKnowledgeForTopic,
  StandardResponseFragment,
  SupportResponseCue,
  TextSurfaceAnalysis,
  TextUnderstanding,
  TopicEvidence
} from "../../../src/support-processing-pipeline/v2/typesSupportProcessingPipelineV2.types";
import type {
  TopicUpdateProposal
} from "../../../src/support-processing-pipeline/v2/propose-topic-updates/typesProposeTopicUpdates.types";
import type {
  SupportResponsePlan
} from "../../../src/support-processing-pipeline/v2/plan-support-response/typesPlanSupportResponse.types";
import type {
  RenderedSupportResponse
} from "../../../src/support-processing-pipeline/v2/response-renderer/typesRenderSupportResponse.types";

const DATASET_STOP_STAGES = [
  "security",
  "plan",
  "surface",
  "standard",
  "support",
  "topics",
  "knowledge",
  "response-plan",
  "render",
  "all"
] as const;

type DatasetStopStage = (typeof DATASET_STOP_STAGES)[number];

const DEFAULT_STOP_STAGE: DatasetStopStage = "topics";

type CaseRunOutput = {
  promptSecuritySignals: unknown;
  turnAnalysisPlan: unknown | "SKIPPED";
  textSurfaceAnalysis: TextSurfaceAnalysis | "SKIPPED";
  standardResponseFragments: StandardResponseFragment[] | "SKIPPED";
  textUnderstandings: TextUnderstanding[] | "SKIPPED";
  supportResponseCues: SupportResponseCue[] | "SKIPPED";
  topicUpdateProposals: TopicUpdateProposal[] | "SKIPPED";
  knowledgeEnrichmentPlan: KnowledgeEnrichmentPlan | "SKIPPED";
  retrievedSupportKnowledge: KnowledgeChunk[] | "SKIPPED";
  synthesizedRetrievedKnowledge: RetrievedKnowledgeSynthesis | null | "SKIPPED";
  responsePlan: SupportResponsePlan | "SKIPPED";
  topicResponsePlans?: SupportResponsePlan[] | "SKIPPED";
  renderedSupportResponse: RenderedSupportResponse | "SKIPPED";
  debug?: {
    textSurface?: TextSurfaceDebugInfo;
    supportText?: SupportTextDebugInfo;
    topicUpdates?: TopicUpdatesDebugInfo;
    topicCatalogSelections?: TopicCatalogSelectionDebugInfo[];
  };
};

type TopicCatalogSelectionDebugInfo = {
  proposalId: string;
  topicId: string | null;
  topicSourceVerbatims: string[];
  relatedUnderstandingIds: string[];
  selectedFields: {
    fieldName: string;
    label?: string;
    askableByUser?: boolean;
    category?: unknown;
    broadCategoryHint?: unknown;
  }[];
  selectedGenericKnowledge: unknown[];
  rejectedFieldNames: string[];
  warnings: string[];
  scopeReason: string;
  topicKnowledgeEnrichmentRoute: KnowledgeEnrichmentPlan["route"];
  retrievedChunkCount: number;
  topicRetrievedKnowledgeSynthesis: RetrievedKnowledgeSynthesis | null;
  topicResponsePlan?: {
    responsePlanId: string;
  };
};

type TopicDatasetBranch = {
  topicUpdateProposal: TopicUpdateProposal;
  topicEvidence: TopicEvidence;
  existingTopic?: unknown;
  relatedTextUnderstandings: TextUnderstanding[];
  relatedSupportResponseCues: SupportResponseCue[];
  selectedCatalogKnowledge: SelectedCatalogKnowledgeForTopic;
  topicKnowledgeEnrichmentPlan: KnowledgeEnrichmentPlan;
  topicRetrievedSupportKnowledge: KnowledgeChunk[];
  topicRetrievedKnowledgeSynthesis: RetrievedKnowledgeSynthesis | null;
  topicResponsePlan?: SupportResponsePlan;
};

type TextSurfaceDebugInfo = {
  fallbackUsed: boolean;
  fallbackReason?: string;
  fallbackCategory?: string;
  validationReason?: string;
  llmStatus?: string;
  llmError?: string;
  rawResponse?: string;
};

type SupportTextDebugInfo = {
  callPerformed: boolean;
  llmStatus?: string;
  llmError?: string;
  rawResponse?: string;
  parsedResponse?: unknown;
  validationReason?: string;
  fallbackScope?: "none" | "global" | "local";
  rejectedUnits: {
    sourceSegmentIds?: string[];
    unitIndex: number;
    reason: string;
  }[];
  removedSecondaryElements: {
    sourceSegmentIds?: string[];
    unitIndex?: number;
    field: string;
    reason: string;
  }[];
  segments: {
    segmentId: string;
    fallbackUsed: boolean;
    fallbackScope?: "global" | "local";
    fallbackReason?: string;
  }[];
};

type TopicUpdatesDebugInfo = {
  callPerformed: boolean;
  skippedReason?: string;
};

function compactSelectedField(field: unknown): TopicCatalogSelectionDebugInfo[
  "selectedFields"
][number] | null {
  if (typeof field !== "object" || field === null || Array.isArray(field)) {
    return null;
  }

  const record = field as Record<string, unknown>;

  if (typeof record.fieldName !== "string") {
    return null;
  }

  return {
    fieldName: record.fieldName,
    ...(typeof record.label === "string" ? { label: record.label } : {}),
    ...(typeof record.askableByUser === "boolean"
      ? { askableByUser: record.askableByUser }
      : {}),
    ...(record.category !== undefined ? { category: record.category } : {}),
    ...(record.broadCategoryHint !== undefined
      ? { broadCategoryHint: record.broadCategoryHint }
      : {})
  };
}

function buildTopicCatalogSelectionsDebug(
  branches: TopicDatasetBranch[]
): TopicCatalogSelectionDebugInfo[] {
  return branches.map((branch) => {
    const topicResponsePlan =
      buildTopicResponsePlanDebug(branch.topicResponsePlan);

    return {
      proposalId: branch.topicUpdateProposal.proposalId,
      topicId: branch.topicUpdateProposal.topicId,
      topicSourceVerbatims: branch.topicEvidence.topicSourceVerbatims,
      relatedUnderstandingIds: branch.topicEvidence.relatedUnderstandingIds,
      selectedFields: branch.selectedCatalogKnowledge.selectedFields.flatMap(
        (field) => {
          const compactField = compactSelectedField(field);

          return compactField ? [compactField] : [];
        }
      ),
      selectedGenericKnowledge:
        branch.selectedCatalogKnowledge.selectedGenericKnowledge,
      rejectedFieldNames:
        branch.selectedCatalogKnowledge.rejectedFieldNames,
      warnings: branch.selectedCatalogKnowledge.warnings ?? [],
      scopeReason: branch.selectedCatalogKnowledge.scopeReason,
      topicKnowledgeEnrichmentRoute:
        branch.topicKnowledgeEnrichmentPlan.route,
      retrievedChunkCount: branch.topicRetrievedSupportKnowledge.length,
      topicRetrievedKnowledgeSynthesis:
        branch.topicRetrievedKnowledgeSynthesis,
      ...(topicResponsePlan ? { topicResponsePlan } : {})
    };
  });
}

function getArgValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

function parseUntil(args: string[]): DatasetStopStage {
  const rawUntil = getArgValue(args, "--until");

  if (!rawUntil) {
    return DEFAULT_STOP_STAGE;
  }

  if (DATASET_STOP_STAGES.includes(rawUntil as DatasetStopStage)) {
    return rawUntil as DatasetStopStage;
  }

  throw new Error(
    [
      `Unknown --until value "${rawUntil}".`,
      `Allowed values: ${DATASET_STOP_STAGES.join(" | ")}.`
    ].join(" ")
  );
}

function getStageRank(stage: DatasetStopStage): number {
  if (stage === "all") {
    return DATASET_STOP_STAGES.length;
  }

  return DATASET_STOP_STAGES.indexOf(stage);
}

function shouldRunStage(
  until: DatasetStopStage,
  stage: Exclude<DatasetStopStage, "all">
): boolean {
  return getStageRank(stage) <= getStageRank(until);
}

function listCases(): void {
  console.log("\nAvailable V2 text analysis dataset cases:\n");

  for (const testCase of textAnalysisDataset) {
    const topicCount = testCase.existingTopics.length;
    const suffix = topicCount > 0 ? ` (${topicCount} existing topic(s))` : "";
    console.log(`  ${testCase.id} — ${testCase.name}${suffix}`);
  }

  console.log("");
}

function selectCases(args: string[]): TextAnalysisDatasetCase[] {
  const caseName = getArgValue(args, "--case");

  if (!caseName || args.includes("--all")) {
    return textAnalysisDataset;
  }

  const selectedCase = textAnalysisDataset.find((testCase) => {
    return testCase.id === caseName;
  });

  if (!selectedCase) {
    throw new Error(`Unknown case "${caseName}". Use --list to see cases.`);
  }

  return [selectedCase];
}

function hasAnyEnv(names: string[]): boolean {
  return names.some((name) => {
    return typeof process.env[name] === "string" && process.env[name] !== "";
  });
}

function assertPresetEnvConfigured(params: {
  presetName: string;
  prefix: string;
}): void {
  const hasHost = hasAnyEnv([
    `${params.prefix}_API_HOST`,
    `${params.prefix}_API_BASE_URL`,
    "LLM_API_HOST",
    "OPENAI_API_HOST"
  ]);
  const hasKey = hasAnyEnv([
    `${params.prefix}_API_KEY`,
    "LLM_API_KEY",
    "OPENAI_API_KEY"
  ]);

  if (!hasHost || !hasKey) {
    throw new Error(
      [
        `LLM configuration missing for preset "${params.presetName}".`,
        `Set ${params.prefix}_API_HOST or LLM_API_HOST,`,
        `and ${params.prefix}_API_KEY or LLM_API_KEY.`
      ].join(" ")
    );
  }
}

function stringify(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function logSection(title: string, value: unknown): void {
  console.log(`\n${title}`);
  console.log(stringify(value));
}

function buildInputDisplay(
  testCase: TextAnalysisDatasetCase,
  options: {
    fullInput: boolean;
  }
): unknown {
  if (options.fullInput) {
    return {
      latestUserMessage: testCase.latestUserMessage,
      latestUserAttachments: testCase.latestUserAttachments,
      accountTrustStatus: testCase.accountTrustStatus,
      recentInteractionContext: testCase.recentInteractionContext,
      existingTopics: testCase.existingTopics,
      extractableFieldCatalogCount: testCase.extractableFieldCatalog.length,
      extractableFieldCatalog: testCase.extractableFieldCatalog
    };
  }

  return {
    latestUserMessage: testCase.latestUserMessage,
    latestUserAttachmentsCount: testCase.latestUserAttachments.length,
    ...(testCase.latestUserAttachments.length > 0
      ? { latestUserAttachments: testCase.latestUserAttachments }
      : {}),
    accountTrustStatus: testCase.accountTrustStatus,
    recentInteractionContext: testCase.recentInteractionContext,
    existingTopicsCount: testCase.existingTopics.length,
    existingTopics: testCase.existingTopics,
    extractableFieldCatalogCount: testCase.extractableFieldCatalog.length
  };
}

function getFallbackReason(params: {
  latestUserMessageContent: string;
  matchedPatternIds: string[];
  validationReason?: string;
}): string {
  if (params.latestUserMessageContent.trim() === "") {
    return "empty_message";
  }

  if (params.matchedPatternIds.length > 0) {
    return `${params.validationReason ?? "analysis_failed"}:matched_pattern_safety_fallback`;
  }

  return `${params.validationReason ?? "analysis_failed"}:support_relevant_fallback`;
}

function getFallbackCategory(
  textSurfaceAnalysis: TextSurfaceAnalysis
): string | undefined {
  return textSurfaceAnalysis.segments[0]?.category;
}

function compactTextSurfaceAnalysis(
  textSurfaceAnalysis: TextSurfaceAnalysis
): TextSurfaceAnalysis {
  return {
    userLanguage: textSurfaceAnalysis.userLanguage,
    segments: textSurfaceAnalysis.segments.map((segment) => {
      return {
        segmentId: segment.segmentId,
        verbatim: segment.verbatim,
        category: segment.category,
        ...(segment.standardSubcategory
          ? { standardSubcategory: segment.standardSubcategory }
          : {})
      };
    })
  };
}

async function runTextSurfaceStage(params: {
  testCase: TextAnalysisDatasetCase;
  turnAnalysisPlan: ReturnType<typeof planTurnAnalysis>;
  debug: boolean;
}): Promise<{
  textSurfaceAnalysis: TextSurfaceAnalysis | undefined;
  textSurfaceDebug: TextSurfaceDebugInfo | undefined;
}> {
  if (!params.turnAnalysisPlan.analyzeText) {
    return {
      textSurfaceAnalysis: undefined,
      textSurfaceDebug: undefined
    };
  }

  assertPresetEnvConfigured({
    presetName: "quickDecision",
    prefix: "LLM_QUICK"
  });

  if (!params.debug) {
    return {
      textSurfaceAnalysis: await analyzeTextSurface({
        latestUserMessage: params.testCase.latestUserMessage,
        turnAnalysisPlan: params.turnAnalysisPlan,
        recentInteractionContext: params.testCase.recentInteractionContext
      }),
      textSurfaceDebug: undefined
    };
  }

  const latestUserMessageContent = params.testCase.latestUserMessage.content;
  const prompt = buildAnalyzeTextSurfacePrompt({
    latestUserMessageContent,
    turnAnalysisPlan: params.turnAnalysisPlan,
    recentInteractionContext: params.testCase.recentInteractionContext
  });
  const rawTextSurfaceAnalysis = await requestTextSurfaceAnalysis({
    prompt
  });
  const formattedOutput = formatTextSurfaceAnalysisOutput({
    latestUserMessageContent,
    rawTextSurfaceAnalysis
  });

  const textSurfaceAnalysis =
    formattedOutput.status === "valid"
      ? formattedOutput.analysis
      : buildFallbackTextSurfaceAnalysis({
          latestUserMessageContent,
          turnAnalysisPlan: params.turnAnalysisPlan
        });

  return {
    textSurfaceAnalysis,
    textSurfaceDebug: {
      fallbackUsed: formattedOutput.status !== "valid",
      ...(formattedOutput.status !== "valid"
        ? {
            fallbackReason: getFallbackReason({
              latestUserMessageContent,
              matchedPatternIds: params.turnAnalysisPlan.matchedPatternIds,
              validationReason: formattedOutput.reason
            }),
            fallbackCategory: getFallbackCategory(textSurfaceAnalysis),
            validationReason: formattedOutput.reason
          }
        : {}),
      llmStatus: rawTextSurfaceAnalysis.status,
      ...(rawTextSurfaceAnalysis.error?.message
        ? { llmError: rawTextSurfaceAnalysis.error.message }
        : {}),
      ...(rawTextSurfaceAnalysis.rawResponse
        ? { rawResponse: rawTextSurfaceAnalysis.rawResponse }
        : {})
    }
  };
}

async function runSupportTextStage(params: {
  testCase: TextAnalysisDatasetCase;
  turnAnalysisPlan: ReturnType<typeof planTurnAnalysis>;
  textSurfaceAnalysis: TextSurfaceAnalysis | undefined;
  debug: boolean;
}): Promise<{
  textUnderstandings: TextUnderstanding[] | undefined;
  supportResponseCues: SupportResponseCue[] | undefined;
  supportTextDebug: SupportTextDebugInfo | undefined;
}> {
  const hasSupportSegments =
    params.textSurfaceAnalysis?.segments.some((segment) => {
      return segment.category === "support_relevant";
    }) === true;

  if (!params.textSurfaceAnalysis || !hasSupportSegments) {
    return {
      textUnderstandings: undefined,
      supportResponseCues: undefined,
      supportTextDebug: params.debug
        ? {
            callPerformed: false,
            fallbackScope: "none",
            rejectedUnits: [],
            removedSecondaryElements: [],
            segments: []
          }
        : undefined
    };
  }

  assertPresetEnvConfigured({
    presetName: "fullWeightMessageAnalysis",
    prefix: "LLM_FULL"
  });

  if (!params.debug) {
    const supportTextAnalysis = await analyzeSupportText({
      turnAnalysisPlan: params.turnAnalysisPlan,
      textSurfaceAnalysis: params.textSurfaceAnalysis,
      recentInteractionContext: params.testCase.recentInteractionContext,
      extractableFieldCatalog: params.testCase.extractableFieldCatalog
    });

    return {
      textUnderstandings: supportTextAnalysis.textUnderstandings,
      supportResponseCues: supportTextAnalysis.supportResponseCues,
      supportTextDebug: undefined
    };
  }

  const supportSegments = selectSupportSegments({
    turnAnalysisPlan: params.turnAnalysisPlan,
    textSurfaceAnalysis: params.textSurfaceAnalysis,
    recentInteractionContext: params.testCase.recentInteractionContext,
    extractableFieldCatalog: params.testCase.extractableFieldCatalog
  });
  const prompt = buildAnalyzeSupportTextPrompt({
    supportSegments,
    recentInteractionContext: params.testCase.recentInteractionContext,
    extractableFieldCatalog: params.testCase.extractableFieldCatalog
  });
  const rawSupportTextAnalysis = await requestSupportTextAnalysis({
    prompt
  });
  const formattedOutput = formatSupportTextAnalysisOutputWithDebug({
    supportSegments,
    extractableFieldCatalog: params.testCase.extractableFieldCatalog,
    rawSupportTextAnalysis
  });

  return {
    textUnderstandings: formattedOutput.result.textUnderstandings,
    supportResponseCues: formattedOutput.result.supportResponseCues,
    supportTextDebug: {
      callPerformed: true,
      llmStatus: rawSupportTextAnalysis.status,
      ...(rawSupportTextAnalysis.error?.message
        ? { llmError: rawSupportTextAnalysis.error.message }
        : {}),
      ...(rawSupportTextAnalysis.rawResponse
        ? { rawResponse: rawSupportTextAnalysis.rawResponse }
        : {}),
      ...(rawSupportTextAnalysis.parsedResponse !== undefined
        ? { parsedResponse: rawSupportTextAnalysis.parsedResponse }
        : {}),
      ...(formattedOutput.debug.validationReason
        ? { validationReason: formattedOutput.debug.validationReason }
        : {}),
      fallbackScope: formattedOutput.debug.fallbackScope,
      rejectedUnits: formattedOutput.debug.rejectedUnits,
      removedSecondaryElements: formattedOutput.debug.removedSecondaryElements,
      segments: formattedOutput.debug.segments
    }
  };
}

async function runTopicUpdatesStage(params: {
  testCase: TextAnalysisDatasetCase;
  textUnderstandings: TextUnderstanding[] | undefined;
}): Promise<{
  topicUpdateProposals: TopicUpdateProposal[] | undefined;
  topicUpdatesDebug: TopicUpdatesDebugInfo | undefined;
}> {
  if (!params.textUnderstandings || params.textUnderstandings.length === 0) {
    return {
      topicUpdateProposals: undefined,
      topicUpdatesDebug: {
        callPerformed: false,
        skippedReason: "no_text_understandings"
      }
    };
  }

  assertPresetEnvConfigured({
    presetName: "fullWeightMessageAnalysis",
    prefix: "LLM_FULL"
  });

  const topicUpdatesResult = await proposeTopicUpdates({
    existingTopics: params.testCase.existingTopics,
    textUnderstandings: params.textUnderstandings,
    recentInteractionContext: params.testCase.recentInteractionContext,
    latestUserMessageContent: params.testCase.latestUserMessage.content
  });

  return {
    topicUpdateProposals: topicUpdatesResult.topicUpdateProposals,
    topicUpdatesDebug: {
      callPerformed: true
    }
  };
}

function isActionableTopicUpdateProposal(
  proposal: TopicUpdateProposal
): boolean {
  return proposal.action === "create_new_topic" ||
    proposal.action === "update_existing_topic";
}

function findExistingTopic(
  proposal: TopicUpdateProposal,
  existingTopics: unknown[]
): unknown | undefined {
  if (proposal.topicId === null) {
    return undefined;
  }

  return existingTopics.find((topic) => {
    if (typeof topic !== "object" || topic === null) {
      return false;
    }

    const record = topic as Record<string, unknown>;
    const topicId = record.id_topic ?? record.topicId ?? record.id;

    return String(topicId) === proposal.topicId;
  });
}

function buildDatasetTopicEvidence(params: {
  proposal: TopicUpdateProposal;
  existingTopic?: unknown;
  textUnderstandings: TextUnderstanding[];
  supportResponseCues: SupportResponseCue[];
}): TopicEvidence {
  const relatedUnderstandingIds = new Set(
    params.proposal.fromUnderstandingIds
  );
  const relatedTextUnderstandings = params.textUnderstandings.filter(
    (understanding) => {
      return relatedUnderstandingIds.has(understanding.understandingId);
    }
  );
  const relatedSupportResponseCues = params.supportResponseCues.filter((cue) => {
    return cue.relatedUnderstandingIds.length > 0 &&
      cue.relatedUnderstandingIds.every((understandingId) => {
        return relatedUnderstandingIds.has(understandingId);
      });
  });
  const topicSourceVerbatims = Array.from(new Set(
    params.proposal.selectedSourceVerbatims
  ));

  return {
    proposalId: params.proposal.proposalId,
    topicId: params.proposal.topicId,
    topicSourceVerbatims,
    relatedUnderstandingIds: params.proposal.fromUnderstandingIds,
    relatedTextUnderstandings,
    relatedAttachmentUnderstandings: [],
    relatedSupportResponseCues,
    ...(params.existingTopic ? { existingTopic: params.existingTopic } : {})
  };
}

async function runKnowledgeStage(params: {
  testCase: TextAnalysisDatasetCase;
  textSurfaceAnalysis: TextSurfaceAnalysis | undefined;
  standardResponseFragments: StandardResponseFragment[];
  textUnderstandings: TextUnderstanding[] | undefined;
  supportResponseCues: SupportResponseCue[] | undefined;
  topicUpdateProposals: TopicUpdateProposal[] | undefined;
}): Promise<{
  topicBranches: TopicDatasetBranch[];
  knowledgeEnrichmentPlan: KnowledgeEnrichmentPlan;
  retrievedSupportKnowledge: KnowledgeChunk[];
  synthesizedRetrievedKnowledge: RetrievedKnowledgeSynthesis | null;
}> {
  const actionableProposals = (params.topicUpdateProposals ?? []).filter(
    isActionableTopicUpdateProposal
  );
  const topicBranches = await Promise.all(
    actionableProposals.map(async (topicUpdateProposal) => {
      const existingTopic = findExistingTopic(
        topicUpdateProposal,
        params.testCase.existingTopics
      );
      const topicEvidence = buildDatasetTopicEvidence({
        proposal: topicUpdateProposal,
        ...(existingTopic ? { existingTopic } : {}),
        textUnderstandings: params.textUnderstandings ?? [],
        supportResponseCues: params.supportResponseCues ?? []
      });
      const topicUserMessageContent =
        topicEvidence.topicSourceVerbatims.join(" ").trim();
      const [
        selectedCatalogKnowledge,
        topicKnowledgeEnrichmentPlan
      ] = await Promise.all([
        selectCatalogKnowledgeForTopic({
          topicUserMessageContent,
          topicEvidence,
          extractableFieldCatalog: params.testCase.extractableFieldCatalog,
          recentInteractionContext: params.testCase.recentInteractionContext,
          ...(params.textSurfaceAnalysis?.userLanguage
            ? { targetLanguage: params.textSurfaceAnalysis.userLanguage }
            : {})
        }),
        Promise.resolve(planKnowledgeEnrichment({
          topicEvidence,
          extractableFieldCatalog: params.testCase.extractableFieldCatalog,
          recentInteractionContext: params.testCase.recentInteractionContext,
          ...(params.textSurfaceAnalysis?.userLanguage
            ? { targetLanguage: params.textSurfaceAnalysis.userLanguage }
            : {})
        }))
      ]);

      return {
        topicUpdateProposal,
        topicEvidence,
        ...(existingTopic ? { existingTopic } : {}),
        relatedTextUnderstandings: topicEvidence.relatedTextUnderstandings,
        relatedSupportResponseCues:
          topicEvidence.relatedSupportResponseCues,
        selectedCatalogKnowledge,
        topicKnowledgeEnrichmentPlan,
        topicRetrievedSupportKnowledge: [],
        topicRetrievedKnowledgeSynthesis: null
      };
    })
  );
  const firstBranch = topicBranches[0];

  return {
    topicBranches,
    knowledgeEnrichmentPlan: firstBranch?.topicKnowledgeEnrichmentPlan ?? {
      route: "no_retrieval",
      retrievalRequests: [],
      reason: "no_actionable_topic"
    },
    retrievedSupportKnowledge:
      firstBranch?.topicRetrievedSupportKnowledge ?? [],
    synthesizedRetrievedKnowledge:
      firstBranch?.topicRetrievedKnowledgeSynthesis ?? null
  };
}

async function runResponsePlanStage(params: {
  testCase: TextAnalysisDatasetCase;
  textSurfaceAnalysis: TextSurfaceAnalysis | undefined;
  topicBranches: TopicDatasetBranch[];
}): Promise<TopicDatasetBranch[]> {
  if (params.topicBranches.length === 0) {
    return [];
  }

  assertPresetEnvConfigured({
    presetName: "fullWeightMessageAnalysis",
    prefix: "LLM_FULL"
  });

  const plannedBranches = await Promise.all(
    params.topicBranches.map(async (branch) => {
      const result = await planSupportResponse({
        topicUserMessageContent:
          branch.topicEvidence.topicSourceVerbatims.join(" ").trim(),
        topicEvidence: branch.topicEvidence,
        ...(params.textSurfaceAnalysis?.userLanguage
          ? { targetLanguage: params.textSurfaceAnalysis.userLanguage }
          : {}),
        selectedCatalogKnowledge: branch.selectedCatalogKnowledge,
        topicKnowledgeEnrichmentPlan: branch.topicKnowledgeEnrichmentPlan,
        topicRetrievedKnowledgeSynthesis:
          branch.topicRetrievedKnowledgeSynthesis,
        channel: params.testCase.latestUserMessage.channel
      });

      return {
        ...branch,
        topicResponsePlan: result.responsePlan
      };
    })
  );
  const topicResponsePlans = assignTopicResponsePlanIds(
    plannedBranches.map((branch) => ({
      proposalId: branch.topicUpdateProposal.proposalId,
      responsePlan: branch.topicResponsePlan
    }))
  );

  return plannedBranches.map((branch, index) => ({
    ...branch,
    topicResponsePlan: topicResponsePlans[index]
  }));
}

async function runRenderStage(params: {
  testCase: TextAnalysisDatasetCase;
  textSurfaceAnalysis: TextSurfaceAnalysis | undefined;
  standardResponseFragments: StandardResponseFragment[];
  topicResponsePlans: SupportResponsePlan[];
}): Promise<RenderedSupportResponse> {
  assertPresetEnvConfigured({
    presetName: "fullWeightMessageAnalysis",
    prefix: "LLM_FULL"
  });

  const result = await renderSupportResponse({
    latestUserMessageContent: params.testCase.latestUserMessage.content,
    ...(params.textSurfaceAnalysis?.userLanguage
      ? { targetLanguage: params.textSurfaceAnalysis.userLanguage }
      : {}),
    standardResponseFragments: params.standardResponseFragments,
    topicResponsePlans: params.topicResponsePlans,
    channel: params.testCase.latestUserMessage.channel
  });

  return result.renderedResponse;
}

async function runCase(
  testCase: TextAnalysisDatasetCase,
  options: {
    debug: boolean;
    until: DatasetStopStage;
  }
): Promise<CaseRunOutput> {
  const promptSecuritySignals = detectSuspiciousPromptPatterns({
    latestUserMessage: testCase.latestUserMessage
  });

  if (!shouldRunStage(options.until, "plan")) {
    return {
      promptSecuritySignals,
      turnAnalysisPlan: "SKIPPED",
      textSurfaceAnalysis: "SKIPPED",
      standardResponseFragments: "SKIPPED",
      textUnderstandings: "SKIPPED",
      supportResponseCues: "SKIPPED",
      topicUpdateProposals: "SKIPPED",
      knowledgeEnrichmentPlan: "SKIPPED",
      retrievedSupportKnowledge: "SKIPPED",
      synthesizedRetrievedKnowledge: "SKIPPED",
      responsePlan: "SKIPPED",
      renderedSupportResponse: "SKIPPED"
    };
  }

  const turnAnalysisPlan = planTurnAnalysis({
    latestUserMessage: testCase.latestUserMessage,
    latestUserAttachments: testCase.latestUserAttachments,
    promptSecuritySignals,
    accountTrustStatus: testCase.accountTrustStatus
  });

  if (!shouldRunStage(options.until, "surface")) {
    return {
      promptSecuritySignals,
      turnAnalysisPlan,
      textSurfaceAnalysis: "SKIPPED",
      standardResponseFragments: "SKIPPED",
      textUnderstandings: "SKIPPED",
      supportResponseCues: "SKIPPED",
      topicUpdateProposals: "SKIPPED",
      knowledgeEnrichmentPlan: "SKIPPED",
      retrievedSupportKnowledge: "SKIPPED",
      synthesizedRetrievedKnowledge: "SKIPPED",
      responsePlan: "SKIPPED",
      renderedSupportResponse: "SKIPPED"
    };
  }

  const {
    textSurfaceAnalysis,
    textSurfaceDebug
  } = await runTextSurfaceStage({
    testCase,
    turnAnalysisPlan,
    debug: options.debug
  });

  if (!shouldRunStage(options.until, "standard")) {
    return {
      promptSecuritySignals,
      turnAnalysisPlan,
      textSurfaceAnalysis: textSurfaceAnalysis
        ? compactTextSurfaceAnalysis(textSurfaceAnalysis)
        : "SKIPPED",
      standardResponseFragments: "SKIPPED",
      textUnderstandings: "SKIPPED",
      supportResponseCues: "SKIPPED",
      topicUpdateProposals: "SKIPPED",
      knowledgeEnrichmentPlan: "SKIPPED",
      retrievedSupportKnowledge: "SKIPPED",
      synthesizedRetrievedKnowledge: "SKIPPED",
      responsePlan: "SKIPPED",
      renderedSupportResponse: "SKIPPED",
      ...(options.debug
        ? {
            debug: {
              textSurface: textSurfaceDebug
            }
          }
        : {})
    };
  }

  const standardResponseFragments = buildStandardResponseFragments({
    turnAnalysisPlan,
    latestUserMessage: testCase.latestUserMessage,
    recentInteractionContext: testCase.recentInteractionContext,
    textSurfaceAnalysis,
    attachmentSurfaceAnalysis: []
  });

  if (!shouldRunStage(options.until, "support")) {
    return {
      promptSecuritySignals,
      turnAnalysisPlan,
      textSurfaceAnalysis: textSurfaceAnalysis
        ? compactTextSurfaceAnalysis(textSurfaceAnalysis)
        : "SKIPPED",
      standardResponseFragments,
      textUnderstandings: "SKIPPED",
      supportResponseCues: "SKIPPED",
      topicUpdateProposals: "SKIPPED",
      knowledgeEnrichmentPlan: "SKIPPED",
      retrievedSupportKnowledge: "SKIPPED",
      synthesizedRetrievedKnowledge: "SKIPPED",
      responsePlan: "SKIPPED",
      renderedSupportResponse: "SKIPPED",
      ...(options.debug
        ? {
            debug: {
              textSurface: textSurfaceDebug
            }
          }
        : {})
    };
  }

  const {
    textUnderstandings,
    supportResponseCues,
    supportTextDebug
  } = await runSupportTextStage({
    testCase,
    turnAnalysisPlan,
    textSurfaceAnalysis,
    debug: options.debug
  });

  if (!shouldRunStage(options.until, "topics")) {
    return {
      promptSecuritySignals,
      turnAnalysisPlan,
      textSurfaceAnalysis: textSurfaceAnalysis
        ? compactTextSurfaceAnalysis(textSurfaceAnalysis)
        : "SKIPPED",
      standardResponseFragments,
      textUnderstandings: textUnderstandings ?? "SKIPPED",
      supportResponseCues: supportResponseCues ?? "SKIPPED",
      topicUpdateProposals: "SKIPPED",
      knowledgeEnrichmentPlan: "SKIPPED",
      retrievedSupportKnowledge: "SKIPPED",
      synthesizedRetrievedKnowledge: "SKIPPED",
      responsePlan: "SKIPPED",
      renderedSupportResponse: "SKIPPED",
      ...(options.debug
        ? {
            debug: {
              textSurface: textSurfaceDebug,
              supportText: supportTextDebug
            }
          }
        : {})
    };
  }

  const {
    topicUpdateProposals,
    topicUpdatesDebug
  } = await runTopicUpdatesStage({
    testCase,
    textUnderstandings
  });

  if (!shouldRunStage(options.until, "knowledge")) {
    return {
      promptSecuritySignals,
      turnAnalysisPlan,
      textSurfaceAnalysis: textSurfaceAnalysis
        ? compactTextSurfaceAnalysis(textSurfaceAnalysis)
        : "SKIPPED",
      standardResponseFragments,
      textUnderstandings: textUnderstandings ?? "SKIPPED",
      supportResponseCues: supportResponseCues ?? "SKIPPED",
      topicUpdateProposals: topicUpdateProposals ?? "SKIPPED",
      knowledgeEnrichmentPlan: "SKIPPED",
      retrievedSupportKnowledge: "SKIPPED",
      synthesizedRetrievedKnowledge: "SKIPPED",
      responsePlan: "SKIPPED",
      renderedSupportResponse: "SKIPPED",
      ...(options.debug
        ? {
            debug: {
              textSurface: textSurfaceDebug,
              supportText: supportTextDebug,
              topicUpdates: topicUpdatesDebug
            }
          }
        : {})
    };
  }

  const {
    topicBranches,
    knowledgeEnrichmentPlan,
    retrievedSupportKnowledge,
    synthesizedRetrievedKnowledge
  } = await runKnowledgeStage({
    testCase,
    textSurfaceAnalysis,
    standardResponseFragments,
    textUnderstandings,
    supportResponseCues,
    topicUpdateProposals
  });

  if (!shouldRunStage(options.until, "response-plan")) {
    return {
      promptSecuritySignals,
      turnAnalysisPlan,
      textSurfaceAnalysis: textSurfaceAnalysis
        ? compactTextSurfaceAnalysis(textSurfaceAnalysis)
        : "SKIPPED",
      standardResponseFragments,
      textUnderstandings: textUnderstandings ?? "SKIPPED",
      supportResponseCues: supportResponseCues ?? "SKIPPED",
      topicUpdateProposals: topicUpdateProposals ?? "SKIPPED",
      knowledgeEnrichmentPlan,
      retrievedSupportKnowledge,
      synthesizedRetrievedKnowledge,
      responsePlan: "SKIPPED",
      renderedSupportResponse: "SKIPPED",
      ...(options.debug
        ? {
            debug: {
              textSurface: textSurfaceDebug,
              supportText: supportTextDebug,
              topicUpdates: topicUpdatesDebug,
              topicCatalogSelections:
                buildTopicCatalogSelectionsDebug(topicBranches)
            }
          }
        : {})
    };
  }

  const plannedTopicBranches = await runResponsePlanStage({
    testCase,
    textSurfaceAnalysis,
    topicBranches
  });
  const topicResponsePlans = plannedTopicBranches.flatMap((branch) => {
    return branch.topicResponsePlan ? [branch.topicResponsePlan] : [];
  });
  const responsePlan = topicResponsePlans[0];

  if (!shouldRunStage(options.until, "render")) {
    return {
      promptSecuritySignals,
      turnAnalysisPlan,
      textSurfaceAnalysis: textSurfaceAnalysis
        ? compactTextSurfaceAnalysis(textSurfaceAnalysis)
        : "SKIPPED",
      standardResponseFragments,
      textUnderstandings: textUnderstandings ?? "SKIPPED",
      supportResponseCues: supportResponseCues ?? "SKIPPED",
      topicUpdateProposals: topicUpdateProposals ?? "SKIPPED",
      knowledgeEnrichmentPlan,
      retrievedSupportKnowledge,
      synthesizedRetrievedKnowledge,
      responsePlan: responsePlan ?? "SKIPPED",
      topicResponsePlans,
      renderedSupportResponse: "SKIPPED",
      ...(options.debug
        ? {
            debug: {
              textSurface: textSurfaceDebug,
              supportText: supportTextDebug,
              topicUpdates: topicUpdatesDebug,
              topicCatalogSelections:
                buildTopicCatalogSelectionsDebug(plannedTopicBranches)
            }
          }
        : {})
    };
  }

  const renderedSupportResponse = await runRenderStage({
    testCase,
    textSurfaceAnalysis,
    standardResponseFragments,
    topicResponsePlans
  });

  return {
    promptSecuritySignals,
    turnAnalysisPlan,
    textSurfaceAnalysis: textSurfaceAnalysis
      ? compactTextSurfaceAnalysis(textSurfaceAnalysis)
      : "SKIPPED",
    standardResponseFragments,
    textUnderstandings: textUnderstandings ?? "SKIPPED",
    supportResponseCues: supportResponseCues ?? "SKIPPED",
    topicUpdateProposals: topicUpdateProposals ?? "SKIPPED",
    knowledgeEnrichmentPlan,
    retrievedSupportKnowledge,
    synthesizedRetrievedKnowledge,
    responsePlan: responsePlan ?? "SKIPPED",
    topicResponsePlans,
    renderedSupportResponse,
    ...(options.debug
      ? {
          debug: {
            textSurface: textSurfaceDebug,
            supportText: supportTextDebug,
            topicUpdates: topicUpdatesDebug,
            topicCatalogSelections:
              buildTopicCatalogSelectionsDebug(plannedTopicBranches)
          }
        }
      : {})
  };
}

async function runAndLogCase(
  testCase: TextAnalysisDatasetCase,
  options: {
    debug: boolean;
    until: DatasetStopStage;
    fullInput: boolean;
  }
): Promise<void> {
  console.log("\n============================================================");
  console.log(`CASE ${testCase.id} — ${testCase.name}`);
  console.log(`UNTIL ${options.until}`);
  console.log("============================================================");

  logSection("INPUT", buildInputDisplay(testCase, {
    fullInput: options.fullInput
  }));

  try {
    const output = await runCase(testCase, options);

    logSection("1. promptSecuritySignals", output.promptSecuritySignals);
    logSection("2. turnAnalysisPlan", output.turnAnalysisPlan);
    logSection("3. textSurfaceAnalysis", output.textSurfaceAnalysis);
    logSection(
      "4. standardResponseFragments",
      output.standardResponseFragments
    );
    logSection("5. textUnderstandings", output.textUnderstandings);
    logSection("6. supportResponseCues", output.supportResponseCues);
    logSection("7. topicUpdateProposals", output.topicUpdateProposals);
    logSection("8. knowledgeEnrichmentPlan", output.knowledgeEnrichmentPlan);
    logSection("9. retrievedSupportKnowledge", output.retrievedSupportKnowledge);
    logSection(
      "10. synthesizedRetrievedKnowledge",
      output.synthesizedRetrievedKnowledge
    );
    logSection("11. responsePlan", output.responsePlan);
    logSection(
      "12. topicResponsePlans",
      output.topicResponsePlans ?? "SKIPPED"
    );
    logSection("13. renderedSupportResponse", output.renderedSupportResponse);

    if (output.renderedSupportResponse !== "SKIPPED") {
      console.log("\nFINAL RESPONSE TEXT");
      console.log(output.renderedSupportResponse.finalResponseText);
    }

    if (options.debug) {
      logSection("DEBUG", output.debug ?? {});
    }
  } catch (error) {
    console.error("\nERROR");
    console.error(error instanceof Error ? error.message : error);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const debug = args.includes("--debug");
  const fullInput = args.includes("--full-input");

  if (args.includes("--list")) {
    listCases();
    return;
  }

  let until: DatasetStopStage;
  let selectedCases: TextAnalysisDatasetCase[];

  try {
    until = parseUntil(args);
    selectedCases = selectCases(args);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    listCases();
    process.exitCode = 1;
    return;
  }

  for (const testCase of selectedCases) {
    await runAndLogCase(testCase, {
      debug,
      until,
      fullInput
    });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

export {
  buildTopicCatalogSelectionsDebug
};

export type {
  TopicDatasetBranch
};
