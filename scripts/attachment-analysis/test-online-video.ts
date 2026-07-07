/**
 * Test online video analysis
 *
 * Usage:
 *   npm run test:vision:online:video -- "https://example.com/video.webm"
 *   npm run test:vision:online:video -- "https://example.com/video.mp4" "Optional user message"
 */

import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { requestVideoAnalysis } from "../../src/archive/support-processing-pipeline/message-analysis/attachment-analysis/requestVideoAnalysis";

const SUPPORTED_VIDEO_EXTENSIONS = [".mp4", ".mov", ".avi", ".webm", ".mkv"];

const MIME_TYPES_BY_EXTENSION: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".avi": "video/x-msvideo",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska"
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

function getFileNameFromUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    const fileName = path.basename(parsedUrl.pathname);

    if (fileName && fileName.includes(".")) {
      return fileName;
    }
  } catch {
    // ignore
  }

  return "online-video.mp4";
}

function getMimeTypeFromUrl(url: string): string {
  const extension = getExtensionFromUrl(url);
  return MIME_TYPES_BY_EXTENSION[extension] || "video/mp4";
}

function isSupportedVideoUrl(url: string): boolean {
  const extension = getExtensionFromUrl(url);

  if (!extension) {
    return true;
  }

  return SUPPORTED_VIDEO_EXTENSIONS.includes(extension);
}

function parseArguments(args: string[]): {
  videoUrl: string;
  latestUserMessage?: string;
} {
  const [videoUrl, ...messageParts] = args;

  return {
    videoUrl,
    latestUserMessage: messageParts.length > 0 ? messageParts.join(" ") : undefined
  };
}

async function downloadVideoToTempFile(videoUrl: string): Promise<{
  filePath: string;
  fileName: string;
  sizeBytes: number;
}> {
  const response = await fetch(videoUrl);

  if (!response.ok) {
    throw new Error(`Failed to download video: HTTP ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const fileName = getFileNameFromUrl(videoUrl);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "online-video-"));
  const filePath = path.join(tempDir, fileName);

  await fs.writeFile(filePath, buffer);

  return {
    filePath,
    fileName,
    sizeBytes: buffer.length
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  console.log("\n============================================================");
  console.log("Testing Online Video Analysis");
  console.log("============================================================\n");

  if (args.length === 0) {
    console.error("Usage:");
    console.error("  npm run test:vision:online:video -- \"https://example.com/video.webm\"");
    console.error("  npm run test:vision:online:video -- \"https://example.com/video.mp4\" \"Optional user message\"");
    process.exit(1);
  }

  const { videoUrl, latestUserMessage } = parseArguments(args);

  if (!isHttpUrl(videoUrl)) {
    console.error("Error: First argument must be an HTTP or HTTPS video URL.");
    process.exit(1);
  }

  if (!isSupportedVideoUrl(videoUrl)) {
    console.error(`Error: Unsupported video extension.`);
    console.error(`Supported extensions: ${SUPPORTED_VIDEO_EXTENSIONS.join(", ")}`);
    process.exit(1);
  }

  let downloadedFilePath: string | null = null;

  try {
    console.log("Downloading online video...");

    const downloadedVideo = await downloadVideoToTempFile(videoUrl);
    downloadedFilePath = downloadedVideo.filePath;

    const mimeType = getMimeTypeFromUrl(videoUrl);

    const attachment = {
      name: downloadedVideo.fileName,
      mimeType,
      path: downloadedVideo.filePath,
      sizeBytes: downloadedVideo.sizeBytes
    };

    console.log(`  ✓ ${attachment.name} (${(attachment.sizeBytes / 1024).toFixed(1)} KB)`);
    console.log(`  MIME type: ${mimeType}`);
    console.log(`  Temp path: ${downloadedVideo.filePath}`);

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
      console.log("✅ SUCCESS: Online video analyzed successfully!");
    } else {
      console.log("❌ Video analysis not available");
    }
  } finally {
    if (downloadedFilePath) {
      const tempDir = path.dirname(downloadedFilePath);
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  console.error("\nUnexpected error:");
  console.error(error);
  process.exit(1);
});