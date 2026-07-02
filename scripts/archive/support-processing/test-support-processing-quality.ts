/**
 * Human-readable quality runner for runSupportProcessingPipeline.
 *
 * Usage:
 *   npm run test:support-processing:quality -- --list
 *   npm run test:support-processing:quality -- --case 1
 *   npm run test:support-processing:quality -- --case 1,2,3
 *   npm run test:support-processing:quality -- --all
 *   npm run test:support-processing:quality -- --all --raw
 *   npm run test:support-processing:quality -- --full --all
 */

import "dotenv/config";

import * as fs from "fs";
import * as path from "path";

import {
  runSupportProcessingPipeline
} from "../../src/archive/support-processing-pipeline/runSupportProcessingPipeline";
import {
  buildSupportQualityInput,
  supportQualityTestCases
} from "./dataset-support-quality-test";
import {
  buildSupportQualityFullInput,
  supportQualityFullTestCases
} from "./dataset-support-quality-full-test";

import type {
  ConversationHistory,
  ResponsePlan,
  SupportProcessingPipelineInput,
  SupportProcessingPipelineOutput,
  SupportTopicKnowledge,
  TurnAttachments,
  TurnUnderstandingDelta
} from "../../src/archive/support-processing-pipeline/typesSupportProcessingPipeline.types";
import type {
  SupportQualityTestCase
} from "./dataset-support-quality-test";

type UnknownRecord = Record<string, unknown>;

type QualityRunResult = {
  testCase: SupportQualityTestCase;
  input: SupportProcessingPipelineInput;
  output: SupportProcessingPipelineOutput;
  warnings: string[];
  durationMs: number;
};

type QualityDataset = {
  name: "standard" | "full";
  cases: SupportQualityTestCase[];
  buildInput: (testCase: SupportQualityTestCase) => SupportProcessingPipelineInput;
  rawFilePrefix: string;
};

const ATTACHMENT_FLAGS = [
  "screenshot_available",
  "image_available",
  "video_available",
  "attachment_available"
];

function getArgValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);

  return index === -1 ? undefined : args[index + 1];
}

function selectDataset(args: string[]): QualityDataset {
  if (args.includes("--full")) {
    return {
      name: "full",
      cases: supportQualityFullTestCases,
      buildInput: buildSupportQualityFullInput,
      rawFilePrefix: "support-quality-full-run"
    };
  }

  return {
    name: "standard",
    cases: supportQualityTestCases,
    buildInput: buildSupportQualityInput,
    rawFilePrefix: "support-quality-run"
  };
}

function listCases(dataset: QualityDataset): void {
  console.log(
    `\nAvailable support-processing ${dataset.name} quality cases:\n`
  );

  for (const testCase of dataset.cases) {
    console.log(`  ${testCase.id}. ${testCase.label}`);
  }

  console.log("");
}

function parseSelectedCases(
  args: string[],
  dataset: QualityDataset
): SupportQualityTestCase[] {
  const rawCaseIds = getArgValue(args, "--case");

  if (!rawCaseIds || args.includes("--all")) {
    return dataset.cases;
  }

  return rawCaseIds.split(",").map((caseId) => {
    const id = Number(caseId.trim());
    const testCase = dataset.cases.find((candidate) => {
      return candidate.id === id;
    });

    if (!testCase) {
      throw new Error(`Unknown quality case id: ${caseId.trim()}`);
    }

    return testCase;
  });
}

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringifyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function getTopicTitle(topic: {
  tool_or_product?: string;
  topic_action?: string;
  topic_object?: string;
}): string {
  const title = [
    topic.tool_or_product,
    topic.topic_action,
    topic.topic_object
  ].filter((part): part is string => {
    return typeof part === "string" && part.trim().length > 0;
  }).join(" / ");

  return title || "Sujet support";
}

function getHistoricalTopicsSummary(
  supportTopicKnowledge: SupportTopicKnowledge
): string[] {
  return supportTopicKnowledge.segments_topic.map((topic) => {
    return `${topic.topic_category} - ${getTopicTitle(topic)}`;
  });
}

