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
 *   npm run support:v2:text-dataset -- --case mixed --until topics --debug --show-llm-estimates
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
  retrieveSupportKnowledge
} from "../../../src/support-processing-pipeline/v2/retrieve-support-knowledge/retrieveSupportKnowledge";
import {
  enrichSelectedCatalogKnowledgeWithSynthesis,
  synthesizeRetrievedKnowledge
} from "../../../src/support-processing-pipeline/v2/synthesize-retrieved-knowledge/synthesizeRetrievedKnowledge";
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
  type ExpectedTextSurface,
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
  TopicUpdateOp,
  TopicEvidence
} from "../../../src/support-processing-pipeline/v2/typesSupportProcessingPipelineV2.types";
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
  topicUpdateOps: TopicUpdateOp[] | "SKIPPED";
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

type DatasetAssertionStatus = "passed" | "failed";

type DatasetAssertionResult = {
  name: string;
  status: DatasetAssertionStatus;
  expected?: unknown;
  actual?: unknown;
  message: string;
};

type DatasetAssertionsOutput = {
  status: DatasetAssertionStatus;
  results: DatasetAssertionResult[];
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
  topicUpdateOp: TopicUpdateOp;
  topicUpdateOpId: string;
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
      proposalId: branch.topicUpdateOpId,
      topicId: branch.topicUpdateOp.topicId,
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

function normalizeDatasetLanguage(value: unknown): string {
  if (typeof value !== "string") {
    return "unknown";
  }

  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue === "") {
    return "unknown";
  }

  const primaryCode = normalizedValue.split("-")[0] ?? normalizedValue;
  const legacyLanguages: Record<string, string> = {
    french: "fr",
    english: "en",
    german: "de",
    italian: "it",
    spanish: "es",
    chinese: "zh",
    other: "unknown",
    unknown: "unknown"
  };

  return legacyLanguages[normalizedValue] ??
    legacyLanguages[primaryCode] ??
    primaryCode;
}

function passedAssertion(
  name: string,
  expected: unknown,
  actual: unknown,
  message: string
): DatasetAssertionResult {
  return {
    name,
    status: "passed",
    expected,
    actual,
    message
  };
}

function failedAssertion(
  name: string,
  expected: unknown,
  actual: unknown,
  message: string
): DatasetAssertionResult {
  return {
    name,
    status: "failed",
    expected,
    actual,
    message
  };
}

function evaluateExpectedTextSurface(params: {
  expected: ExpectedTextSurface;
  textSurfaceAnalysis: TextSurfaceAnalysis | "SKIPPED";
}): DatasetAssertionsOutput {
  const results: DatasetAssertionResult[] = [];

  if (params.textSurfaceAnalysis === "SKIPPED") {
    return {
      status: "failed",
      results: [
        failedAssertion(
          "textSurfaceAnalysis.available",
          "TextSurfaceAnalysis",
          "SKIPPED",
          "textSurfaceAnalysis was skipped, so expectedTextSurface could not be evaluated."
        )
      ]
    };
  }

  const actualLanguage = normalizeDatasetLanguage(
    params.textSurfaceAnalysis.userLanguage
  );

  if (params.expected.userLanguage) {
    const expectedLanguage = normalizeDatasetLanguage(
      params.expected.userLanguage
    );

    results.push(
      actualLanguage === expectedLanguage
        ? passedAssertion(
            "userLanguage",
            expectedLanguage,
            actualLanguage,
            `userLanguage matched ${expectedLanguage}.`
          )
        : failedAssertion(
            "userLanguage",
            expectedLanguage,
            actualLanguage,
            `userLanguage expected ${expectedLanguage}, got ${actualLanguage}.`
          )
    );
  }

  if (params.expected.allowedUserLanguages) {
    const expectedLanguages = params.expected.allowedUserLanguages.map(
      normalizeDatasetLanguage
    );

    results.push(
      expectedLanguages.includes(actualLanguage)
        ? passedAssertion(
            "allowedUserLanguages",
            expectedLanguages,
            actualLanguage,
            `userLanguage ${actualLanguage} is allowed.`
          )
        : failedAssertion(
            "allowedUserLanguages",
            expectedLanguages,
            actualLanguage,
            `userLanguage expected one of ${expectedLanguages.join(", ")}, got ${actualLanguage}.`
          )
    );
  }

  if (params.expected.forbiddenUserLanguages) {
    const forbiddenLanguages = params.expected.forbiddenUserLanguages.map(
      normalizeDatasetLanguage
    );

    results.push(
      forbiddenLanguages.includes(actualLanguage)
        ? failedAssertion(
            "forbiddenUserLanguages",
            forbiddenLanguages,
            actualLanguage,
            `userLanguage ${actualLanguage} is forbidden.`
          )
        : passedAssertion(
            "forbiddenUserLanguages",
            forbiddenLanguages,
            actualLanguage,
            `userLanguage ${actualLanguage} is not forbidden.`
          )
    );
  }

  if (params.expected.expectedCategories) {
    const actualCategories = params.textSurfaceAnalysis.segments.map(
      (segment) => segment.category
    );

    for (const expectedCategory of params.expected.expectedCategories) {
      results.push(
        actualCategories.includes(expectedCategory)
          ? passedAssertion(
              `category.${expectedCategory}`,
              expectedCategory,
              actualCategories,
              `category ${expectedCategory} is present.`
            )
          : failedAssertion(
              `category.${expectedCategory}`,
              expectedCategory,
              actualCategories,
              `category ${expectedCategory} is missing.`
            )
      );
    }
  }

  if (params.expected.minSupportRelevantSegments !== undefined) {
    const supportRelevantCount = params.textSurfaceAnalysis.segments.filter(
      (segment) => segment.category === "support_relevant"
    ).length;

    results.push(
      supportRelevantCount >= params.expected.minSupportRelevantSegments
        ? passedAssertion(
            "minSupportRelevantSegments",
            params.expected.minSupportRelevantSegments,
            supportRelevantCount,
            `support_relevant segment count ${supportRelevantCount} is sufficient.`
          )
        : failedAssertion(
            "minSupportRelevantSegments",
            params.expected.minSupportRelevantSegments,
            supportRelevantCount,
            `support_relevant segment count expected >= ${params.expected.minSupportRelevantSegments}, got ${supportRelevantCount}.`
          )
    );
  }

  return {
    status: results.some((result) => result.status === "failed")
      ? "failed"
      : "passed",
    results
  };
}

