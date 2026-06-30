/**
 * Manual runner for the official V2 support-processing pipeline.
 *
 * Usage:
 *   npm run support:v2:dataset -- --list
 *   npm run support:v2:dataset
 *   npm run support:v2:dataset -- --all
 *   npm run support:v2:dataset -- --case mixed
 *   npm run support:v2:dataset -- --case mixed --until topics
 *   npm run support:v2:dataset -- --case mixed --until render --debug
 *   npm run support:v2:text-dataset -- --case mixed --until topics
 */

import "dotenv/config";

import {
  buildDefaultAccountInteractionTraits,
  buildDefaultAccountProfile
} from "../../src/orchestration/buildSupportProcessingInput";
import {
  buildEmptyRecentInteractionContext,
  buildRecentInteractionContextFromLiveMemoryContext
} from "../../src/orchestration/buildSupportProcessingInputV2";
import {
  convertLiveMemoryContextToSupportTopicKnowledge
} from "../../src/persistence/live-memory-context/convertLiveMemoryContextToSupportTopicKnowledge";
import {
  runSupportProcessingPipelineV2Debug
} from "../../src/support-processing-pipeline-v2/runSupportProcessingPipelineV2Debug";
import {
  textAnalysisDataset,
  type ExpectedTextSurface,
  type TextAnalysisDatasetCase
} from "./textAnalysisDataset";

import type {
  AccountProfile,
  AccountInteractionTraits
} from "../../src/support-processing-pipeline/typesSupportProcessingPipeline.types";
import type {
  SupportProcessingPipelineV2DebugOutput
} from "../../src/support-processing-pipeline-v2/runSupportProcessingPipelineV2Debug";
import type {
  SupportProcessingPipelineV2Input,
  SupportProcessingProgressEvent,
  SupportProcessingStepName,
  TextSurfaceAnalysis
} from "../../src/support-processing-pipeline-v2/typesSupportProcessingPipelineV2.types";

const DATASET_STOP_STAGES = [
  "security",
  "plan",
  "surface",
  "standard",
  "support",
  "topics",
  "knowledge",
  "response-plan",
  "compose",
  "render",
  "all"
] as const;

type DatasetStopStage = (typeof DATASET_STOP_STAGES)[number];

const DEFAULT_STOP_STAGE: DatasetStopStage = "topics";

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

const UNTIL_TO_STOP_AFTER_STEP: Record<
  Exclude<DatasetStopStage, "all">,
  SupportProcessingStepName
> = {
  security: "detectSuspiciousPromptPatterns",
  plan: "planTurnAnalysis",
  surface: "analyzeTextSurface",
  standard: "buildStandardResponseFragments",
  support: "analyzeSupportText",
  topics: "proposeTopicUpdates",
  knowledge: "synthesizeRetrievedKnowledge",
  "response-plan": "planSupportResponse",
  compose: "composeSupportResponsePlan",
  render: "renderSupportResponse"
};

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