function findHistoricalTopic(
  supportTopicKnowledge: SupportTopicKnowledge,
  topicId: number
): SupportTopicKnowledge["segments_topic"][number] | undefined {
  return supportTopicKnowledge.segments_topic.find((topic) => {
    return topic.id_topic === topicId;
  });
}

function getTopicResponseForTopic(
  responsePlan: ResponsePlan,
  topicId: number
):
  | ResponsePlan["messagesPlan"]["topicPlanMessages"][number]["topics_responses"][number]["topic_response"]
  | undefined {
  for (const topicPlanMessage of responsePlan.messagesPlan.topicPlanMessages) {
    for (const topicResponse of topicPlanMessage.topics_responses) {
      if (topicResponse.topic_response.title.topic_id === topicId) {
        return topicResponse.topic_response;
      }
    }
  }

  return undefined;
}

function getFieldsRequestedFromTopicResponse(topicResponse: unknown): string[] {
  if (!isRecord(topicResponse)) {
    return [];
  }

  const mainResponse = topicResponse.main_response;

  if (!isRecord(mainResponse) || mainResponse.type !== "ask_fields") {
    return [];
  }

  const details = mainResponse.details;

  if (!isRecord(details) || !Array.isArray(details.fields_requested)) {
    return [];
  }

  return details.fields_requested.filter((field): field is string => {
    return typeof field === "string";
  });
}

function getPreviouslyRequestedFields(
  conversationHistory: ConversationHistory,
  topicId: number
): string[] {
  const fields = new Set<string>();

  for (const event of conversationHistory) {
    if (event.role !== "bot") {
      continue;
    }

    for (const topicPlanMessage of event.responsePlan.messagesPlan
      .topicPlanMessages) {
      for (const topicResponseWrapper of topicPlanMessage.topics_responses) {
        const topicResponse = topicResponseWrapper.topic_response;

        if (topicResponse.title.topic_id !== topicId) {
          continue;
        }

        for (const field of getFieldsRequestedFromTopicResponse(topicResponse)) {
          fields.add(field);
        }
      }
    }
  }

  return [...fields];
}

function hasVisualAttachment(attachments: TurnAttachments | undefined): boolean {
  return (
    (attachments?.images.length ?? 0) > 0 ||
    (attachments?.videos.length ?? 0) > 0
  );
}

function topicDetailsHasAttachmentFlag(topicDetails: unknown): boolean {
  if (!isRecord(topicDetails)) {
    return false;
  }

  return Object.keys(topicDetails).some((fieldName) => {
    return ATTACHMENT_FLAGS.includes(fieldName);
  });
}

function titleHasStructuredFields(title: unknown): boolean {
  if (!isRecord(title)) {
    return false;
  }

  return Boolean(title.tool_or_product || title.topic_action || title.topic_object);
}

function normalizedIncludesAny(value: string | undefined, parts: string[]): boolean {
  const normalizedValue = value?.trim().toLowerCase();

  if (!normalizedValue) {
    return false;
  }

  return parts.some((part) => {
    return normalizedValue.includes(part);
  });
}

function topicTextIncludesAny(
  topic: TurnUnderstandingDelta["segments_topic"][number],
  parts: string[]
): boolean {
  const values = [
    topic.tool_or_product,
    topic.topic_action,
    topic.topic_object,
    topic.user_goal,
    ...(topic.segment_verbatims ?? []),
    ...Object.values(topic.topic_details ?? {}).flatMap((value) => {
      return typeof value === "string" ? [value] : [];
    })
  ];

  return values.some((value) => {
    return normalizedIncludesAny(value, parts);
  });
}

function isStructuredBug(
  topic: TurnUnderstandingDelta["segments_topic"][number]
): boolean {
  return (
    topic.topic_category === "bug" &&
    Boolean(
      topic.tool_or_product ||
        topic.topic_action ||
        topic.topic_object ||
        topic.topic_details?.feature_or_page ||
        topic.topic_details?.error_message ||
        topic.segment_verbatims?.length
    )
  );
}

