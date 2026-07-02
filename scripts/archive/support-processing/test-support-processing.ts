/**
 * Simple end-to-end test runner for runSupportProcessingPipeline
 *
 * Usage:
 *   npm run test:support-processing -- --list
 *   npm run test:support-processing -- --case 1
 *   npm run test:support-processing -- --case 1,2
 *   npm run test:support-processing -- --all
 *   npm run test:support-processing -- --case 3 --attachment ./fixtures/images/image.png
 *   npm run test:support-processing -- --case 1 --debug
 *   npm run test:support-processing -- --case 1 --mock-message-analysis --debug
 *   npm run test:support-processing -- --case 4
 *   npm run test:support-processing -- --case 4 --debug
 *
 * Note:
 *   Case 4 makes a real LLM truster call.
 *   Do not use --mock-message-analysis to test the LLM truster integration.
 */

import "dotenv/config";

import * as fs from "fs";
import * as path from "path";

import {
  runSupportProcessingPipeline
} from "../../src/archive/support-processing-pipeline/runSupportProcessingPipeline";
import {
  runMessageAnalysis
} from "../../src/archive/support-processing-pipeline/message-analysis/runMessageAnalysis";
import {
  runSearchDecision
} from "../../src/archive/support-processing-pipeline/search-decision/runSearchDecision";
import {
  runSolutionRetrieval
} from "../../src/archive/support-processing-pipeline/solution-retrieval/runSolutionRetrieval";
import {
  runResponsePlan
} from "../../src/archive/support-processing-pipeline/response-plan/runResponsePlan";
import {
  runResponseProduction
} from "../../src/archive/support-processing-pipeline/response-production/runResponseProduction";

import {
  supportProcessingTestCases,
  withAttachment,
  type SupportProcessingTestCase
} from "./dataset-support-processing-test";

import type {
  LatestUserAttachment,
  SupportProcessingPipelineInput,
  SupportProcessingPipelineSteps
} from "../../src/archive/support-processing-pipeline/typesSupportProcessingPipeline.types";

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm"
};

function getArgValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

function listCases(): void {
  console.log("\nAvailable support processing end-to-end test cases:\n");

  for (const testCase of supportProcessingTestCases) {
    console.log(`  ${testCase.id}. ${testCase.label}`);
    console.log(`     ${testCase.description}`);
  }

  console.log("");
}

function parseSelectedCases(args: string[]): SupportProcessingTestCase[] {
  if (args.includes("--all")) {
    return supportProcessingTestCases;
  }

  const rawCaseIds = getArgValue(args, "--case");

  if (!rawCaseIds) {
    return [];
  }

  return rawCaseIds.split(",").map((caseId) => {
    const testCase = supportProcessingTestCases.find((candidate) => {
      return candidate.id === caseId.trim();
    });

    if (!testCase) {
      throw new Error(`Unknown test case id: ${caseId}`);
    }

    return testCase;
  });
}

