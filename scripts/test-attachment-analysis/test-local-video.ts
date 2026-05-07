/**
 * Test local video analysis
 *
 * Usage:
 *   npm run test:vision:local:video -- ./video.webm
 *   npm run test:vision:local:video -- ./video.mp4 "Optional user message"
 */

import * as fs from "fs";
import * as path from "path";
import { requestVideoAnalysis } from "../../src/support-processing-pipeline/message-analysis/attachment-analysis/requestVideoAnalysis";

const SUPPORTED_VIDEO_EXTENSIONS = [".mp4", ".mov", ".avi", ".webm", ".mkv"];

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
  const [videoPath, ...messageParts] = args;

  return {
    videoPath,
    latestUserMessage: messageParts.length > 0 ? messageParts.join(" ") : undefined
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  console.log("\n============================================================");
  console.log("Testing Local Video Analysis");
  console.log("============================================================\n");

  if (args.length === 0) {
    console.error("Usage:");
    console.error("  npm run test:vision:local:video -- ./video.webm");
    console.error("  npm run test:vision:local:video -- ./video.mp4 \"Optional user message\"");
    process.exit(1);
  }

  const { videoPath, latestUserMessage } = parseArguments(args);
  const resolvedPath = path.resolve(videoPath);

  if (!isSupportedVideoPath(videoPath)) {
    console.error(`Error: Unsupported video extension.`);
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

  const attachment = {
    name: path.basename(resolvedPath),
    mimeType,
    path: resolvedPath,
    sizeBytes: stats.size
  };

  console.log("Preparing local video...");
  console.log(`  ✓ ${attachment.name} (${(stats.size / 1024).toFixed(1)} KB)`);
  console.log(`  MIME type: ${mimeType}`);

  if (latestUserMessage) {
    console.log(`\nUser message: "${latestUserMessage}"`);
  }

  console.log("\n------------------------------------------------------------");
  console.log("Extracting frames and sending request to LLM...");
  console.log("------------------------------------------------------------\n");

  const startTime = Date.now();

  const result = await requestVideoAnalysis({
    attachments: [attachment],
    latestUserMessage
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
    console.log(JSON.stringify(result.analysis.extractedInformations, null, 2));
  }

  console.log("\n============================================================");

  if (result.status === "analyzed") {
    console.log("✅ SUCCESS: Local video analyzed successfully!");
  } else {
    console.log("❌ Video analysis not available");
  }
}

main().catch((error) => {
  console.error("\nUnexpected error:");
  console.error(error);
  process.exit(1);
});