function isClearRequest(
  topic: TurnUnderstandingDelta["segments_topic"][number]
): boolean {
  return (
    topic.topic_category === "request" &&
    Boolean(topic.segment_verbatims?.length) &&
    Boolean(topic.user_goal || topic.topic_details?.gap_observed) &&
    Boolean(topic.tool_or_product || topic.topic_action || topic.topic_object)
  );
}

function isResolvedTopic(
  topic: TurnUnderstandingDelta["segments_topic"][number]
): boolean {
  return topicTextIncludesAny(topic, [
    "works now",
    "now works",
    "is now created",
    "now created",
    "fixed",
    "resolved",
    "marche maintenant",
    "fonctionne maintenant",
    "c'est resolu",
    "c'est résolu",
    "ca marche maintenant",
    "ça marche maintenant"
  ]);
}

function isAccessibilityTopic(
  topic: TurnUnderstandingDelta["segments_topic"][number]
): boolean {
  return topicTextIncludesAny(topic, [
    "voiceover",
    "screen reader",
    "lecteur d'écran",
    "lecteur d ecran",
    "accessibility",
    "accessibilite",
    "accessibilité"
  ]);
}

function collectWarnings(params: {
  input: SupportProcessingPipelineInput;
  output: SupportProcessingPipelineOutput;
}): string[] {
  const warnings: string[] = [];
  const output = params.output;
  const turnUnderstandingDelta =
    output.patches.analysisPatch.turnUnderstandingDelta;
  const responsePlan = output.patches.responsePatch.responsePlan;
  const responseText = output.userResponse.messages.map((message) => {
    return message.content;
  }).join("\n");
  const visualAttachmentExists = hasVisualAttachment(
    turnUnderstandingDelta.attachments
  );

  if (responseText.includes("undefined")) {
    warnings.push("Response contains undefined.");
  }

  for (const topic of turnUnderstandingDelta.segments_topic) {
    const topicResponse = getTopicResponseForTopic(responsePlan, topic.id_topic);
    const mainResponse = topicResponse?.main_response;
    const topicDetails = topic.topic_details;

    if (topicDetailsHasAttachmentFlag(topicDetails)) {
      warnings.push(
        `Topic ${topic.id_topic} topic_details contains an old attachment flag.`
      );
    }

    if ("topic_label" in topic) {
      warnings.push(`Topic ${topic.id_topic} contains topic_label.`);
    }

    if (
      !Array.isArray(topic.segment_verbatims) ||
      topic.segment_verbatims.length === 0
    ) {
      warnings.push(`Topic ${topic.id_topic} has no segment_verbatims.`);
    }

    if (topicResponse && "topic_label" in topicResponse.title) {
      warnings.push(
        `Topic ${topic.id_topic} response title contains topic_label.`
      );
    }

    if (
      topicResponse &&
      responseText.includes("Sujet support") &&
      titleHasStructuredFields(topicResponse.title)
    ) {
      warnings.push(
        `Topic ${topic.id_topic} rendered fallback title while structured fields exist.`
      );
    }

    if (isRecord(mainResponse) && mainResponse.type === "ask_fields") {
      const fieldsRequested = getFieldsRequestedFromTopicResponse({
        main_response: mainResponse
      });

      if (fieldsRequested.length === 0) {
        warnings.push(`Topic ${topic.id_topic} ask_fields has no fields.`);
      }

      if (fieldsRequested.length > 4) {
        warnings.push(
          `Topic ${topic.id_topic} asks more than 4 fields (${fieldsRequested.length}).`
        );
      }

      for (const field of fieldsRequested) {
        if (isRecord(topicDetails) && field in topicDetails) {
          warnings.push(
            `Topic ${topic.id_topic} asks field already present in topic_details: ${field}.`
          );
        }
      }

      const previouslyRequestedFields = getPreviouslyRequestedFields(
        params.input.conversationHistory,
        topic.id_topic
      );

      for (const field of fieldsRequested) {
        if (previouslyRequestedFields.includes(field)) {
          warnings.push(
            `Topic ${topic.id_topic} asks field already requested in history: ${field}.`
          );
        }
      }

      if (
        topic.topic_category === "question_faq" &&
        topic.tool_or_product &&
        topic.topic_action &&
        topic.topic_object
      ) {
        warnings.push(
          `Topic ${topic.id_topic} is a clear question_faq but still asks more info.`
        );
      }

      if (
        isStructuredBug(topic) &&
        fieldsRequested.length === 1 &&
        fieldsRequested[0] === "trigger_action"
      ) {
        warnings.push(
          `Topic ${topic.id_topic} asks only trigger_action on an already structured bug.`
        );
      }

      if (isClearRequest(topic)) {
        warnings.push(
          `Topic ${topic.id_topic} is a clear request but still asks more info.`
        );
      }
    }

    if (
      topicResponse?.optional_evidence_requested !== undefined &&
      visualAttachmentExists
    ) {
      warnings.push(
        `Topic ${topic.id_topic} requests optional visual evidence despite an image/video attachment.`
      );
    }

    if (
      topicResponse?.optional_evidence_requested !== undefined &&
      isResolvedTopic(topic)
    ) {
      warnings.push(
        `Topic ${topic.id_topic} requests optional visual evidence on a resolved topic.`
      );
    }

    if (
      topicResponse?.optional_evidence_requested !== undefined &&
      isAccessibilityTopic(topic)
    ) {
      warnings.push(
        `Topic ${topic.id_topic} requests optional visual evidence on an accessibility/VoiceOver topic.`
      );
    }
  }

  return warnings;
}