function listCases(): void {
  console.log("\nAvailable V2 support-processing dataset cases:\n");

  for (const testCase of textAnalysisDataset) {
    const topicCount = testCase.liveMemoryContext?.topics.length ?? 0;
    const suffix = topicCount > 0 ? ` (${topicCount} existing topic(s))` : "";

    console.log(`  ${testCase.id} - ${testCase.name}${suffix}`);
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

function getPartialTextSurfaceAnalysis(
  debugOutput: SupportProcessingPipelineV2DebugOutput
): TextSurfaceAnalysis | "SKIPPED" {
  const partialValue = debugOutput.partial.analyzeTextSurface;

  if (partialValue === "SKIPPED") {
    return "SKIPPED";
  }

  if (
    typeof partialValue === "object" &&
    partialValue !== null &&
    "segments" in partialValue
  ) {
    return partialValue as TextSurfaceAnalysis;
  }

  return "SKIPPED";
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
  debugOutput: SupportProcessingPipelineV2DebugOutput;
}): DatasetAssertionsOutput | undefined {
  if (!params.testCase.expectedTextSurface) {
    return undefined;
  }

  return evaluateExpectedTextSurface({
    expected: params.testCase.expectedTextSurface,
    textSurfaceAnalysis: getPartialTextSurfaceAnalysis(params.debugOutput)
  });
}

function buildDatasetInput(
  testCase: TextAnalysisDatasetCase
): SupportProcessingPipelineV2Input {
  const userId = "dataset-user";
  const accountProfile: AccountProfile = buildDefaultAccountProfile(userId);
  const accountInteractionTraits: AccountInteractionTraits =
    buildDefaultAccountInteractionTraits();

  return {
    conversationScope: {
      channel: testCase.latestUserMessage.channel,
      roomId: "dataset-room",
      threadId: null,
      userId
    },
    latestUserMessage: testCase.latestUserMessage,
    latestUserAttachments: testCase.latestUserAttachments,
    accountTrustStatus: testCase.accountTrustStatus,
    accountProfile,
    accountInteractionTraits,
    supportTopicKnowledge: testCase.liveMemoryContext
      ? convertLiveMemoryContextToSupportTopicKnowledge(
          testCase.liveMemoryContext
        )
      : { segments_topic: [] },
    conversationHistory: [],
    recentInteractionContext: testCase.liveMemoryContext
      ? buildRecentInteractionContextFromLiveMemoryContext(
          testCase.liveMemoryContext
        )
      : buildEmptyRecentInteractionContext()
  };
}

function buildInputDisplay(params: {
  input: SupportProcessingPipelineV2Input;
  testCase: TextAnalysisDatasetCase;
  fullInput: boolean;
}): unknown {
  if (params.fullInput) {
    return {
      ...params.input,
      extractableFieldCatalogCount: params.testCase.extractableFieldCatalog.length,
      extractableFieldCatalog: params.testCase.extractableFieldCatalog
    };
  }

  return {
    latestUserMessage: params.input.latestUserMessage,
    latestUserAttachmentsCount: params.input.latestUserAttachments.length,
    ...(params.input.latestUserAttachments.length > 0
      ? { latestUserAttachments: params.input.latestUserAttachments }
      : {}),
    accountTrustStatus: params.input.accountTrustStatus,
    recentInteractionContext: params.input.recentInteractionContext,
    supportTopicKnowledge: {
      topicsCount: params.input.supportTopicKnowledge.segments_topic.length,
      topics: params.input.supportTopicKnowledge.segments_topic
    },
    extractableFieldCatalogCount: params.testCase.extractableFieldCatalog.length
  };
}

function getStopAfterStep(until: DatasetStopStage):
  SupportProcessingStepName | undefined {
  return until === "all" ? undefined : UNTIL_TO_STOP_AFTER_STEP[until];
}

function buildProgressSummary(
  events: SupportProcessingProgressEvent[]
): string[] {
  return events.map((event) => {
    return `${event.step}:${event.status}`;
  });
}

async function runCase(
  testCase: TextAnalysisDatasetCase,
  options: {
    until: DatasetStopStage;
    debug: boolean;
    fullInput: boolean;
  }
): Promise<{
  input: SupportProcessingPipelineV2Input;
  debugOutput: SupportProcessingPipelineV2DebugOutput;
}> {
  const input = buildDatasetInput(testCase);
  const stopAfterStep = getStopAfterStep(options.until);
  const debugOutput = await runSupportProcessingPipelineV2Debug(
    input,
    {},
    {
      stopAfterStep,
      collectProgressEvents: true
    }
  );

  logSection("input", buildInputDisplay({
    input,
    testCase,
    fullInput: options.fullInput
  }));
  logSection("progressEvents", options.debug
    ? debugOutput.progressEvents
    : buildProgressSummary(debugOutput.progressEvents));
  logSection("partial", debugOutput.partial);

  if (debugOutput.output) {
    logSection("output", debugOutput.output);
  }

  logSection("debugStatus", {
    status: debugOutput.status,
    ...(debugOutput.stoppedAfterStep
      ? { stoppedAfterStep: debugOutput.stoppedAfterStep }
      : {})
  });

  return {
    input,
    debugOutput
  };
}

async function runAndLogCase(
  testCase: TextAnalysisDatasetCase,
  options: {
    until: DatasetStopStage;
    debug: boolean;
    fullInput: boolean;
  }
): Promise<boolean> {
  console.log(`\n=== ${testCase.id} - ${testCase.name} ===`);

  const result = await runCase(testCase, options);
  const datasetAssertions = buildDatasetAssertions({
    testCase,
    debugOutput: result.debugOutput
  });

  if (datasetAssertions) {
    logSection("datasetAssertions", datasetAssertions);

    if (datasetAssertions.status === "failed") {
      return false;
    }
  }

  return true;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--list")) {
    listCases();
    return;
  }

  const until = parseUntil(args);
  const debug = args.includes("--debug");
  const fullInput = args.includes("--full-input");
  const selectedCases = selectCases(args);
  let allPassed = true;

  for (const testCase of selectedCases) {
    const passed = await runAndLogCase(testCase, {
      until,
      debug,
      fullInput
    });

    allPassed = allPassed && passed;
  }

  if (!allPassed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
