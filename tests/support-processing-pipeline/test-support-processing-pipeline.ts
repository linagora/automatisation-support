/**
 * Simple test runner for runSupportProcessingPipeline
 *
 * Usage:
 *   npm run test:support-processing-pipeline -- --list
 *   npm run test:support-processing-pipeline -- --case 1
 *   npm run test:support-processing-pipeline -- --case 1,2
 *   npm run test:support-processing-pipeline -- --all
 *   npm run test:support-processing-pipeline -- --case 1 --attachment ./fixtures/images/image.png
 */

import "dotenv/config";

import * as fs from "fs";
import * as path from "path";

import {
  runSupportProcessingPipeline
} from "../../src/support-processing-pipeline/runSupportProcessingPipeline";

import {
  supportProcessingPipelineTestCases,
  withAttachment,
  type SupportProcessingPipelineTestCase
} from "./dataset-support-processing-pipeline-test";

import type {
  LatestUserAttachment
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
  console.log("\nAvailable support processing pipeline test cases:\n");

  for (const testCase of supportProcessingPipelineTestCases) {
    console.log(`  ${testCase.id}. ${testCase.label}`);
    console.log(`     ${testCase.description}`);
  }

  console.log("");
}

function parseSelectedCases(args: string[]): SupportProcessingPipelineTestCase[] {
  if (args.includes("--all")) {
    return supportProcessingPipelineTestCases;
  }

  const rawCaseIds = getArgValue(args, "--case");

  if (!rawCaseIds) {
    return [];
  }

  return rawCaseIds.split(",").map((caseId) => {
    const testCase = supportProcessingPipelineTestCases.find((candidate) => {
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
    filename: path.basename(resolvedPath),
    sizeInBytes: stats.size,
    accessUrl: fileToDataUrl(resolvedPath),
    channel: "email",
    sentAt: new Date().toISOString()
  };
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

async function runCase(
  testCase: SupportProcessingPipelineTestCase,
  attachmentPath?: string
): Promise<void> {
  let finalTestCase = testCase;

  if (attachmentPath) {
    finalTestCase = withAttachment(
      testCase,
      buildAttachment(attachmentPath)
    );
  }

  if (testCase.needsAttachment && !attachmentPath) {
    throw new Error(
      `Case ${testCase.id} needs an attachment. Use --attachment ./fixtures/images/image.png`
    );
  }

  console.log("\n============================================================");
  console.log(`runSupportProcessingPipeline - Case ${finalTestCase.id}`);
  console.log("============================================================");
  console.log(`Label: ${finalTestCase.label}`);
  console.log(`Description: ${finalTestCase.description}`);

  console.log("\n--- Input ---");
  console.log(JSON.stringify(sanitizeForLog(finalTestCase.input), null, 2));

  console.log("\n------------------------------------------------------------");
  console.log("Calling runSupportProcessingPipeline...");
  console.log("------------------------------------------------------------\n");

  const startTime = Date.now();

  const output = await runSupportProcessingPipeline(finalTestCase.input);

  const durationMs = Date.now() - startTime;

  console.log("\n--- Output ---");
  console.log(JSON.stringify(sanitizeForLog(output), null, 2));

  console.log("\n--- User response messages ---");
  console.log(
    JSON.stringify(sanitizeForLog(output.userResponse.messages), null, 2)
  );

  console.log("\n--- Patches ---");
  console.log(JSON.stringify(sanitizeForLog(output.patches), null, 2));

  console.log(`\nDuration: ${durationMs}ms`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--list")) {
    listCases();
    return;
  }

  const attachmentPath = getArgValue(args, "--attachment");

  let selectedCases: SupportProcessingPipelineTestCase[];

  try {
    selectedCases = parseSelectedCases(args);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    listCases();
    process.exit(1);
  }

  if (selectedCases.length === 0) {
    console.log("Usage:");
    console.log("  npm run test:support-processing-pipeline -- --list");
    console.log("  npm run test:support-processing-pipeline -- --case 1");
    console.log("  npm run test:support-processing-pipeline -- --case 1,2");
    console.log("  npm run test:support-processing-pipeline -- --all");
    console.log(
      "  npm run test:support-processing-pipeline -- --case 1 --attachment ./fixtures/images/image.png"
    );
    process.exit(1);
  }

  for (const testCase of selectedCases) {
    await runCase(testCase, attachmentPath);
  }
}

main().catch((error) => {
  console.error("\nUnexpected error:");
  console.error(error);
  process.exit(1);
});
