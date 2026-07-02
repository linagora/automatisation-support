/**
 * Simple test runner for runMessageAnalysis
 *
 * Usage:
 *   npm run test:message-analysis -- --list
 *   npm run test:message-analysis -- --case 1
 *   npm run test:message-analysis -- --case 1,2
 *   npm run test:message-analysis -- --all
 *   npm run test:message-analysis -- --case 3 --attachment ./fixtures/images/image.png
 */

import "dotenv/config";

import * as fs from "fs";
import * as path from "path";

import {
  runMessageAnalysis
} from "../../src/archive/support-processing-pipeline/message-analysis/runMessageAnalysis";

import {
  messageAnalysisTestCases,
  withAttachment,
  type MessageAnalysisTestCase
} from "./dataset-message-analysis-test";

import type {
  LatestUserAttachment,
  MessageAnalysisInput
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
  console.log("\nAvailable message analysis test cases:\n");

  for (const testCase of messageAnalysisTestCases) {
    console.log(`  ${testCase.id}. ${testCase.label}`);
    console.log(`     ${testCase.description}`);
  }

  console.log("");
}

function parseSelectedCases(args: string[]): MessageAnalysisTestCase[] {
  if (args.includes("--all")) {
    return messageAnalysisTestCases;
  }

  const rawCaseIds = getArgValue(args, "--case");

  if (!rawCaseIds) {
    return [];
  }

  return rawCaseIds.split(",").map((caseId) => {
    const testCase = messageAnalysisTestCases.find(
      (candidate) => candidate.id === caseId.trim()
    );

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

    // Optional compatibility fields if other parts of the pipeline use them
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
  conversationHistory: MessageAnalysisInput["conversationHistory"]
): {
  contextLLM: string | undefined;
  events: unknown;
} {
  return {
    contextLLM: conversationHistory.contextLLM,
    events: sanitizeForLog([...conversationHistory])
  };
}

function serializeMessageAnalysisInputForLog(
  input: MessageAnalysisInput
): Record<string, unknown> {
  const sanitizedInput = sanitizeForLog(input) as Record<string, unknown>;

  return {
    ...sanitizedInput,
    conversationHistory: serializeConversationHistoryForLog(
      input.conversationHistory
    )
  };
}

async function runCase(
  testCase: MessageAnalysisTestCase,
  attachmentPath?: string
): Promise<void> {
  let finalTestCase = testCase;

  if (testCase.needsAttachment) {
    if (!attachmentPath) {
      throw new Error(
        `Case ${testCase.id} needs an attachment. Use --attachment ./fixtures/images/image.png`
      );
    }

    finalTestCase = withAttachment(
      testCase,
      buildAttachment(attachmentPath)
    );
  }

  console.log("\n============================================================");
  console.log(`runMessageAnalysis — Case ${finalTestCase.id}`);
  console.log("============================================================");
  console.log(`Label: ${finalTestCase.label}`);
  console.log(`Description: ${finalTestCase.description}`);

  console.log("\n--- Input ---");
  console.log(
    JSON.stringify(serializeMessageAnalysisInputForLog(finalTestCase.input), null, 2)
  );

  console.log("\n------------------------------------------------------------");
  console.log("Calling runMessageAnalysis...");
  console.log("------------------------------------------------------------\n");

  const startTime = Date.now();

  const output = await runMessageAnalysis(finalTestCase.input);

  const durationMs = Date.now() - startTime;

  console.log("\n--- Output ---");
  console.log(JSON.stringify(sanitizeForLog(output), null, 2));

  console.log(`\nDuration: ${durationMs}ms`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--list")) {
    listCases();
    return;
  }

  const attachmentPath = getArgValue(args, "--attachment");

  let selectedCases: MessageAnalysisTestCase[];

  try {
    selectedCases = parseSelectedCases(args);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    listCases();
    process.exit(1);
  }

  if (selectedCases.length === 0) {
    console.log("Usage:");
    console.log("  npm run test:message-analysis -- --list");
    console.log("  npm run test:message-analysis -- --case 1");
    console.log("  npm run test:message-analysis -- --case 1,2");
    console.log("  npm run test:message-analysis -- --all");
    console.log("  npm run test:message-analysis -- --case 3 --attachment ./fixtures/images/image.png");
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
