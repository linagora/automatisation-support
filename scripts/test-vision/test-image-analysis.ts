/**
 * Test script for visual attachment analysis
 *
 * Usage:
 *   npx tsx scripts/test-vision/test-image-analysis.ts <image-url> [user-message]
 *
 * Examples:
 *   npx tsx scripts/test-vision/test-image-analysis.ts "https://example.com/image.png"
 *   npx tsx scripts/test-vision/test-image-analysis.ts "https://example.com/screenshot.png" "What's wrong with this error?"
 */

import { runAttachmentDescriptionLLM } from "../../src/support-processing-pipeline/message-analysis/attachement-description-llm/runAttachmentDescriptionLLM";

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Usage: npx tsx scripts/test-vision/test-image-analysis.ts <image-url> [user-message]

Examples:
  # Test with a simple image URL
  npx tsx scripts/test-vision/test-image-analysis.ts "https://example.com/image.png"

  # Test with a message for context
  npx tsx scripts/test-vision/test-image-analysis.ts "https://example.com/screenshot.png" "What's wrong with this error?"

  # Test with multiple images (space-separated URLs)
  npx tsx scripts/test-vision/test-image-analysis.ts "https://example.com/img1.png" "https://example.com/img2.png"
`);
    process.exit(1);
  }

  // Separate URLs from the user message
  // URLs start with http:// or https://
  const urls: string[] = [];
  let userMessage = "";

  for (const arg of args) {
    if (arg.startsWith("http://") || arg.startsWith("https://") || arg.startsWith("data:image/")) {
      urls.push(arg);
    } else {
      // Everything after the first non-URL is considered the user message
      if (userMessage) {
        userMessage += " ";
      }
      userMessage += arg;
    }
  }

  if (urls.length === 0) {
    console.error("Error: Please provide at least one image URL");
    process.exit(1);
  }

  console.log("\n" + "=".repeat(60));
  console.log("Testing Visual Attachment Analysis");
  console.log("=".repeat(60) + "\n");

  console.log(`Image URLs: ${urls.length}`);
  urls.forEach((url, i) => console.log(`  [${i + 1}] ${url.substring(0, 80)}${url.length > 80 ? "..." : ""}`));

  if (userMessage) {
    console.log(`\nUser message: "${userMessage}"`);
  }

  console.log("\n" + "-".repeat(60));
  console.log("Sending request to LLM...");
  console.log("-".repeat(60) + "\n");

  const startTime = Date.now();

  try {
    const result = await runAttachmentDescriptionLLM({
      attachments: urls.map((url, index) => ({
        name: `image-${index + 1}.png`,
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
      console.log("✅ SUCCESS: Image was analyzed successfully!");
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