function printContextSummary(input: SupportProcessingPipelineInput): void {
  const historicalTopics = getHistoricalTopicsSummary(input.supportTopicKnowledge);

  console.log("\nCONTEXT SUMMARY");
  console.log(`historicalTopics: ${historicalTopics.length}`);

  for (const topicSummary of historicalTopics) {
    console.log(`- ${topicSummary}`);
  }
}

function printTopicsExtracted(params: {
  input: SupportProcessingPipelineInput;
  output: SupportProcessingPipelineOutput;
}): void {
  const topics =
    params.output.patches.analysisPatch.turnUnderstandingDelta.segments_topic;

  console.log("\nTOPICS EXTRACTED");

  if (topics.length === 0) {
    console.log("(none)");
    return;
  }

  topics.forEach((topic, index) => {
    const historicalTopic =
      topic.matched_historical_topic === "yes"
        ? findHistoricalTopic(params.input.supportTopicKnowledge, topic.id_topic)
        : undefined;
    const displaySource = {
      tool_or_product: topic.tool_or_product ?? historicalTopic?.tool_or_product,
      topic_action: topic.topic_action ?? historicalTopic?.topic_action,
      topic_object: topic.topic_object ?? historicalTopic?.topic_object
    };

    console.log(`${index + 1}. matched: ${topic.matched_historical_topic}`);
    console.log(
      `   category: ${topic.topic_category ?? historicalTopic?.topic_category ?? "unknown"}`
    );
    console.log(`   title: ${getTopicTitle(displaySource)}`);
    console.log("   segment_verbatims:");

    for (const verbatim of topic.segment_verbatims ?? []) {
      console.log(`   - ${verbatim}`);
    }

    if (!topic.segment_verbatims || topic.segment_verbatims.length === 0) {
      console.log("   - (none)");
    }

    console.log("   details:");
    console.log(indent(stringifyJson(topic.topic_details ?? {}), "   "));
    console.log(`   user_goal: ${topic.user_goal ?? "(none)"}`);
    console.log(`   blocking_issue: ${topic.blocking_issue ?? "(none)"}`);
  });
}

