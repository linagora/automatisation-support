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
 */

import "dotenv/config";

import * as fs from "fs";
import * as path from "path";

import {
  runSupportProcessingPipeline
} from "../../src/support-processing-pipeline/runSupportProcessingPipeline";
import {
  runMessageAnalysis
} from "../../src/support-processing-pipeline/message-analysis/runMessageAnalysis";
import {
  runSearchDecision
} from "../../src/support-processing-pipeline/search-decision/runSearchDecision";
import {
  runSolutionRetrieval
} from "../../src/support-processing-pipeline/solution-retrieval/runSolutionRetrieval";
import {
  runResponsePlan
} from "../../src/support-processing-pipeline/response-plan/runResponsePlan";
import {
  runResponseProduction
} from "../../src/support-processing-pipeline/response-production/runResponseProduction";

import {
  supportProcessingTestCases,
  withAttachment,
  type SupportProcessingTestCase
} from "./dataset-support-processing-test";

import type {
  LatestUserAttachment,
  SupportProcessingPipelineSteps
} from "../../src/support-processing-pipeline/typesSupportProcessingPipeline.types";

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

function logDebugStep(title: string, value: unknown): void {
  console.log(`\n--- DEBUG ${title} ---`);
  console.log(JSON.stringify(sanitizeForLog(value), null, 2));
}

function buildDebugSteps(enabled: boolean): SupportProcessingPipelineSteps {
  if (!enabled) {
    return {};
  }

  return {
    runMessageAnalysis: async (input) => {
      const output = await runMessageAnalysis(input);
      logDebugStep("runMessageAnalysis output / turnUnderstandingDelta", output);
      return output;
    },

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
}): SupportProcessingPipelineSteps {
  const steps = buildDebugSteps(params.debug);

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

  console.log("\n--- Input ---");
  console.log(JSON.stringify(sanitizeForLog(finalTestCase.input), null, 2));

  console.log("\n------------------------------------------------------------");
  console.log("Calling runSupportProcessingPipeline...");
  console.log("------------------------------------------------------------\n");

  const startTime = Date.now();
  const previousDebugValue = process.env.SUPPORT_PROCESSING_DEBUG;

  if (debug) {
    process.env.SUPPORT_PROCESSING_DEBUG = "true";
  }

  try {
    const output = await runSupportProcessingPipeline(
      finalTestCase.input,
      buildPipelineSteps({
        testCase: finalTestCase,
        debug,
        mockMessageAnalysis
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
    console.log(
      "  npm run test:support-processing -- --case 1 --mock-message-analysis --debug"
    );
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
