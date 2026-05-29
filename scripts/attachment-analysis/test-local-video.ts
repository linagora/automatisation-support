/**
 * Test local video analysis
 *
 * Usage:
 *   npm run test:local:video -- ./fixtures/videos/video1.webm
 *   npm run test:local:video -- ./fixtures/videos/video2.webm "Optional user message"
 */

import * as fs from "fs";
import * as path from "path";

import {
  requestVideoAnalysis
} from "../../src/support-processing-pipeline/message-analysis/attachment-analysis/requestVideoAnalysis";

import type {
  AttachmentAnalysis
} from "../../src/support-processing-pipeline/message-analysis/attachment-analysis/typesAttachmentAnalysis.types";

const SUPPORTED_VIDEO_EXTENSIONS = [
  ".mp4",
  ".mov",
  ".avi",
  ".webm",
  ".mkv"
];

const MIME_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".avi": "video/x-msvideo",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska"
};

function isSupportedVideoPath(filePath: string): boolean {
  const extension = path.extname(filePath).toLowerCase();

  return SUPPORTED_VIDEO_EXTENSIONS.includes(extension);
}

function parseArguments(args: string[]): {
  videoPath: string;
  latestUserMessage?: string;
} {
  const messageFlagIndex = args.indexOf("--message");

  if (messageFlagIndex !== -1) {
    return {
      videoPath: args[0],
      latestUserMessage:
        args.slice(messageFlagIndex + 1).join(" ") || undefined
    };
  }

  const [videoPath, ...messageParts] = args;

  return {
    videoPath,
    latestUserMessage:
      messageParts.length > 0
        ? messageParts.join(" ")
        : undefined
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  console.log("\n============================================================");
  console.log("Testing Local Video Analysis");
  console.log("============================================================\n");

  if (args.length === 0) {
    console.error("Usage:");
    console.error("  npm run test:local:video -- ./fixtures/videos/video1.webm");
    console.error("  npm run test:local:video -- ./fixtures/videos/video1.webm --message \"User message\"");
    process.exit(1);
  }

  const {
    videoPath,
    latestUserMessage
  } = parseArguments(args);

  const resolvedPath = path.resolve(videoPath);

  if (!isSupportedVideoPath(videoPath)) {
    console.error("Error: Unsupported video extension.");
    console.error(`Supported extensions: ${SUPPORTED_VIDEO_EXTENSIONS.join(", ")}`);
    process.exit(1);
  }

  if (!fs.existsSync(resolvedPath)) {
    console.error(`Error: File not found: ${resolvedPath}`);
    process.exit(1);
  }

  const stats = fs.statSync(resolvedPath);

  if (!stats.isFile()) {
    console.error(`Error: Not a file: ${resolvedPath}`);
    process.exit(1);
  }

  const extension = path.extname(resolvedPath).toLowerCase();
  const mimeType = MIME_TYPES[extension] || "video/mp4";

  const attachmentIndex = 1;

  const attachmentAnalysis: AttachmentAnalysis = [
    {
      attachmentIndex,
      filename: path.basename(resolvedPath),
      url: undefined,
      path: resolvedPath,
      type: undefined,
      mimeType,
      sizeBytes: stats.size,
      status: "analysis_pending",
      reason: undefined,
      readinessDecision: undefined,
      analysis: undefined
    }
  ];

  console.log("Preparing local video...");
  console.log(`  ✓ ${path.basename(resolvedPath)} (${(stats.size / 1024).toFixed(1)} KB)`);
  console.log(`  MIME type: ${mimeType}`);

  if (latestUserMessage) {
    console.log(`\nUser message: "${latestUserMessage}"`);
  }

  console.log("\n------------------------------------------------------------");
  console.log("Extracting frames and sending request to LLM...");
  console.log("------------------------------------------------------------\n");

  const startTime = Date.now();

  const result = await requestVideoAnalysis({
    attachmentIndex,
    latestUserMessage,
    attachmentAnalysis
  });

  const durationMs = Date.now() - startTime;

  console.log("\n============================================================");
  console.log("RESULT");
  console.log("============================================================");
  console.log(`Status: ${result.status}`);
  console.log(`Duration: ${durationMs}ms`);

  if (result.reason) {
    console.log(`Reason: ${result.reason}`);
  }

  if (result.analysis) {
    console.log("\n--- Analysis Output ---");
    console.log(JSON.stringify(result.analysis, null, 2));
  }

  console.log("\n============================================================");

  if (result.status === "analyzed" || result.status === "suspicious") {
    console.log("✅ SUCCESS: Local video analyzed successfully!");
  } else {
    console.log("❌ Video analysis failed");
  }
}

main().catch((error) => {
  console.error("\nUnexpected error:");
  console.error(error);
  process.exit(1);
});