function printDecisionAndResponsePlan(output: SupportProcessingPipelineOutput): void {
  const responsePlan = output.patches.responsePatch.responsePlan;

  console.log("\nDECISION / RESPONSE PLAN");

  const topicResponses = responsePlan.messagesPlan.topicPlanMessages.flatMap(
    (topicPlanMessage) => {
      return topicPlanMessage.topics_responses;
    }
  );

  if (topicResponses.length === 0) {
    console.log("(none)");
    return;
  }

  topicResponses.forEach((topicResponseWrapper, index) => {
    const topicResponse = topicResponseWrapper.topic_response;
    const mainResponse = topicResponse.main_response;

    console.log(`${index + 1}. main_response: ${mainResponse.type}`);

    if (mainResponse.type === "ask_fields") {
      console.log("   fields_requested:");

      for (const field of mainResponse.details.fields_requested) {
        console.log(`   - ${field}`);
      }
    }

    if (topicResponse.optional_evidence_requested) {
      console.log("   optional_evidence_requested:");
      console.log(
        `   - ${topicResponse.optional_evidence_requested.types.join(", ")} (${topicResponse.optional_evidence_requested.reason})`
      );
    }

    console.log(`   next_step: ${topicResponse.next_step}`);
  });
}

function printUserResponse(output: SupportProcessingPipelineOutput): void {
  console.log("\nUSER RESPONSE");

  for (const message of output.userResponse.messages) {
    console.log(`"${message.content}"`);
  }
}

function printWarnings(warnings: string[]): void {
  console.log("\nQUALITY WARNINGS");

  if (warnings.length === 0) {
    console.log("(none)");
    return;
  }

  for (const warning of warnings) {
    console.log(`⚠️ ${warning}`);
  }
}

function indent(value: string, prefix: string): string {
  return value.split("\n").map((line) => {
    return `${prefix}${line}`;
  }).join("\n");
}

function printCompactResult(result: QualityRunResult): void {
  console.log("\n============================================================");
  console.log(`Case ${result.testCase.id} - ${result.testCase.label}`);
  console.log("============================================================");

  console.log("\nUSER MESSAGE");
  console.log(`"${result.testCase.latestUserMessage}"`);

  printContextSummary(result.input);
  printTopicsExtracted({
    input: result.input,
    output: result.output
  });
  printDecisionAndResponsePlan(result.output);
  printUserResponse(result.output);
  printWarnings(result.warnings);
  console.log(`\nDuration: ${result.durationMs}ms`);
}

async function runWithCompactLogs<T>(callback: () => Promise<T>): Promise<T> {
  const originalLog = console.log;

  console.log = (...args: unknown[]) => {
    const firstArg = args[0];

    if (
      typeof firstArg === "string" &&
      (firstArg.startsWith("[LLM estimate]") ||
        firstArg.startsWith("[LLM usage]"))
    ) {
      return;
    }

    originalLog(...args);
  };

  try {
    return await callback();
  } finally {
    console.log = originalLog;
  }
}

async function runCase(
  testCase: SupportQualityTestCase,
  dataset: QualityDataset
): Promise<QualityRunResult> {
  const input = dataset.buildInput(testCase);
  const startTime = Date.now();
  const output = await runWithCompactLogs(() => {
    return runSupportProcessingPipeline(input);
  });
  const durationMs = Date.now() - startTime;
  const warnings = collectWarnings({
    input,
    output
  });

  return {
    testCase,
    input,
    output,
    warnings,
    durationMs
  };
}

function writeRawResultsForDataset(
  results: QualityRunResult[],
  rawFilePrefix: string
): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const tmpDir = path.resolve("tmp");
  const filePath = path.join(tmpDir, `${rawFilePrefix}-${timestamp}.json`);

  fs.mkdirSync(tmpDir, {
    recursive: true
  });
  fs.writeFileSync(filePath, stringifyJson({
    generatedAt: new Date().toISOString(),
    results
  }));

  return filePath;
}

function incrementCounter(
  counter: Record<string, number>,
  key: string | undefined
): void {
  const normalizedKey = key && key.trim() !== "" ? key : "unknown";

  counter[normalizedKey] = (counter[normalizedKey] ?? 0) + 1;
}

function formatCounter(counter: Record<string, number>): string[] {
  return Object.entries(counter)
    .sort((left, right) => {
      return right[1] - left[1] || left[0].localeCompare(right[0]);
    })
    .map(([key, count]) => {
      return `${key}: ${count}`;
    });
}

