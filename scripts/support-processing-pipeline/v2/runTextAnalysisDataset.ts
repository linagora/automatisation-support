/**
 * Manual runner for the implemented V2 text analysis steps.
 *
 * Usage:
 *   npm run support:v2:text-dataset -- --list
 *   npm run support:v2:text-dataset
 *   npm run support:v2:text-dataset -- --case mixed
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
  textAnalysisDataset,
  type TextAnalysisDatasetCase
} from "./textAnalysisDataset";

import type {
  StandardResponseFragment,
  TextSurfaceAnalysis,
  TextUnderstanding
} from "../../../src/support-processing-pipeline/v2/typesSupportProcessingPipelineV2.types";

type CaseRunOutput = {
  promptSecuritySignals: unknown;
  turnAnalysisPlan: unknown;
  textSurfaceAnalysis: TextSurfaceAnalysis | "SKIPPED";
  standardResponseFragments: StandardResponseFragment[];
  textUnderstandings: TextUnderstanding[] | "SKIPPED";
  debug?: {
    textSurface?: TextSurfaceDebugInfo;
    supportText?: SupportTextDebugInfo;
  };
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
    sourceSegmentId?: string;
    unitIndex: number;
    reason: string;
  }[];
  removedSecondaryElements: {
    sourceSegmentId?: string;
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

function getArgValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

function listCases(): void {
  console.log("\nAvailable V2 text analysis dataset cases:\n");

  for (const testCase of textAnalysisDataset) {
    console.log(`  ${testCase.id} — ${testCase.name}`);
  }

  console.log("");
}

function selectCases(args: string[]): TextAnalysisDatasetCase[] {
  const caseName = getArgValue(args, "--case");

  if (!caseName) {
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

async function runCase(
  testCase: TextAnalysisDatasetCase,
  options: {
    debug: boolean;
  }
): Promise<CaseRunOutput> {
  const promptSecuritySignals = detectSuspiciousPromptPatterns({
    latestUserMessage: testCase.latestUserMessage
  });

  const turnAnalysisPlan = planTurnAnalysis({
    latestUserMessage: testCase.latestUserMessage,
    latestUserAttachments: testCase.latestUserAttachments,
    promptSecuritySignals,
    accountTrustStatus: testCase.accountTrustStatus
  });

  let textSurfaceAnalysis: TextSurfaceAnalysis | undefined;
  let textSurfaceDebug: TextSurfaceDebugInfo | undefined;

  if (turnAnalysisPlan.analyzeText) {
    assertPresetEnvConfigured({
      presetName: "quickDecision",
      prefix: "LLM_QUICK"
    });

    if (options.debug) {
      const latestUserMessageContent = testCase.latestUserMessage.content;
      const prompt = buildAnalyzeTextSurfacePrompt({
        latestUserMessageContent,
        turnAnalysisPlan,
        recentInteractionContext: testCase.recentInteractionContext
      });
      const rawTextSurfaceAnalysis = await requestTextSurfaceAnalysis({
        prompt
      });
      const formattedOutput = formatTextSurfaceAnalysisOutput({
        latestUserMessageContent,
        rawTextSurfaceAnalysis
      });

      if (formattedOutput.status === "valid") {
        textSurfaceAnalysis = formattedOutput.analysis;
      } else {
        textSurfaceAnalysis = buildFallbackTextSurfaceAnalysis({
          latestUserMessageContent,
          turnAnalysisPlan
        });
      }

      textSurfaceDebug = {
        fallbackUsed: formattedOutput.status !== "valid",
        ...(formattedOutput.status !== "valid"
          ? {
              fallbackReason: getFallbackReason({
                latestUserMessageContent,
                matchedPatternIds: turnAnalysisPlan.matchedPatternIds,
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
      };
    } else {
      textSurfaceAnalysis = await analyzeTextSurface({
        latestUserMessage: testCase.latestUserMessage,
        turnAnalysisPlan,
        recentInteractionContext: testCase.recentInteractionContext
      });
    }
  }

  const standardResponseFragments = buildStandardResponseFragments({
    turnAnalysisPlan,
    latestUserMessage: testCase.latestUserMessage,
    recentInteractionContext: testCase.recentInteractionContext,
    textSurfaceAnalysis,
    attachmentSurfaceAnalysis: []
  });

  const hasSupportSegments =
    textSurfaceAnalysis?.segments.some((segment) => {
      return segment.category === "support_relevant";
    }) === true;

  let textUnderstandings: TextUnderstanding[] | undefined;
  let supportTextDebug: SupportTextDebugInfo | undefined;

  if (textSurfaceAnalysis && hasSupportSegments) {
    assertPresetEnvConfigured({
      presetName: "fullWeightMessageAnalysis",
      prefix: "LLM_FULL"
    });

    if (options.debug) {
      const supportSegments = selectSupportSegments({
        turnAnalysisPlan,
        textSurfaceAnalysis,
        recentInteractionContext: testCase.recentInteractionContext,
        extractableFieldCatalog: testCase.extractableFieldCatalog
      });
      const prompt = buildAnalyzeSupportTextPrompt({
        supportSegments,
        recentInteractionContext: testCase.recentInteractionContext,
        extractableFieldCatalog: testCase.extractableFieldCatalog
      });
      const rawSupportTextAnalysis = await requestSupportTextAnalysis({
        prompt
      });
      const formattedOutput = formatSupportTextAnalysisOutputWithDebug({
        supportSegments,
        extractableFieldCatalog: testCase.extractableFieldCatalog,
        rawSupportTextAnalysis
      });

      textUnderstandings = formattedOutput.result.textUnderstandings;
      supportTextDebug = {
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
        removedSecondaryElements:
          formattedOutput.debug.removedSecondaryElements,
        segments: formattedOutput.debug.segments
      };
    } else {
      textUnderstandings = await analyzeSupportText({
        turnAnalysisPlan,
        textSurfaceAnalysis,
        recentInteractionContext: testCase.recentInteractionContext,
        extractableFieldCatalog: testCase.extractableFieldCatalog
      });
    }
  } else if (options.debug) {
    supportTextDebug = {
      callPerformed: false,
      fallbackScope: "none",
      rejectedUnits: [],
      removedSecondaryElements: [],
      segments: []
    };
  }

  return {
    promptSecuritySignals,
    turnAnalysisPlan,
    textSurfaceAnalysis: textSurfaceAnalysis
      ? compactTextSurfaceAnalysis(textSurfaceAnalysis)
      : "SKIPPED",
    standardResponseFragments,
    textUnderstandings: textUnderstandings ?? "SKIPPED",
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

async function runAndLogCase(
  testCase: TextAnalysisDatasetCase,
  options: {
    debug: boolean;
  }
): Promise<void> {
  console.log("\n============================================================");
  console.log(`CASE ${testCase.id} — ${testCase.name}`);
  console.log("============================================================");

  logSection("INPUT", {
    latestUserMessage: testCase.latestUserMessage,
    latestUserAttachments: testCase.latestUserAttachments,
    accountTrustStatus: testCase.accountTrustStatus,
    recentInteractionContext: testCase.recentInteractionContext,
    extractableFieldCatalogCount: testCase.extractableFieldCatalog.length,
    extractableFieldCatalog: testCase.extractableFieldCatalog
  });

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

  if (args.includes("--list")) {
    listCases();
    return;
  }

  let selectedCases: TextAnalysisDatasetCase[];

  try {
    selectedCases = selectCases(args);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    listCases();
    process.exitCode = 1;
    return;
  }

  for (const testCase of selectedCases) {
    await runAndLogCase(testCase, { debug });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
