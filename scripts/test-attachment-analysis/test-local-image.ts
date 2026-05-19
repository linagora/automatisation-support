/**
 * Test local image analysis
 *
 * Usage:
 *   npm run test:local:image -- ./screen_error.png
 *   npm run test:local:image -- ./image1.png ./image2.jpg "Optional user message"
 */

import * as fs from "fs";
import * as path from "path";

import {
  runAttachmentAnalysis
} from "../../src/support-processing-pipeline/message-analysis/attachment-analysis/runAttachmentAnalysis";

const SUPPORTED_IMAGE_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp"
];

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp"
};

function isSupportedImagePath(filePath: string): boolean {
  const extension = path.extname(filePath).toLowerCase();

  return SUPPORTED_IMAGE_EXTENSIONS.includes(extension);
}

function fileToDataUrl(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  const mimeType = MIME_TYPES[extension];

  if (!mimeType) {
    throw new Error(`Unsupported image extension: ${extension}`);
  }

  const buffer = fs.readFileSync(filePath);

  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function parseArguments(args: string[]): {
  imagePaths: string[];
  latestUserMessage?: string;
} {
  const messageFlagIndex = args.indexOf("--message");

  if (messageFlagIndex !== -1) {
    return {
      imagePaths: args
        .slice(0, messageFlagIndex)
        .filter(isSupportedImagePath),
      latestUserMessage:
        args.slice(messageFlagIndex + 1).join(" ") || undefined
    };
  }

  const imagePaths: string[] = [];
  const messageParts: string[] = [];
  let isReadingMessage = false;

  for (const arg of args) {
    if (!isReadingMessage && isSupportedImagePath(arg)) {
      imagePaths.push(arg);
      continue;
    }

    isReadingMessage = true;
    messageParts.push(arg);
  }

  return {
    imagePaths,
    latestUserMessage:
      messageParts.length > 0
        ? messageParts.join(" ")
        : undefined
  };
}
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  console.log("\n============================================================");
  console.log("Testing Local Image Analysis");
  console.log("============================================================\n");

  if (args.length === 0) {
    console.error("Usage:");
    console.error("  npm run test:local:image -- ./screen_error.png");
    console.error("  npm run test:local:image -- ./screen_error.png --message \"User message\"");
    console.error("  npm run test:local:image -- ./image1.png ./image2.jpg --message \"User message\"");
    process.exit(1);
  }

  const {
    imagePaths,
    latestUserMessage
  } = parseArguments(args);

  if (imagePaths.length === 0) {
    console.error("Error: No supported local image provided.");
    console.error(`Supported extensions: ${SUPPORTED_IMAGE_EXTENSIONS.join(", ")}`);
    process.exit(1);
  }

  const latestUserAttachments = [];

  console.log(`Preparing ${imagePaths.length} local image(s)...`);

  for (const imagePath of imagePaths) {
    const resolvedPath = path.resolve(imagePath);

    if (!fs.existsSync(resolvedPath)) {
      console.error(`  ✗ ${imagePath}: File not found: ${resolvedPath}`);
      process.exit(1);
    }

    const stats = fs.statSync(resolvedPath);

    if (!stats.isFile()) {
      console.error(`  ✗ ${imagePath}: Not a file`);
      process.exit(1);
    }

    const extension = path.extname(resolvedPath).toLowerCase();
    const mimeType = MIME_TYPES[extension];

    const dataUrl = fileToDataUrl(resolvedPath);

    latestUserAttachments.push({
      name: path.basename(resolvedPath),
      mimeType,
      path: resolvedPath,
      url: dataUrl,
      sizeBytes: stats.size
    });

    console.log(`  ✓ ${path.basename(resolvedPath)} (${(stats.size / 1024).toFixed(1)} KB)`);
  }

  if (latestUserMessage) {
    console.log(`\nUser message: "${latestUserMessage}"`);
  }

  console.log("\n------------------------------------------------------------");
  console.log("Sending request to LLM...");
  console.log("------------------------------------------------------------\n");

  const startTime = Date.now();

  const attachmentAnalysis = await runAttachmentAnalysis({
    latestUserMessage,
    latestUserAttachments
  });

  const durationMs = Date.now() - startTime;

  console.log("\n============================================================");
  console.log("RESULT");
  console.log("============================================================");
  console.log(`Duration: ${durationMs}ms`);
  console.log(`Attachments: ${attachmentAnalysis.length}`);

  for (const attachmentAnalysisItem of attachmentAnalysis) {
    console.log("\n------------------------------------------------------------");
    console.log(`Attachment #${attachmentAnalysisItem.attachmentIndex}`);
    console.log(`Filename: ${attachmentAnalysisItem.filename}`);
    console.log(`Status: ${attachmentAnalysisItem.status}`);

    if (attachmentAnalysisItem.reason) {
      console.log(`Reason: ${attachmentAnalysisItem.reason}`);
    }

    if (attachmentAnalysisItem.analysis) {
      console.log("\n--- Analysis Output ---");
      console.log(JSON.stringify(attachmentAnalysisItem.analysis, null, 2));
    }
  }

  console.log("\n============================================================");

  const hasFailure = attachmentAnalysis.some(function (attachmentAnalysisItem) {
    return (
      attachmentAnalysisItem.status === "failed" ||
      attachmentAnalysisItem.status === "refused"
    );
  });

  if (!hasFailure) {
    console.log("✅ SUCCESS: Local image(s) analyzed successfully!");
  } else {
    console.log("❌ Some image attachment(s) were not analyzed");
  }
}

main().catch((error) => {
  console.error("\nUnexpected error:");
  console.error(error);
  process.exit(1);
});