function printCounter(title: string, counter: Record<string, number>): void {
  console.log(title);

  const lines = formatCounter(counter);

  if (lines.length === 0) {
    console.log("- (none)");
    return;
  }

  for (const line of lines) {
    console.log(`- ${line}`);
  }
}

function printAggregateSummary(results: QualityRunResult[]): void {
  const topicCategories: Record<string, number> = {};
  const mainResponses: Record<string, number> = {};
  const requestedFields: Record<string, number> = {};
  const signalTypes: Record<string, number> = {};
  const messageTypes: Record<string, number> = {};
  const warnings: Record<string, number> = {};
  let topicsCount = 0;
  let askMoreInfoTopicCount = 0;
  let solutionSearchingTopicCount = 0;
  let acknowledgementTopicCount = 0;

  for (const result of results) {
    const turnUnderstandingDelta =
      result.output.patches.analysisPatch.turnUnderstandingDelta;
    const responsePlan = result.output.patches.responsePatch.responsePlan;

    for (const message of result.output.userResponse.messages) {
      incrementCounter(messageTypes, message.type);
    }

    for (const warning of result.warnings) {
      incrementCounter(warnings, warning);
    }

    for (const signal of turnUnderstandingDelta.segments_signal) {
      for (const signalType of signal.signal_types) {
        incrementCounter(signalTypes, signalType);
      }
    }

    for (const topic of turnUnderstandingDelta.segments_topic) {
      topicsCount += 1;
      incrementCounter(topicCategories, topic.topic_category);
    }

    for (const topicPlanMessage of responsePlan.messagesPlan.topicPlanMessages) {
      for (const topicResponseWrapper of topicPlanMessage.topics_responses) {
        const mainResponse = topicResponseWrapper.topic_response.main_response;

        incrementCounter(mainResponses, mainResponse.type);

        if (mainResponse.type === "ask_fields") {
          askMoreInfoTopicCount += 1;

          for (const field of mainResponse.details.fields_requested) {
            incrementCounter(requestedFields, field);
          }
        }

        if (mainResponse.type === "propose_solution") {
          solutionSearchingTopicCount += 1;
        }

        if (mainResponse.type === "acknowledgement") {
          acknowledgementTopicCount += 1;
        }
      }
    }
  }

  console.log("\n============================================================");
  console.log("Aggregate quality summary");
  console.log("============================================================");
  console.log(`Cases: ${results.length}`);
  console.log(`Topics extracted: ${topicsCount}`);
  console.log(`Topic responses asking fields: ${askMoreInfoTopicCount}`);
  console.log(`Topic responses proposing solutions: ${solutionSearchingTopicCount}`);
  console.log(`Topic responses acknowledging/support: ${acknowledgementTopicCount}`);
  console.log("");
  printCounter("Topic categories", topicCategories);
  console.log("");
  printCounter("Main response types", mainResponses);
  console.log("");
  printCounter("Requested fields", requestedFields);
  console.log("");
  printCounter("Signal types", signalTypes);
  console.log("");
  printCounter("User response message types", messageTypes);
  console.log("");
  printCounter("Quality warnings", warnings);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dataset = selectDataset(args);

  if (args.includes("--list")) {
    listCases(dataset);
    return;
  }

  let selectedCases: SupportQualityTestCase[];

  try {
    selectedCases = parseSelectedCases(args, dataset);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    listCases(dataset);
    process.exit(1);
  }

  const raw = args.includes("--raw");
  const results: QualityRunResult[] = [];

  for (const testCase of selectedCases) {
    const result = await runCase(testCase, dataset);
    results.push(result);
    printCompactResult(result);

    if (raw) {
      console.log("\nRAW OUTPUT");
      console.log(stringifyJson(result));
    }
  }

  printAggregateSummary(results);

  const rawPath = writeRawResultsForDataset(results, dataset.rawFilePrefix);

  console.log("\n============================================================");
  console.log(`Raw JSON saved to: ${rawPath}`);
  console.log(`Quality ${dataset.name} run completed.`);
}

main().catch((error) => {
  console.error("\nUnexpected error:");
  console.error(error);
  process.exit(1);
});