function fileToDataUrl(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  const mimeType = MIME_TYPES[extension];

  if (!mimeType) {
    throw new Error(`Unsupported file extension: ${extension}`);
  }

  const buffer = fs.readFileSync(filePath);
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function buildAttachment(filePath: string): LatestUserAttachment {
  const resolvedPath = path.resolve(filePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Attachment not found: ${resolvedPath}`);
  }

  const stats = fs.statSync(resolvedPath);
  const extension = path.extname(resolvedPath).toLowerCase();
  const mimeType = MIME_TYPES[extension];

  if (!mimeType) {
    throw new Error(`Unsupported file extension: ${extension}`);
  }

  return {
    id: "local_attachment_1",

    // Fields expected by runAttachmentAnalysis
    name: path.basename(resolvedPath),
    mimeType,
    path: resolvedPath,
    url: fileToDataUrl(resolvedPath),
    sizeBytes: stats.size,

    // Compatibility fields for the shared pipeline input type
    filename: path.basename(resolvedPath),
    accessUrl: fileToDataUrl(resolvedPath),
    sizeInBytes: stats.size,

    channel: "email",
    sentAt: new Date().toISOString()
  } as unknown as LatestUserAttachment;
}

function sanitizeForLog(value: unknown): unknown {
  if (typeof value === "string") {
    if (value.startsWith("data:")) {
      return `[data-url omitted, length=${value.length}]`;
    }

    if (value.length > 500) {
      return `${value.slice(0, 500)}...[truncated, length=${value.length}]`;
    }

    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeForLog);
  }

  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value)) {
      if (
        key === "url" ||
        key === "accessUrl" ||
        key === "dataUrl" ||
        key === "base64"
      ) {
        output[key] =
          typeof item === "string"
            ? `[omitted, length=${item.length}]`
            : "[omitted]";
      } else {
        output[key] = sanitizeForLog(item);
      }
    }

    return output;
  }

  return value;
}

function serializeConversationHistoryForLog(
  conversationHistory: SupportProcessingPipelineInput["conversationHistory"]
): {
  contextLLM: string | undefined;
  events: unknown;
} {
  return {
    contextLLM: conversationHistory.contextLLM,
    events: sanitizeForLog([...conversationHistory])
  };
}

function serializeSupportProcessingInputForLog(
  input: SupportProcessingPipelineInput
): Record<string, unknown> {
  const sanitizedInput = sanitizeForLog(input) as Record<string, unknown>;

  return {
    ...sanitizedInput,
    conversationHistory: serializeConversationHistoryForLog(
      input.conversationHistory
    )
  };
}

function logDebugStep(title: string, value: unknown): void {
  console.log(`\n--- DEBUG ${title} ---`);
  console.log(JSON.stringify(sanitizeForLog(value), null, 2));
}

function logConversationHistoryContextLLM(
  conversationHistory: unknown
): void {
  const contextLLM =
    typeof conversationHistory === "object" &&
    conversationHistory !== null &&
    "contextLLM" in conversationHistory
      ? (conversationHistory as { contextLLM?: unknown }).contextLLM
      : undefined;

  console.log("\n--- DEBUG conversationHistory.contextLLM ---");
  console.log(
    typeof contextLLM === "string" && contextLLM.trim() !== ""
      ? contextLLM
      : "No compact conversation history provided."
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function findLlmReview(
  value: unknown
): { route?: string; reason?: string } | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const llmReview = value.llmReview;

  if (isRecord(llmReview)) {
    const route =
      typeof llmReview.route === "string" ? llmReview.route : undefined;
    const reason =
      typeof llmReview.reason === "string" ? llmReview.reason : undefined;

    if (route) {
      return {
        route,
        ...(reason ? { reason } : {})
      };
    }
  }

  for (const item of Object.values(value)) {
    if (Array.isArray(item)) {
      for (const arrayItem of item) {
        const found = findLlmReview(arrayItem);

        if (found) {
          return found;
        }
      }
    } else {
      const found = findLlmReview(item);

      if (found) {
        return found;
      }
    }
  }

  return undefined;
}

function findSecurityDecisionRoute(
  value: unknown
): "continue" | "stop" | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const decision = value.decision;

  if (isRecord(decision)) {
    const route = decision.route;

    if (route === "continue" || route === "stop") {
      return route;
    }
  }

  for (const item of Object.values(value)) {
    if (Array.isArray(item)) {
      for (const arrayItem of item) {
        const found = findSecurityDecisionRoute(arrayItem);

        if (found) {
          return found;
        }
      }
    } else {
      const found = findSecurityDecisionRoute(item);

      if (found) {
        return found;
      }
    }
  }

  return undefined;
}

function runExpectationAssertions(params: {
  testCase: SupportProcessingTestCase;
  capturedTurnUnderstandingDelta: unknown;
  output: Awaited<ReturnType<typeof runSupportProcessingPipeline>>;
}): boolean {
  const expected = params.testCase.expected;

  if (!expected) {
    return true;
  }

  let succeeded = true;

  console.log("\n--- Assertions ---");

  if (params.capturedTurnUnderstandingDelta === undefined) {
    console.log("❌ Captured turnUnderstandingDelta is missing");
    succeeded = false;
  } else {
    console.log("✅ Captured turnUnderstandingDelta found");
  }

  const llmReview = findLlmReview(params.capturedTurnUnderstandingDelta);

  if (expected.shouldUseLlmTruster) {
    if (llmReview) {
      console.log("✅ LLM truster review found");
    } else {
      console.log("❌ LLM truster review missing");
      succeeded = false;
    }
  }

  if (expected.expectedLlmReviewRoute) {
    if (llmReview?.route === expected.expectedLlmReviewRoute) {
      console.log(`✅ LLM truster route = ${expected.expectedLlmReviewRoute}`);
    } else {
      console.log(
        `❌ LLM truster route expected ${expected.expectedLlmReviewRoute}, got ${llmReview?.route ?? "missing"}`
      );
      succeeded = false;
    }
  }

  if (expected.expectedFinalSecurityRoute) {
    const finalSecurityRoute = findSecurityDecisionRoute(
      params.capturedTurnUnderstandingDelta
    );

    if (finalSecurityRoute === expected.expectedFinalSecurityRoute) {
      console.log(`✅ Final security route = ${expected.expectedFinalSecurityRoute}`);
    } else {
      console.log(
        `❌ Final security route expected ${expected.expectedFinalSecurityRoute}, got ${finalSecurityRoute ?? "missing"}`
      );
      succeeded = false;
    }
  }

  if (expected.minUserResponseMessages !== undefined) {
    const messageCount = params.output.userResponse.messages.length;

    if (messageCount >= expected.minUserResponseMessages) {
      console.log(
        `✅ userResponse.messages length >= ${expected.minUserResponseMessages}`
      );
    } else {
      console.log(
        `❌ userResponse.messages length expected >= ${expected.minUserResponseMessages}, got ${messageCount}`
      );
      succeeded = false;
    }
  }

  if (!succeeded) {
    process.exitCode = 1;
  }

  return succeeded;
}

function buildDebugSteps(params: {
  enabled: boolean;
  captureMessageAnalysisOutput?: (output: unknown) => void;
}): SupportProcessingPipelineSteps {
  const steps: SupportProcessingPipelineSteps = {};

  if (params.enabled || params.captureMessageAnalysisOutput) {
    steps.runMessageAnalysis = async (input) => {
      const output = await runMessageAnalysis(input);

      params.captureMessageAnalysisOutput?.(output);

      if (params.enabled) {
        logDebugStep("runMessageAnalysis output / turnUnderstandingDelta", output);
      }

      return output;
    };
  }

  if (!params.enabled) {
    return steps;
  }

  return {
    ...steps,

    runSearchDecision: async (input) => {
      logDebugStep("runSearchDecision input", input);
      const output = await runSearchDecision(input);
      logDebugStep("runSearchDecision output", output);
      return output;
    },

    runSolutionRetrieval: async (input) => {
      logDebugStep("runSolutionRetrieval input", input);
      const output = await runSolutionRetrieval(input);
      logDebugStep("runSolutionRetrieval output", output);
      return output;
    },

    runResponsePlan: (input) => {
      logDebugStep("runResponsePlan input", input);
      const output = runResponsePlan(input);
      logDebugStep("runResponsePlan output", output);
      return output;
    },

    runResponseProduction: (input) => {
      const output = runResponseProduction(input);
      logDebugStep("runResponseProduction output", output);
      return output;
    }
  };
}

function buildPipelineSteps(params: {
  testCase: SupportProcessingTestCase;
  debug: boolean;
  mockMessageAnalysis: boolean;
  captureMessageAnalysisOutput?: (output: unknown) => void;
}): SupportProcessingPipelineSteps {
  const shouldCaptureMessageAnalysisOutput =
    params.debug || params.testCase.expected !== undefined;
  const steps = buildDebugSteps({
    enabled: params.debug,
    captureMessageAnalysisOutput: shouldCaptureMessageAnalysisOutput
      ? params.captureMessageAnalysisOutput
      : undefined
  });

  if (!params.mockMessageAnalysis) {
    return steps;
  }

  if (!params.testCase.mockedTurnUnderstandingDelta) {
    throw new Error(
      `Case ${params.testCase.id} does not define mockedTurnUnderstandingDelta`
    );
  }

  return {
    ...steps,
    runMessageAnalysis: async () => {
      const output = params.testCase.mockedTurnUnderstandingDelta;

      params.captureMessageAnalysisOutput?.(output);

      if (params.debug) {
        logDebugStep(
          "runMessageAnalysis mocked output / turnUnderstandingDelta",
          output
        );
      }

      return output;
    }
  };
}

async function runCase(
  testCase: SupportProcessingTestCase,
  attachmentPath?: string,
  debug = false,
  mockMessageAnalysis = false
): Promise<void> {
  let finalTestCase = testCase;

  if (testCase.needsAttachment) {
    if (!attachmentPath) {
      throw new Error(
        `Case ${testCase.id} needs an attachment. Use --attachment ./fixtures/images/image.png`
      );
    }
  }

  if (attachmentPath) {
    finalTestCase = withAttachment(
      testCase,
      buildAttachment(attachmentPath)
    );
  }

  console.log("\n============================================================");
  console.log(`runSupportProcessingPipeline - Case ${finalTestCase.id}`);
  console.log("============================================================");
  console.log(`Label: ${finalTestCase.label}`);
  console.log(`Description: ${finalTestCase.description}`);
  console.log(
    `Message analysis: ${mockMessageAnalysis ? "mocked" : "real LLM"}`
  );

  if (
    mockMessageAnalysis &&
    finalTestCase.expected?.shouldUseLlmTruster === true
  ) {
    console.log(
      "⚠️  Warning: --mock-message-analysis bypasses real security checks and does not test the LLM truster."
    );
  }

  console.log("\n--- Input ---");
  console.log(
    JSON.stringify(
      serializeSupportProcessingInputForLog(finalTestCase.input),
      null,
      2
    )
  );

  if (debug) {
    logConversationHistoryContextLLM(finalTestCase.input.conversationHistory);
  }

  console.log("\n------------------------------------------------------------");
  console.log("Calling runSupportProcessingPipeline...");
  console.log("------------------------------------------------------------\n");

  const startTime = Date.now();
  const previousDebugValue = process.env.SUPPORT_PROCESSING_DEBUG;
  let capturedTurnUnderstandingDelta: unknown;

  if (debug) {
    process.env.SUPPORT_PROCESSING_DEBUG = "true";
  }

  try {
    const output = await runSupportProcessingPipeline(
      finalTestCase.input,
      buildPipelineSteps({
        testCase: finalTestCase,
        debug,
        mockMessageAnalysis,
        captureMessageAnalysisOutput: (output) => {
          capturedTurnUnderstandingDelta = output;
        }
      })
    );

    const durationMs = Date.now() - startTime;

    console.log("\n--- User response messages ---");
    console.log(
      JSON.stringify(sanitizeForLog(output.userResponse.messages), null, 2)
    );

    console.log("\n--- Patches ---");
    console.log(JSON.stringify(sanitizeForLog(output.patches), null, 2));

    console.log("\n--- Output ---");
    console.log(JSON.stringify(sanitizeForLog(output), null, 2));

    runExpectationAssertions({
      testCase: finalTestCase,
      capturedTurnUnderstandingDelta,
      output
    });

    console.log(`\nDuration: ${durationMs}ms`);
  } finally {
    if (previousDebugValue === undefined) {
      delete process.env.SUPPORT_PROCESSING_DEBUG;
    } else {
      process.env.SUPPORT_PROCESSING_DEBUG = previousDebugValue;
    }
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--list")) {
    listCases();
    return;
  }

  const attachmentPath = getArgValue(args, "--attachment");
  const debug = args.includes("--debug");
  const mockMessageAnalysis = args.includes("--mock-message-analysis");

  let selectedCases: SupportProcessingTestCase[];

  try {
    selectedCases = parseSelectedCases(args);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    listCases();
    process.exit(1);
  }

  if (selectedCases.length === 0) {
    console.log("Usage:");
    console.log("  npm run test:support-processing -- --list");
    console.log("  npm run test:support-processing -- --case 1");
    console.log("  npm run test:support-processing -- --case 1,2");
    console.log("  npm run test:support-processing -- --all");
    console.log("  npm run test:support-processing -- --case 3 --attachment ./fixtures/images/image.png");
    console.log("  npm run test:support-processing -- --case 1 --debug");
    console.log("  npm run test:support-processing -- --case 4");
    console.log("  npm run test:support-processing -- --case 4 --debug");
    console.log(
      "  npm run test:support-processing -- --case 1 --mock-message-analysis --debug"
    );
    console.log("");
    console.log("Note: case 4 makes a real LLM truster call.");
    console.log("Do not use --mock-message-analysis to test LLM truster integration.");
    process.exit(1);
  }

  for (const testCase of selectedCases) {
    await runCase(testCase, attachmentPath, debug, mockMessageAnalysis);
  }
}

main().catch((error) => {
  console.error("\nUnexpected error:");
  console.error(error);
  process.exit(1);
});
