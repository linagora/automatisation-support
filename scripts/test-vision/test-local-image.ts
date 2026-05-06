/**
 * Test script for visual attachment analysis with local images
 *
 * This script converts a local image file to base64 and sends it to the LLM.
 *
 * Usage:
 *   npx tsx scripts/test-vision/test-local-image.ts <path-to-image> [user-message]
 *
 * Examples:
 *   npx tsx scripts/test-vision/test-local-image.ts ./my-screenshot.png
 *   npx tsx scripts/test-vision/test-local-image.ts ./error-screenshot.jpg "What's this error?"
 */

import * as fs from "fs";
import * as path from "path";
import { runAttachmentDescriptionLLM } from "../../src/support-processing-pipeline/message-analysis/attachement-description-llm/runAttachmentDescriptionLLM";

/**
 * Convert a local image file to a data URL
 * @param filePath - Path to the image file
 * @returns Data URL string
 */
function imageToDataUrl(filePath: string): string {
  const resolvedPath = path.resolve(filePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File not found: ${resolvedPath}`);
  }

  const buffer = fs.readFileSync(resolvedPath);
  const base64 = buffer.toString("base64");

  // Determine mime type from extension
  const ext = path.extname(resolvedPath).toLowerCase();
  const mimeTypeMap: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp"
  };

  const mimeType = mimeTypeMap[ext] || "image/png";

  return `data:${mimeType};base64,${base64}`;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Usage: npx tsx scripts/test-vision/test-local-image.ts <path-to-image> [user-message]

Examples:
  # Test with a local image
  npx tsx scripts/test-vision/test-local-image.ts ./screenshot.png

  # Test with a message for context
  npx tsx scripts/test-vision/test-local-image.ts ./error.jpg "What's wrong with this error?"

  # Test with multiple images
  npx tsx scripts/test-vision/test-local-image.ts ./img1.png ./img2.png "Compare these"

Supported formats: .png, .jpg, .jpeg, .gif, .webp, .bmp
`);
    process.exit(1);
  }

  // Separate file paths from the user message
  const imagePaths: string[] = [];
  let userMessage = "";

  for (const arg of args) {
    const ext = path.extname(arg).toLowerCase();
    const isImageFile = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"].includes(ext);

    if (isImageFile || fs.existsSync(arg)) {
      imagePaths.push(arg);
    } else {
      // Everything after the first non-image is considered the user message
      if (userMessage) {
        userMessage += " ";
      }
      userMessage += arg;
    }
  }

  if (imagePaths.length === 0) {
    console.error("Error: Please provide at least one image file path");
    process.exit(1);
  }

  console.log("\n" + "=".repeat(60));
  console.log("Testing Visual Attachment Analysis (Local Images)");
  console.log("=".repeat(60) + "\n");

  console.log(`Converting ${imagePaths.length} image(s) to data URLs...`);

  const dataUrls: string[] = [];
  for (const imagePath of imagePaths) {
    try {
      const dataUrl = imageToDataUrl(imagePath);
      console.log(`  ✓ ${path.basename(imagePath)} (${(dataUrl.length / 1024).toFixed(1)} KB)`);
      dataUrls.push(dataUrl);
    } catch (error) {
      console.error(`  ✗ ${imagePath}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  if (dataUrls.length === 0) {
    console.error("\nError: Could not convert any images");
    process.exit(1);
  }

  if (userMessage) {
    console.log(`\nUser message: "${userMessage}"`);
  }

  console.log("\n" + "-".repeat(60));
  console.log("Sending request to LLM...");
  console.log("-".repeat(60) + "\n");

  const startTime = Date.now();

  try {
    const result = await runAttachmentDescriptionLLM({
      attachments: dataUrls.map((url, index) => ({
        name: `image-${index + 1}.${path.extname(imagePaths[index]).slice(1)}`,
        mimeType: "image/png",
        url: url
      })),
      latestUserMessage: userMessage || undefined
    });

    const duration = Date.now() - startTime;

    console.log(`\n${"=".repeat(60)}`);
    console.log("RESULT");
    console.log("=".repeat(60));
    console.log(`Status: ${result.status}`);
    console.log(`Duration: ${duration}ms`);

    if (result.reason) {
      console.log(`Reason: ${result.reason}`);
    }

    console.log(`\nAnalyzable attachments: ${result.analyzableAttachments.length}`);
    console.log(`Ignored attachments: ${result.ignoredAttachments.length}`);

    if (result.analysis) {
      console.log("\n--- Analysis Output ---");
      console.log(JSON.stringify(result.analysis.extractedInformations, null, 2));
    }

    console.log("\n" + "=".repeat(60));

    if (result.status === "analyzed") {
      console.log("✅ SUCCESS: Image(s) analyzed successfully!");
    } else {
      console.log("❌ Analysis not available");
      process.exit(1);
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`\n${"=".repeat(60)}`);
    console.error("ERROR");
    console.error("=".repeat(60));
    console.error(`Duration: ${duration}ms`);

    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
      console.error(`Stack: ${error.stack}`);
    } else {
      console.error(`Unknown error: ${error}`);
    }

    process.exit(1);
  }
}

main();