function buildDatasetAssertions(params: {
  testCase: TextAnalysisDatasetCase;
  output: CaseRunOutput;
}): DatasetAssertionsOutput | undefined {
  if (!params.testCase.expectedTextSurface) {
    return undefined;
  }

  return evaluateExpectedTextSurface({
    expected: params.testCase.expectedTextSurface,
    textSurfaceAnalysis: params.output.textSurfaceAnalysis
  });
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
  topicUpdateOps: TopicUpdateOp[] | undefined;
  topicUpdatesDebug: TopicUpdatesDebugInfo | undefined;
}> {
  if (!params.textUnderstandings || params.textUnderstandings.length === 0) {
    return {
      topicUpdateOps: undefined,
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
    topicUpdateOps: topicUpdatesResult.topicUpdateOps,
    topicUpdatesDebug: {
      callPerformed: true
    }
  };
}

function isActionableTopicUpdateOp(
  op: TopicUpdateOp
): boolean {
  return op.op === "create" || op.op === "update";
}

function findExistingTopic(
  op: TopicUpdateOp,
  existingTopics: unknown[]
): unknown | undefined {
  if (op.topicId === null) {
    return undefined;
  }

  return existingTopics.find((topic) => {
    if (typeof topic !== "object" || topic === null) {
      return false;
    }

    const record = topic as Record<string, unknown>;
    const topicId = record.id_topic ?? record.topicId ?? record.id;

    return String(topicId) === op.topicId;
  });
}

function understandingEvidence(understanding: TextUnderstanding): string[] {
  return [
    ...understanding.messageKinds.map((messageKind) => {
      return messageKind.evidence;
    }),
    ...understanding.caseDetails.map((detail) => {
      return detail.evidence;
    }),
    ...understanding.attemptedActions.map((action) => {
      return action.evidence;
    }),
    ...understanding.supportMetadata.map((metadata) => {
      return metadata.evidence;
    })
  ].filter((evidence) => {
    return typeof evidence === "string" && evidence.trim() !== "";
  });
}

function buildDatasetTopicEvidence(params: {
  op: TopicUpdateOp;
  opIndex: number;
  existingTopic?: unknown;
  textUnderstandings: TextUnderstanding[];
  supportResponseCues: SupportResponseCue[];
}): TopicEvidence {
  const relatedTextUnderstandings = params.op.items.flatMap((itemIndex) => {
    const understanding = params.textUnderstandings[itemIndex];

    return understanding ? [understanding] : [];
  });
  const relatedUnderstandingIds = new Set(
    relatedTextUnderstandings.map((understanding) => {
      return understanding.understandingId;
    }
  ));
  const relatedSupportResponseCues = params.supportResponseCues.filter((cue) => {
    return cue.relatedUnderstandingIds.length > 0 &&
      cue.relatedUnderstandingIds.every((understandingId) => {
        return relatedUnderstandingIds.has(understandingId);
      });
  });
  const topicSourceVerbatims = Array.from(new Set(
    relatedTextUnderstandings.flatMap(understandingEvidence)
  ));

  return {
    proposalId: `topic_update_op_${params.opIndex + 1}`,
    topicId: params.op.topicId,
    topicSourceVerbatims,
    relatedUnderstandingIds: Array.from(relatedUnderstandingIds),
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
  topicUpdateOps: TopicUpdateOp[] | undefined;
}): Promise<{
  topicBranches: TopicDatasetBranch[];
  knowledgeEnrichmentPlan: KnowledgeEnrichmentPlan;
  retrievedSupportKnowledge: KnowledgeChunk[];
  synthesizedRetrievedKnowledge: RetrievedKnowledgeSynthesis | null;
}> {
  const actionableOps = (params.topicUpdateOps ?? []).filter(
    isActionableTopicUpdateOp
  );
  const topicBranches = await Promise.all(
    actionableOps.map(async (topicUpdateOp) => {
      const opIndex = params.topicUpdateOps?.indexOf(topicUpdateOp) ?? 0;
      const existingTopic = findExistingTopic(
        topicUpdateOp,
        params.testCase.existingTopics
      );
      const topicEvidence = buildDatasetTopicEvidence({
        op: topicUpdateOp,
        opIndex,
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

      let topicRetrievedSupportKnowledge: KnowledgeChunk[] = [];
      let topicRetrievedKnowledgeSynthesis:
        | RetrievedKnowledgeSynthesis
        | null = null;

      if (topicKnowledgeEnrichmentPlan.route === "retrieve_knowledge") {
        topicRetrievedSupportKnowledge = await retrieveSupportKnowledge({
          knowledgeEnrichmentPlan: topicKnowledgeEnrichmentPlan,
          topicEvidence,
          selectedCatalogKnowledge,
          topicKnowledgeEnrichmentPlan
        });
        topicRetrievedKnowledgeSynthesis = synthesizeRetrievedKnowledge({
          knowledgeEnrichmentPlan: topicKnowledgeEnrichmentPlan,
          knowledgeChunks: topicRetrievedSupportKnowledge,
          topicEvidence,
          selectedCatalogKnowledge,
          topicKnowledgeEnrichmentPlan
        });
      }
      const plannerSelectedCatalogKnowledge =
        enrichSelectedCatalogKnowledgeWithSynthesis({
          selectedCatalogKnowledge,
          extractableFieldCatalog: params.testCase.extractableFieldCatalog,
          synthesis: topicRetrievedKnowledgeSynthesis
        });

      return {
        topicUpdateOp,
        topicUpdateOpId: topicEvidence.proposalId,
        topicEvidence,
        ...(existingTopic ? { existingTopic } : {}),
        relatedTextUnderstandings: topicEvidence.relatedTextUnderstandings,
        relatedSupportResponseCues:
          topicEvidence.relatedSupportResponseCues,
        selectedCatalogKnowledge: plannerSelectedCatalogKnowledge,
        topicKnowledgeEnrichmentPlan,
        topicRetrievedSupportKnowledge,
        topicRetrievedKnowledgeSynthesis
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
      proposalId: branch.topicUpdateOpId,
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
      topicUpdateOps: "SKIPPED",
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
      topicUpdateOps: "SKIPPED",
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
      topicUpdateOps: "SKIPPED",
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
      topicUpdateOps: "SKIPPED",
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
      topicUpdateOps: "SKIPPED",
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
    topicUpdateOps,
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
      topicUpdateOps: topicUpdateOps ?? "SKIPPED",
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
    topicUpdateOps
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
      topicUpdateOps: topicUpdateOps ?? "SKIPPED",
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
      topicUpdateOps: topicUpdateOps ?? "SKIPPED",
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
    topicUpdateOps: topicUpdateOps ?? "SKIPPED",
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
    logSection("7. topicUpdateOps", output.topicUpdateOps);
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

    const datasetAssertions = buildDatasetAssertions({
      testCase,
      output
    });

    if (datasetAssertions) {
      logSection("datasetAssertions", datasetAssertions);

      if (datasetAssertions.status === "failed") {
        process.exitCode = 1;
      }
    }
  } catch (error) {
    console.error("\nERROR");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const debug = args.includes("--debug");
  const fullInput = args.includes("--full-input");
  const showLlmEstimates = args.includes("--show-llm-estimates");

  if (showLlmEstimates) {
    process.env.LLM_LOG_ESTIMATES = "true";
  }

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
