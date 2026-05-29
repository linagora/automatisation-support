/**
 * Test online image analysis
 *
 * Usage:
 *   npm run test:vision:online:image -- "https://example.com/image.png"
 *   npm run test:vision:online:image -- "https://example.com/image.png" "Optional user message"
 */

import * as path from "path";
import { runAttachmentAnalysis } from "../../src/support-processing-pipeline/message-analysis/attachment-analysis/runAttachmentAnalysis";

const SUPPORTED_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"];

const MIME_TYPES_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp"
};

function isHttpUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

function getExtensionFromUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    return path.extname(parsedUrl.pathname).toLowerCase();
  } catch {
    return "";
  }
}

function getFileNameFromUrl(url: string, index: number): string {
  try {
    const parsedUrl = new URL(url);
    const fileName = path.basename(parsedUrl.pathname);

    if (fileName && fileName.includes(".")) {
      return fileName;
    }
  } catch {
    // ignore
  }

  return `online-image-${index + 1}.png`;
}

function getMimeTypeFromUrl(url: string): string {
  const extension = getExtensionFromUrl(url);
  return MIME_TYPES_BY_EXTENSION[extension] || "image/png";
}

function isSupportedImageUrl(url: string): boolean {
  const extension = getExtensionFromUrl(url);

  if (!extension) {
    return true;
  }

  return SUPPORTED_IMAGE_EXTENSIONS.includes(extension);
}

async function getRemoteFileSizeBytes(url: string): Promise<number> {
  try {
    const headResponse = await fetch(url, { method: "HEAD" });
    const contentLength = headResponse.headers.get("content-length");

    if (contentLength) {
      const size = Number(contentLength);

      if (Number.isFinite(size) && size > 0) {
        return size;
      }
    }
  } catch {
    // fallback to GET below
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch image URL ${url}: HTTP ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return arrayBuffer.byteLength;
}

function parseArguments(args: string[]): {
  imageUrls: string[];
  latestUserMessage?: string;
} {
  const imageUrls: string[] = [];
  const messageParts: string[] = [];
  let isReadingMessage = false;

  for (const arg of args) {
    if (!isReadingMessage && isHttpUrl(arg)) {
      imageUrls.push(arg);
      continue;
    }

    isReadingMessage = true;
    messageParts.push(arg);
  }

  return {
    imageUrls,
    latestUserMessage: messageParts.length > 0 ? messageParts.join(" ") : undefined
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  console.log("\n============================================================");
  console.log("Testing Online Image Analysis");
  console.log("============================================================\n");

  if (args.length === 0) {
    console.error("Usage:");
    console.error("  npm run test:vision:online:image -- \"https://example.com/image.png\"");
    console.error("  npm run test:vision:online:image -- \"https://example.com/image.png\" \"Optional user message\"");
    process.exit(1);
  }

  const { imageUrls, latestUserMessage } = parseArguments(args);

  if (imageUrls.length === 0) {
    console.error("Error: No image URL provided.");
    process.exit(1);
  }

  const attachments = [];

  console.log(`Preparing ${imageUrls.length} online image(s)...`);

  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i];

    if (!isSupportedImageUrl(url)) {
      console.error(`  ✗ ${url}: Unsupported image extension`);
      process.exit(1);
    }

    const sizeBytes = await getRemoteFileSizeBytes(url);
    const mimeType = getMimeTypeFromUrl(url);
    const name = getFileNameFromUrl(url, i);

    attachments.push({
      name,
      mimeType,
      url,
      sizeBytes
    });

    console.log(`  ✓ ${name} (${(sizeBytes / 1024).toFixed(1)} KB)`);
  }

  if (latestUserMessage) {
    console.log(`\nUser message: "${latestUserMessage}"`);
  }

  console.log("\n------------------------------------------------------------");
  console.log("Sending request to LLM...");
  console.log("------------------------------------------------------------\n");

  const startTime = Date.now();

  const result = await runAttachmentAnalysis({
    attachments,
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

  console.log(`\nAnalyzable attachments: ${result.analyzableAttachments.length}`);
  console.log(`Ignored attachments: ${result.ignoredAttachments.length}`);

  if (result.analysis) {
    console.log("\n--- Analysis Output ---");
    console.log(JSON.stringify(result.analysis.extractedInformations, null, 2));
  }

  console.log("\n============================================================");

  if (result.status === "analyzed") {
    console.log("✅ SUCCESS: Online image(s) analyzed successfully!");
  } else {
    console.log("❌ Analysis not available");
  }
}

main().catch((error) => {
  console.error("\nUnexpected error:");
  console.error(error);
  process.exit(1);
});