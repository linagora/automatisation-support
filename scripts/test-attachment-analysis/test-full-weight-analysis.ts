/**
 * Test full-weight message analysis
 *
 * Usage:
 *   npm run test:fullweight -- --case 1
 *   npm run test:fullweight -- --case 1,2
 *   npm run test:fullweight -- --all
 *   npm run test:fullweight -- --list
 */
import "dotenv/config";
import {
  runFullWeightMessageAnalysis
} from "../../src/support-processing-pipeline/message-analysis/fullweight-message-analysis/runFullWeightMessageAnalysis";

import {
  fullWeightAnalysisTestCases,
  type FullWeightAnalysisTestCase
} from "../../fake-full-weight-analysis-cases";

function printUsage(): void {
  console.log("Usage:");
  console.log("  npm run test:fullweight -- --case 1");
  console.log("  npm run test:fullweight -- --case 1,2");
  console.log("  npm run test:fullweight -- --all");
  console.log("  npm run test:fullweight -- --list");
}

function listCases(): void {
  console.log("\nAvailable full-weight analysis test cases:\n");

  for (const testCase of fullWeightAnalysisTestCases) {
    console.log(`  ${testCase.id}. ${testCase.label}`);
    console.log(`     ${testCase.description}`);
  }

  console.log("");
}

function parseSelectedCaseIds(args: string[]): string[] {
  if (args.includes("--all")) {
    return fullWeightAnalysisTestCases.map((testCase) => testCase.id);
  }

  const caseFlagIndex = args.indexOf("--case");

  if (caseFlagIndex === -1) {
    return [];
  }

  const rawCaseIds = args[caseFlagIndex + 1];

  if (!rawCaseIds) {
    return [];
  }

  return rawCaseIds
    .split(",")
    .map((caseId) => caseId.trim())
    .filter(Boolean);
}

function findTestCasesByIds(
  selectedCaseIds: string[]
): FullWeightAnalysisTestCase[] {
  return selectedCaseIds.map((selectedCaseId) => {
    const testCase = fullWeightAnalysisTestCases.find(
      (candidate) => candidate.id === selectedCaseId
    );

    if (!testCase) {
      throw new Error(`Unknown test case id: ${selectedCaseId}`);
    }

    return testCase;
  });
}

async function runCase(
  testCase: FullWeightAnalysisTestCase
): Promise<boolean> {
  console.log("\n============================================================");
  console.log(`Testing Full Weight Message Analysis — Case ${testCase.id}`);
  console.log("============================================================\n");

  console.log(`Label: ${testCase.label}`);
  console.log(`Description: ${testCase.description}`);
  console.log("");
  console.log("Latest user message:");
  console.log(`"${testCase.messageAnalysisInput.latestUserMessage.content}"`);

  console.log("\n------------------------------------------------------------");
  console.log("Sending request to LLM...");
  console.log("------------------------------------------------------------\n");

  const startTime = Date.now();

  const output = await runFullWeightMessageAnalysis({
    latestUserMessage: testCase.messageAnalysisInput.latestUserMessage,
    supportTopicKnowledge: testCase.messageAnalysisInput.supportTopicKnowledge,
    conversationHistory: testCase.messageAnalysisInput.conversationHistory,
    attachmentAnalysis: testCase.attachmentAnalysis,
    lightWeightMessageAnalysis: testCase.lightWeightMessageAnalysis
  });

  const durationMs = Date.now() - startTime;

  console.log("\n============================================================");
  console.log("RESULT");
  console.log("============================================================");
  console.log(`Duration: ${durationMs}ms`);
  console.log(`Decision: ${output.decision.route}`);

  if (output.history.refusalReason) {
    console.log(`Refusal reason: ${output.history.refusalReason}`);
  }

  if (output.error) {
    console.log("\n--- Error ---");
    console.log(JSON.stringify(output.error, null, 2));
  }

  if (output.analysis) {
    console.log("\n--- Analysis Output ---");
    console.log(JSON.stringify(output.analysis, null, 2));
  }

  console.log("\n--- Full Output ---");
  console.log(JSON.stringify(output, null, 2));

  return output.decision.route === "continue";
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--list")) {
    listCases();
    return;
  }

  const selectedCaseIds = parseSelectedCaseIds(args);

  if (selectedCaseIds.length === 0) {
    printUsage();
    process.exit(1);
  }

  let selectedTestCases: FullWeightAnalysisTestCase[];

  try {
    selectedTestCases = findTestCasesByIds(selectedCaseIds);
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "Invalid selected test case"
    );

    listCases();
    process.exit(1);
  }

  let allSucceeded = true;

  for (const testCase of selectedTestCases) {
    const succeeded = await runCase(testCase);

    if (!succeeded) {
      allSucceeded = false;
    }
  }

  console.log("\n============================================================");

  if (allSucceeded) {
    console.log("✅ SUCCESS: All selected full-weight analysis cases passed.");
  } else {
    console.log("❌ Some full-weight analysis cases returned stop.");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("\nUnexpected error:");
  console.error(error);
  process.exit(1);
});