import "dotenv/config";

import * as fs from "fs/promises";
import * as path from "path";

import {
  textAnalysisDataset
} from "../../dataset/textAnalysisDataset";
import {
  findGlobalPipelineGroup,
  globalPipelineGroups
} from "../../dataset/groups";
import {
  buildSupportTurnIdentityV2
} from "../../../../src/support-automation/build-input/buildSupportTurnIdentityV2";
import {
  buildSupportProcessingInputV2
} from "../../../../src/support-automation/build-input/buildSupportProcessingInputV2";
import {
  runMatrixSupportAutomationV2
} from "../../../../src/support-automation/runMatrixSupportAutomationV2";
import {
  runSupportProcessingPipelineV2Debug
} from "../../../../src/support-automation/support-processing-pipeline-v2/runSupportProcessingPipelineV2Debug";
import {
  mapUserResponseToDeliveryV2
} from "../../../../src/support-automation/delivery/mapUserResponseToDelivery";
import {
  buildLiveMemoryContextPath,
  readLiveMemoryContext
} from "../../../../src/infrastructure/live-memory/liveMemoryContextStore";

import type {
  GlobalPipelineCase
} from "../../dataset/typesTextAnalysisDataset";
import type {
  BufferedMessages,
  MessagingEvent
} from "../../../../src/support-automation/buffer/typesMessaging.types";
import type {
  SupportAutomationTurnV2Result
} from "../../../../src/support-automation/runSupportAutomationPipelineV2";
import type {
  SupportProcessingPipelineV2Input,
  SupportProcessingPipelineV2Output,
  SupportProcessingPersistenceEffectsV2,
  SupportProcessingProgressEvent,
  SupportProcessingStepName
} from "../../../../src/support-automation/support-processing-pipeline-v2/typesSupportProcessingPipelineV2.types";
import type {
  SupportProcessingPipelineV2DebugOutput
} from "../../../../src/support-automation/support-processing-pipeline-v2/runSupportProcessingPipelineV2Debug";
import type {
  MatrixChannelConfig,
  MatrixDeliveryResult
} from "../../../../src/infrastructure/matrix/typesMatrixChannel.types";
import type {
  LiveMemoryContext
} from "../../../../src/infrastructure/live-memory/typesLiveMemoryContext.types";

const FAKE_RECEIVED_DIR = path.resolve("data/fake-received");
const FAKE_SENT_DIR = path.resolve("data/fake-sent");
const LIVE_MEMORY_CONTEXT_DIR = path.resolve("data/live-memory-context");
const REPORT_ROOT_DIR = "tmp/global-pipeline-runs";

const DATASET_STOP_STAGES = [
  "security",
  "plan",
  "surface",
  "standard",
  "support",
  "topics",
  "knowledge",
  "response-plan",
  "compose",
  "render",
  "all"
] as const;

type DatasetStopStage = (typeof DATASET_STOP_STAGES)[number];

const UNTIL_TO_STOP_AFTER_STEP: Record<
  Exclude<DatasetStopStage, "all">,
  SupportProcessingStepName
> = {
  security: "detectSuspiciousPromptPatterns",
  plan: "planTurnAnalysis",
  surface: "analyzeTextSurface",
  standard: "buildStandardResponseFragments",
  support: "analyzeSupportText",
  topics: "proposeTopicUpdates",
  knowledge: "synthesizeRetrievedKnowledge",
  "response-plan": "planSupportResponse",
  compose: "composeSupportResponsePlan",
  render: "renderSupportResponse"
};

type FakeReceivedFile = {
  runId: string;
  scenarioId: string;
  messageName: string;
  event: MessagingEvent;
  delayMs: number;
  typingBeforeMs: number;
};

type AssertionResult = {
  name: string;
  status: "passed" | "failed" | "skipped";
  message: string;
  expected?: unknown;
  actual?: unknown;
};

type DatasetAssertionResult = {
  name: string;
  status: "passed" | "failed" | "skipped";
  expected?: unknown;
  actual?: unknown;
  message: string;
};

type DatasetAssertionsOutput = {
  status: "passed" | "failed" | "skipped";
  results: DatasetAssertionResult[];
};

type ScenarioDebugArtifacts = {
  input?: SupportProcessingPipelineV2Input;
  progressEvents: SupportProcessingProgressEvent[];
  partial: Record<string, unknown>;
  output?: SupportProcessingPipelineV2Output;
  debugStatus: {
    status: "completed" | "stopped";
    stoppedAfterStep?: SupportProcessingStepName;
  };
  datasetAssertions: DatasetAssertionsOutput;
};

type ScenarioReport = {
  scenarioId: string;
  name: string;
  conversationKey: string;
  fakeReceivedFiles: string[];
  fakeSentFiles: string[];
  sentContent: string;
  liveMemoryPath: string;
  liveMemory: LiveMemoryContext | null;
  matrixDeliveryResults: MatrixDeliveryResult[];
  assertions: AssertionResult[];
  status: "passed" | "failed" | "stopped";
  debugArtifacts?: ScenarioDebugArtifacts;
  error?: string;
};

type RunnerOptions = {
  list: boolean;
  all: boolean;
  serial: boolean;
  parallel: boolean;
  concurrency: number;
  waveSize: number;
  waveDelayMs: number;
  keepFiles: boolean;
  cleanFiles: boolean;
  emptyData: boolean;
  debug: boolean;
  verbose: boolean;
  fullInput: boolean;
  splitDebugFiles: boolean;
  until: DatasetStopStage;
  caseIds: string[];
  tags: string[];
  groups: string[];
};

function getArgValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);

  return index === -1 ? undefined : args[index + 1];
}

function getAllArgValues(args: string[], flag: string): string[] {
  const values: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === flag && args[index + 1]) {
      values.push(
        ...args[index + 1]
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      );
    }
  }

  return Array.from(new Set(values));
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
  flag: string
): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${flag} must be a positive integer.`);
  }

  return parsed;
}

function parseNonNegativeInteger(
  value: string | undefined,
  fallback: number,
  flag: string
): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${flag} must be a non-negative integer.`);
  }

  return parsed;
}

function parseUntil(args: string[]): DatasetStopStage {
  const rawUntil = getArgValue(args, "--until");

  if (!rawUntil) {
    return "all";
  }

  if (DATASET_STOP_STAGES.includes(rawUntil as DatasetStopStage)) {
    return rawUntil as DatasetStopStage;
  }

  throw new Error(
    `Unknown --until value "${rawUntil}". Allowed values: ${DATASET_STOP_STAGES.join(" | ")}.`
  );
}

function parseOptions(args: string[]): RunnerOptions {
  const serial = args.includes("--serial");
  const parallel = args.includes("--parallel");

  return {
    list: args.includes("--list"),
    all: args.includes("--all"),
    serial,
    parallel,
    concurrency: serial
      ? 1
      : parsePositiveInteger(getArgValue(args, "--concurrency"), parallel ? 3 : 1, "--concurrency"),
    waveSize: parsePositiveInteger(getArgValue(args, "--wave-size"), Number.MAX_SAFE_INTEGER, "--wave-size"),
    waveDelayMs: parseNonNegativeInteger(getArgValue(args, "--wave-delay-ms"), 0, "--wave-delay-ms"),
    keepFiles: args.includes("--keep-files"),
    cleanFiles: args.includes("--clean-files"),
    emptyData: args.includes("--empty-data"),
    debug: args.includes("--debug"),
    verbose: args.includes("--verbose"),
    fullInput: args.includes("--full-input"),
    splitDebugFiles: args.includes("--split-debug-files"),
    until: parseUntil(args),
    caseIds: getAllArgValues(args, "--case"),
    tags: getAllArgValues(args, "--tag"),
    groups: getAllArgValues(args, "--group")
  };
}

function buildRunId(): string {
  return new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+$/, "")
    .replace("T", "_");
}

function sleep(delayMs: number): Promise<void> {
  if (delayMs <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function stringify(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), {
    recursive: true
  });
  await fs.writeFile(filePath, `${stringify(value)}\n`, "utf8");
}

async function emptyDirectoryContents(directoryPath: string): Promise<void> {
  await fs.mkdir(directoryPath, {
    recursive: true
  });

  const entries = await fs.readdir(directoryPath);

  await Promise.all(
    entries.map((entryName) => {
      return fs.rm(path.join(directoryPath, entryName), {
        recursive: true,
        force: true
      });
    })
  );

  await fs.writeFile(
    path.join(directoryPath, ".gitkeep"),
    "# Keep directory in git.\n",
    "utf8"
  );
}

async function emptyFakeMatrixDataDirectories(): Promise<void> {
  await emptyDirectoryContents(FAKE_RECEIVED_DIR);
  await emptyDirectoryContents(FAKE_SENT_DIR);
  await emptyDirectoryContents(LIVE_MEMORY_CONTEXT_DIR);
}

function formatMessageIndex(index: number): string {
  return String(index + 1).padStart(3, "0");
}

function buildFakeBufferedMessages(scenario: GlobalPipelineCase): BufferedMessages {
  const firstMessage = scenario.receivedMessages[0];
  const createdAt = new Date().toISOString();
  const event: MessagingEvent = {
    channel: "matrix",
    roomId: scenario.actor.roomId,
    userId: scenario.actor.userId,
    messageId: `fake_seed_${scenario.id}`,
    content: firstMessage?.content ?? "",
    createdAt,
    ...(scenario.actor.threadId ? { threadId: scenario.actor.threadId } : {})
  };

  return {
    channel: "matrix",
    roomId: scenario.actor.roomId,
    ...(scenario.actor.threadId ? { threadId: scenario.actor.threadId } : {}),
    userId: scenario.actor.userId,
    messages: [event],
    firstMessageAt: createdAt,
    lastMessageAt: createdAt,
    flushedAt: createdAt
  };
}

function buildSeedLiveMemory(scenario: GlobalPipelineCase): LiveMemoryContext {
  return {
    topics: scenario.seedLiveMemory.topics.map((topic) => ({
      topicId: topic.topicId,
      title: topic.title,
      broadCategoryHint: topic.broadCategoryHint,
      summary: topic.summary,
      caseDetails: topic.caseDetails as LiveMemoryContext["topics"][number]["caseDetails"],
      attemptedActions: topic.attemptedActions as LiveMemoryContext["topics"][number]["attemptedActions"],
      ...(topic.supportKnowledgeSummary
        ? { supportKnowledgeSummary: topic.supportKnowledgeSummary }
        : {})
    })),
    lastUserVerbatim: scenario.seedLiveMemory.lastUserVerbatim ?? null,
    lastBotVerbatim: scenario.seedLiveMemory.lastBotVerbatim ?? null,
    userState: {
      status: scenario.seedLiveMemory.userState?.status === "watch" ||
        scenario.seedLiveMemory.userState?.status === "blocked"
        ? scenario.seedLiveMemory.userState.status
        : "normal",
      flags: scenario.seedLiveMemory.userState?.flags ?? []
    }
  };
}

function addCaseById(params: {
  selected: Map<string, GlobalPipelineCase>;
  caseId: string;
}): void {
  const testCase = textAnalysisDataset.find((candidate) => candidate.id === params.caseId);

  if (!testCase) {
    throw new Error(`Unknown global pipeline case "${params.caseId}".`);
  }

  params.selected.set(testCase.id, testCase);
}

function addCasesByTags(params: {
  selected: Map<string, GlobalPipelineCase>;
  tags: string[];
}): void {
  for (const testCase of textAnalysisDataset) {
    if (params.tags.some((tag) => testCase.tags.includes(tag))) {
      params.selected.set(testCase.id, testCase);
    }
  }
}

function selectScenarios(options: RunnerOptions): GlobalPipelineCase[] {
  if (options.list) {
    return [];
  }

  if (options.all) {
    return textAnalysisDataset;
  }

  const selected = new Map<string, GlobalPipelineCase>();

  for (const caseId of options.caseIds) {
    addCaseById({ selected, caseId });
  }

  if (options.tags.length > 0) {
    addCasesByTags({ selected, tags: options.tags });
  }

  for (const groupId of options.groups) {
    const group = findGlobalPipelineGroup(groupId);

    if (!group) {
      throw new Error(`Unknown global pipeline group "${groupId}".`);
    }

    for (const caseId of group.cases ?? []) {
      addCaseById({ selected, caseId });
    }

    if ((group.tags ?? []).length > 0) {
      addCasesByTags({ selected, tags: group.tags ?? [] });
    }
  }

  if (selected.size > 0) {
    return Array.from(selected.values());
  }

  return [textAnalysisDataset[0]];
}

function listScenarios(): void {
  console.log("\nAvailable global pipeline cases:\n");

  for (const testCase of textAnalysisDataset) {
    console.log(`  ${testCase.id} - ${testCase.name} [${testCase.tags.join(", ")}]`);
  }

  console.log("\nAvailable groups:\n");

  for (const group of globalPipelineGroups) {
    const parts = [
      ...(group.tags?.length ? [`tags=${group.tags.join(",")}`] : []),
      ...(group.cases?.length ? [`cases=${group.cases.length}`] : [])
    ];
    console.log(`  ${group.id} - ${group.label}${parts.length ? ` [${parts.join("; ")}]` : ""}`);
  }

  console.log("");
}
async function writeFakeReceivedFiles(params: {
  runId: string;
  scenario: GlobalPipelineCase;
}): Promise<string[]> {
  const files: string[] = [];

  for (const [index, message] of params.scenario.receivedMessages.entries()) {
    const messageIndex = formatMessageIndex(index);
    const messageId = `${params.runId}__${params.scenario.id}__msg_${messageIndex}`;
    const createdAt = new Date(Date.now() + index).toISOString();
    const event: MessagingEvent = {
      channel: "matrix",
      roomId: params.scenario.actor.roomId,
      userId: params.scenario.actor.userId,
      messageId,
      content: message.content,
      createdAt,
      ...(params.scenario.actor.threadId
        ? { threadId: params.scenario.actor.threadId }
        : {}),
      rawEvent: {
        fakeMatrixScenarioId: params.scenario.id,
        messageName: message.name
      }
    };
    const fileName = `${params.runId}__${params.scenario.id}__${message.name}__msg_${messageIndex}.json`;
    const filePath = path.join(FAKE_RECEIVED_DIR, fileName);
    const fakeFile: FakeReceivedFile = {
      runId: params.runId,
      scenarioId: params.scenario.id,
      messageName: message.name,
      event,
      delayMs: message.delayMs ?? 0,
      typingBeforeMs: message.typingBeforeMs ?? 0
    };

    await writeJsonFile(filePath, fakeFile);
    files.push(filePath);
  }

  return files;
}

async function readFakeReceivedFiles(params: {
  runId: string;
  scenarioId: string;
}): Promise<FakeReceivedFile[]> {
  const fileNames = await fs.readdir(FAKE_RECEIVED_DIR);
  const prefix = `${params.runId}__${params.scenarioId}__`;
  const matchingFileNames = fileNames
    .filter((fileName) => fileName.startsWith(prefix) && fileName.endsWith(".json"))
    .sort();
  const files: FakeReceivedFile[] = [];

  for (const fileName of matchingFileNames) {
    const rawContent = await fs.readFile(path.join(FAKE_RECEIVED_DIR, fileName), "utf8");
    files.push(JSON.parse(rawContent) as FakeReceivedFile);
  }

  return files;
}

function createFakeListener(params: {
  runId: string;
  scenario: GlobalPipelineCase;
}) {
  return async (input: {
    onMessage: (event: MessagingEvent) => void | Promise<void>;
    onTyping?: (event: {
      channel: "matrix";
      roomId: string;
      userId: string;
      isTyping: boolean;
      updatedAt: string;
      rawEvent?: unknown;
    }) => void | Promise<void>;
  }): Promise<{ stop: () => Promise<void> }> => {
    let stopped = false;
    const fakeFiles = await readFakeReceivedFiles({
      runId: params.runId,
      scenarioId: params.scenario.id
    });

    for (const fakeFile of fakeFiles) {
      if (stopped) {
        break;
      }

      if (fakeFile.delayMs > 0) {
        await sleep(fakeFile.delayMs);
      }

      if (fakeFile.typingBeforeMs > 0 && input.onTyping) {
        await input.onTyping({
          channel: "matrix",
          roomId: fakeFile.event.roomId,
          userId: fakeFile.event.userId,
          isTyping: true,
          updatedAt: new Date().toISOString(),
          rawEvent: {
            fakeMatrixScenarioId: params.scenario.id,
            messageName: fakeFile.messageName
          }
        });
        await sleep(fakeFile.typingBeforeMs);
        await input.onTyping({
          channel: "matrix",
          roomId: fakeFile.event.roomId,
          userId: fakeFile.event.userId,
          isTyping: false,
          updatedAt: new Date().toISOString(),
          rawEvent: {
            fakeMatrixScenarioId: params.scenario.id,
            messageName: fakeFile.messageName
          }
        });
      }

      await input.onMessage(fakeFile.event);
    }

    return {
      stop: async () => {
        stopped = true;
      }
    };
  };
}

function createFakeDelivery(params: {
  runId: string;
  scenario: GlobalPipelineCase;
  writtenSentFiles: string[];
}) {
  return async (input: {
    config: MatrixChannelConfig;
    messages: Array<{
      localId: string;
      roomId: string;
      content: string;
    }>;
  }): Promise<MatrixDeliveryResult[]> => {
    const result: MatrixDeliveryResult = {
      channel: "matrix",
      roomId: params.scenario.actor.roomId,
      deliveredMessages: [],
      failedMessages: []
    };

    for (const [index, message] of input.messages.entries()) {
      const content = message.content;

      if (content.trim() === "") {
        continue;
      }

      const botIndex = formatMessageIndex(index);
      const filePath = path.join(
        FAKE_SENT_DIR,
        `${params.runId}__${params.scenario.id}__bot_${botIndex}.json`
      );
      const deliveredAt = new Date().toISOString();
      const providerMessageId = `${params.runId}__${params.scenario.id}__bot_${botIndex}`;

      await writeJsonFile(filePath, {
        runId: params.runId,
        scenarioId: params.scenario.id,
        providerMessageId,
        localId: message.localId,
        roomId: message.roomId || input.config.defaultRoomId,
        content,
        deliveredAt
      });
      params.writtenSentFiles.push(filePath);
      result.deliveredMessages.push({
        localId: message.localId,
        providerMessageId,
        content,
        deliveredAt
      });
    }

    return [result];
  };
}

function assertSentShouldMention(params: {
  expectedFragments: string[] | undefined;
  sentContent: string;
}): AssertionResult[] {
  return (params.expectedFragments ?? []).map((fragment) => {
    const passed = params.sentContent.includes(fragment);

    return {
      name: `sentShouldMention:${fragment}`,
      status: passed ? "passed" : "failed",
      message: passed
        ? `Sent content contains "${fragment}".`
        : `Sent content does not contain "${fragment}".`,
      expected: fragment,
      actual: params.sentContent
    };
  });
}

function assertSentShouldNotMention(params: {
  expectedFragments: string[] | undefined;
  sentContent: string;
}): AssertionResult[] {
  return (params.expectedFragments ?? []).map((fragment) => {
    const passed = !params.sentContent.includes(fragment);

    return {
      name: `sentShouldNotMention:${fragment}`,
      status: passed ? "passed" : "failed",
      message: passed
        ? `Sent content does not contain "${fragment}".`
        : `Sent content contains "${fragment}".`,
      expected: `not ${fragment}`,
      actual: params.sentContent
    };
  });
}

function assertLastBotVerbatim(params: {
  enabled: boolean | undefined;
  sentContent: string;
  liveMemory: LiveMemoryContext | null;
}): AssertionResult[] {
  if (params.enabled !== true) {
    return [];
  }

  const actual = params.liveMemory?.lastBotVerbatim ?? null;
  const passed = actual === params.sentContent;

  return [
    {
      name: "liveMemoryLastBotShouldEqualSent",
      status: passed ? "passed" : "failed",
      message: passed
        ? "liveMemory.lastBotVerbatim equals delivered fake-sent content."
        : "liveMemory.lastBotVerbatim differs from delivered fake-sent content.",
      expected: params.sentContent,
      actual
    }
  ];
}

function assertRagUsage(params: {
  expected: GlobalPipelineCase["expected"];
  ragUsage: unknown;
}): AssertionResult[] {
  if (!params.expected?.ragUsage) {
    return [];
  }

  if (!Array.isArray(params.ragUsage)) {
    return [
      {
        name: "ragUsage",
        status: "skipped",
        message: "ragUsage assertion unavailable: output did not expose a ragUsage array."
      }
    ];
  }

  return params.expected.ragUsage.map((expectedUsage) => {
    const matching = params.ragUsage.find((usage) => {
      return typeof usage === "object" &&
        usage !== null &&
        (usage as { topicId?: unknown }).topicId === expectedUsage.topicId;
    }) as { status?: unknown } | undefined;
    const passed = matching?.status === expectedUsage.status;

    return {
      name: `ragUsage:${expectedUsage.topicId}`,
      status: passed ? "passed" : "failed",
      message: passed
        ? `ragUsage for topic ${expectedUsage.topicId} has expected status.`
        : `ragUsage for topic ${expectedUsage.topicId} does not have expected status.`,
      expected: expectedUsage,
      actual: matching ?? null
    };
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getExpectedTextSurface(scenario: GlobalPipelineCase): Record<string, unknown> | null {
  const expected = scenario.metadata?.rawExpectedTextSurface;

  return isRecord(expected) ? expected : null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    return typeof item === "string" && item.trim() !== ""
      ? [item.trim()]
      : [];
  });
}

function getTextSurfaceFromPartial(
  partial: Record<string, unknown>
): Record<string, unknown> | null {
  const value = partial.analyzeTextSurface;

  return isRecord(value) ? value : null;
}

function buildPassedAssertion(
  name: string,
  message: string,
  expected?: unknown,
  actual?: unknown
): DatasetAssertionResult {
  return {
    name,
    status: "passed",
    message,
    ...(expected !== undefined ? { expected } : {}),
    ...(actual !== undefined ? { actual } : {})
  };
}

function buildFailedAssertion(
  name: string,
  message: string,
  expected?: unknown,
  actual?: unknown
): DatasetAssertionResult {
  return {
    name,
    status: "failed",
    message,
    ...(expected !== undefined ? { expected } : {}),
    ...(actual !== undefined ? { actual } : {})
  };
}

function evaluateTextSurfaceAssertions(params: {
  scenario: GlobalPipelineCase;
  partial: Record<string, unknown>;
}): DatasetAssertionsOutput {
  const expected = getExpectedTextSurface(params.scenario);

  if (!expected) {
    return {
      status: "skipped",
      results: [
        {
          name: "expectedTextSurface",
          status: "skipped",
          message: "No expectedTextSurface metadata for this case."
        }
      ]
    };
  }

  const textSurface = getTextSurfaceFromPartial(params.partial);
  const userLanguage = typeof textSurface?.userLanguage === "string"
    ? textSurface.userLanguage
    : undefined;
  const segments = Array.isArray(textSurface?.segments)
    ? textSurface.segments
    : [];
  const categories = segments.flatMap((segment) => {
    return isRecord(segment) && typeof segment.category === "string"
      ? [segment.category]
      : [];
  });
  const supportRelevantCount = categories.filter((category) => {
    return category === "support_relevant";
  }).length;
  const results: DatasetAssertionResult[] = [];

  if (typeof expected.userLanguage === "string") {
    results.push(
      userLanguage === expected.userLanguage
        ? buildPassedAssertion(
            "userLanguage",
            "Detected userLanguage matches expected value.",
            expected.userLanguage,
            userLanguage
          )
        : buildFailedAssertion(
            "userLanguage",
            "Detected userLanguage does not match expected value.",
            expected.userLanguage,
            userLanguage
          )
    );
  }

  const allowedUserLanguages = normalizeStringArray(expected.allowedUserLanguages);

  if (allowedUserLanguages.length > 0) {
    results.push(
      userLanguage && allowedUserLanguages.includes(userLanguage)
        ? buildPassedAssertion(
            "allowedUserLanguages",
            "Detected userLanguage is allowed.",
            allowedUserLanguages,
            userLanguage
          )
        : buildFailedAssertion(
            "allowedUserLanguages",
            "Detected userLanguage is not in allowed list.",
            allowedUserLanguages,
            userLanguage
          )
    );
  }

  const forbiddenUserLanguages = normalizeStringArray(expected.forbiddenUserLanguages);

  if (forbiddenUserLanguages.length > 0) {
    results.push(
      !userLanguage || !forbiddenUserLanguages.includes(userLanguage)
        ? buildPassedAssertion(
            "forbiddenUserLanguages",
            "Detected userLanguage is not forbidden.",
            forbiddenUserLanguages,
            userLanguage
          )
        : buildFailedAssertion(
            "forbiddenUserLanguages",
            "Detected userLanguage is forbidden.",
            forbiddenUserLanguages,
            userLanguage
          )
    );
  }

  const expectedCategories = normalizeStringArray(expected.expectedCategories);

  if (expectedCategories.length > 0) {
    for (const expectedCategory of expectedCategories) {
      results.push(
        categories.includes(expectedCategory)
          ? buildPassedAssertion(
              `expectedCategories:${expectedCategory}`,
              "Expected category is present.",
              expectedCategory,
              categories
            )
          : buildFailedAssertion(
              `expectedCategories:${expectedCategory}`,
              "Expected category is missing.",
              expectedCategory,
              categories
            )
      );
    }
  }

  if (typeof expected.minSupportRelevantSegments === "number") {
    results.push(
      supportRelevantCount >= expected.minSupportRelevantSegments
        ? buildPassedAssertion(
            "minSupportRelevantSegments",
            "Support relevant segment count meets minimum.",
            expected.minSupportRelevantSegments,
            supportRelevantCount
          )
        : buildFailedAssertion(
            "minSupportRelevantSegments",
            "Support relevant segment count is below minimum.",
            expected.minSupportRelevantSegments,
            supportRelevantCount
          )
    );
  }

  if (results.length === 0) {
    return {
      status: "skipped",
      results: [
        {
          name: "expectedTextSurface",
          status: "skipped",
          message: "Expected text surface metadata has no supported assertions."
        }
      ]
    };
  }

  return {
    status: results.some((result) => result.status === "failed")
      ? "failed"
      : "passed",
    results
  };
}

function buildProgressSummary(
  progressEvents: SupportProcessingProgressEvent[]
): string[] {
  return progressEvents.map((event) => `${event.step}:${event.status}`);
}

function buildEmptyPersistenceEffects(
  latestUserMessageContent: string
): SupportProcessingPersistenceEffectsV2 {
  return {
    liveMemoryUpdate: {
      mode: "merge",
      topics: [],
      lastUserVerbatim: latestUserMessageContent,
      lastBotVerbatim: "",
      userState: {
        status: "normal",
        flags: []
      }
    },
    openTelemetry: {
      status: "mocked_empty",
      spans: [],
      metrics: [],
      events: [],
      resourceAttributes: {}
    },
    otherSupportPipelineInformation: {}
  };
}

async function cleanupRunFiles(runId: string): Promise<void> {
  for (const directory of [FAKE_RECEIVED_DIR, FAKE_SENT_DIR]) {
    const fileNames = await fs.readdir(directory).catch(() => []);

    await Promise.all(
      fileNames
        .filter((fileName) => fileName.startsWith(`${runId}__`))
        .map((fileName) => fs.rm(path.join(directory, fileName), { force: true }))
    );
  }
}

async function runDebugSupportAutomationTurn(params: {
  bufferedMessages: BufferedMessages;
  scenario: GlobalPipelineCase;
  options: RunnerOptions;
  debugArtifacts: {
    value?: ScenarioDebugArtifacts;
  };
}): Promise<SupportAutomationTurnV2Result> {
  const turnIdentity = buildSupportTurnIdentityV2(params.bufferedMessages);
  const liveMemoryContext =
    await readLiveMemoryContext(turnIdentity.conversationKey);
  const supportProcessingInput = buildSupportProcessingInputV2({
    bufferedMessages: params.bufferedMessages,
    turnIdentity,
    liveMemoryContext
  });
  const stopAfterStep = params.options.until === "all"
    ? undefined
    : UNTIL_TO_STOP_AFTER_STEP[params.options.until];
  const debugOutput = await runSupportProcessingPipelineV2Debug(
    supportProcessingInput,
    {},
    {
      ...(stopAfterStep ? { stopAfterStep } : {}),
      collectProgressEvents: true
    }
  );
  const datasetAssertions = evaluateTextSurfaceAssertions({
    scenario: params.scenario,
    partial: debugOutput.partial
  });

  params.debugArtifacts.value = {
    input: supportProcessingInput,
    progressEvents: debugOutput.progressEvents,
    partial: debugOutput.partial,
    ...(debugOutput.output ? { output: debugOutput.output } : {}),
    debugStatus: {
      status: debugOutput.status,
      ...(debugOutput.stoppedAfterStep
        ? { stoppedAfterStep: debugOutput.stoppedAfterStep }
        : {})
    },
    datasetAssertions
  };

  if (debugOutput.status === "completed" && debugOutput.output) {
    const deliveryMessages = mapUserResponseToDeliveryV2({
      userResponse: debugOutput.output.userResponse,
      turnIdentity,
      latestMessageId: params.bufferedMessages.messages.at(-1)?.messageId
    });

    return {
      turnIdentity,
      supportProcessingInput,
      supportProcessingOutput: debugOutput.output,
      persistenceEffects: debugOutput.output.persistenceEffects,
      deliveryMessages
    };
  }

  const latestUserMessageContent =
    params.bufferedMessages.messages.at(-1)?.content ?? "";
  const stoppedOutput = {
    userResponse: {
      messages: []
    },
    persistenceEffects: buildEmptyPersistenceEffects(latestUserMessageContent)
  } as SupportProcessingPipelineV2Output;

  return {
    turnIdentity,
    supportProcessingInput,
    supportProcessingOutput: stoppedOutput,
    persistenceEffects: stoppedOutput.persistenceEffects,
    deliveryMessages: []
  };
}

async function writeDebugArtifacts(params: {
  caseReportDir: string;
  scenarioReport: ScenarioReport;
  debugArtifacts: ScenarioDebugArtifacts;
}): Promise<void> {
  await fs.mkdir(params.caseReportDir, {
    recursive: true
  });
  await writeJsonFile(
    path.join(params.caseReportDir, "scenario-report.json"),
    params.scenarioReport
  );

  await writeJsonFile(
    path.join(params.caseReportDir, "input.json"),
    params.debugArtifacts.input ?? null
  );

  await writeJsonFile(
    path.join(params.caseReportDir, "pipeline-progress-events.json"),
    params.debugArtifacts.progressEvents
  );
  await writeJsonFile(
    path.join(params.caseReportDir, "pipeline-progress-summary.json"),
    buildProgressSummary(params.debugArtifacts.progressEvents)
  );
  await writeJsonFile(
    path.join(params.caseReportDir, "pipeline-partial.json"),
    params.debugArtifacts.partial
  );
  await writeJsonFile(
    path.join(params.caseReportDir, "pipeline-output.json"),
    params.debugArtifacts.output ?? null
  );
  await writeJsonFile(
    path.join(params.caseReportDir, "pipeline-debug-status.json"),
    params.debugArtifacts.debugStatus
  );
  await writeJsonFile(
    path.join(params.caseReportDir, "dataset-assertions.json"),
    params.debugArtifacts.datasetAssertions
  );
}

function buildAssertionSummary(report: ScenarioReport): {
  passed: number;
  failed: number;
  skipped: number;
} {
  return {
    passed:
      report.assertions.filter((assertion) => assertion.status === "passed").length +
      (report.debugArtifacts?.datasetAssertions.results.filter((assertion) => assertion.status === "passed").length ?? 0),
    failed:
      report.assertions.filter((assertion) => assertion.status === "failed").length +
      (report.debugArtifacts?.datasetAssertions.results.filter((assertion) => assertion.status === "failed").length ?? 0),
    skipped:
      report.assertions.filter((assertion) => assertion.status === "skipped").length +
      (report.debugArtifacts?.datasetAssertions.results.filter((assertion) => assertion.status === "skipped").length ?? 0)
  };
}

function buildCaseReportPaths(params: {
  reportDir: string;
  caseId: string;
}): {
  caseReportDir: string;
  summaryPath: string;
  debugPath: string;
} {
  const caseReportDir = path.join(params.reportDir, "cases", params.caseId);

  return {
    caseReportDir,
    summaryPath: path.join(caseReportDir, "summary.json"),
    debugPath: path.join(caseReportDir, "debug.json")
  };
}

function buildCaseSummary(params: {
  runId: string;
  report: ScenarioReport;
  debugPath: string;
}): Record<string, unknown> {
  const stoppedAfterStep =
    params.report.debugArtifacts?.debugStatus.stoppedAfterStep;
  const progressSummary = params.report.debugArtifacts
    ? buildProgressSummary(params.report.debugArtifacts.progressEvents)
    : [];

  return {
    runId: params.runId,
    caseId: params.report.scenarioId,
    name: params.report.name,
    status: params.report.status,
    conversationKey: params.report.conversationKey,
    assertionSummary: buildAssertionSummary(params.report),
    ...(stoppedAfterStep ? { stoppedAfterStep } : {}),
    ...(params.report.sentContent ? { sentContent: params.report.sentContent } : {}),
    fakeReceivedFiles: params.report.fakeReceivedFiles,
    fakeSentFiles: params.report.fakeSentFiles,
    liveMemoryPath: params.report.liveMemoryPath,
    progressSummary,
    ...(params.report.error ? { errors: [params.report.error] } : {}),
    debugPath: params.debugPath
  };
}

function buildCaseDebug(params: {
  runId: string;
  scenario: GlobalPipelineCase;
  report: ScenarioReport;
}): Record<string, unknown> {
  const debugArtifacts = params.report.debugArtifacts;
  const progressSummary = debugArtifacts
    ? buildProgressSummary(debugArtifacts.progressEvents)
    : [];

  return {
    runId: params.runId,
    caseId: params.report.scenarioId,
    name: params.report.name,
    status: params.report.status,
    conversationKey: params.report.conversationKey,
    scenario: params.scenario,
    input: debugArtifacts?.input ?? null,
    pipelineProgressEvents: debugArtifacts?.progressEvents ?? [],
    pipelineProgressSummary: progressSummary,
    pipelinePartial: debugArtifacts?.partial ?? {},
    pipelineOutput: debugArtifacts?.output ?? null,
    pipelineDebugStatus: debugArtifacts?.debugStatus ?? null,
    datasetAssertions: debugArtifacts?.datasetAssertions ?? null,
    scenarioReport: params.report,
    fakeReceivedFiles: params.report.fakeReceivedFiles,
    fakeSentFiles: params.report.fakeSentFiles,
    sentContent: params.report.sentContent,
    liveMemoryPath: params.report.liveMemoryPath,
    liveMemory: params.report.liveMemory,
    matrixDeliveryResults: params.report.matrixDeliveryResults,
    assertions: params.report.assertions,
    ...(params.report.error ? { errors: [params.report.error] } : {})
  };
}

async function writeCaseReportFiles(params: {
  runId: string;
  scenario: GlobalPipelineCase;
  report: ScenarioReport;
  reportDir: string;
  splitDebugFiles: boolean;
}): Promise<{
  summaryPath: string;
  debugPath: string;
}> {
  const paths = buildCaseReportPaths({
    reportDir: params.reportDir,
    caseId: params.report.scenarioId
  });

  await writeJsonFile(
    paths.summaryPath,
    buildCaseSummary({
      runId: params.runId,
      report: params.report,
      debugPath: paths.debugPath
    })
  );
  await writeJsonFile(
    paths.debugPath,
    buildCaseDebug({
      runId: params.runId,
      scenario: params.scenario,
      report: params.report
    })
  );

  if (params.splitDebugFiles && params.report.debugArtifacts) {
    await writeDebugArtifacts({
      caseReportDir: paths.caseReportDir,
      scenarioReport: params.report,
      debugArtifacts: params.report.debugArtifacts
    });
  }

  return {
    summaryPath: paths.summaryPath,
    debugPath: paths.debugPath
  };
}

function logDebugScenarioSummary(params: {
  report: ScenarioReport;
  summaryPath: string;
  debugPath: string;
  verbose: boolean;
}): void {
  const debugArtifacts = params.report.debugArtifacts;

  if (!debugArtifacts) {
    return;
  }

  console.log(`[${params.report.scenarioId}]`);
  console.log(`status: ${params.report.status}`);
  console.log(`summary: ${params.summaryPath}`);
  console.log(`debug: ${params.debugPath}`);

  if (!params.verbose) {
    return;
  }

  console.log("  input:");
  console.log(stringify(debugArtifacts.input ?? null));
  console.log("  progressEvents:");
  console.log(stringify(debugArtifacts.progressEvents));
  console.log("  partial:");
  console.log(stringify(debugArtifacts.partial));
  console.log("  output:");
  console.log(stringify(debugArtifacts.output ?? null));
  console.log("  debugStatus:");
  console.log(stringify(debugArtifacts.debugStatus));
}

async function runScenario(params: {
  runId: string;
  scenario: GlobalPipelineCase;
  reportDir: string;
  options: RunnerOptions;
}): Promise<ScenarioReport> {
  const scenario = params.scenario;
  const turnIdentity = buildSupportTurnIdentityV2(buildFakeBufferedMessages(scenario));
  const liveMemoryPath = buildLiveMemoryContextPath(turnIdentity.conversationKey);
  const seedLiveMemory = buildSeedLiveMemory(scenario);
  const fakeSentFiles: string[] = [];
  const debugArtifacts: {
    value?: ScenarioDebugArtifacts;
  } = {};

  await writeJsonFile(liveMemoryPath, seedLiveMemory);
  const fakeReceivedFiles = await writeFakeReceivedFiles({
    runId: params.runId,
    scenario
  });

  const handle = await runMatrixSupportAutomationV2({
    config: {
      homeserverUrl: "https://fake-matrix.local",
      accessToken: "fake-token",
      defaultRoomId: scenario.actor.roomId
    },
    inactivityTimeoutMs: 0,
    maxWaitMs: 1,
    processHistoricalMessages: true,
    ignoreMessagesBeforeStartup: false,
    dependencies: {
      listenMatrixEvents: createFakeListener({
        runId: params.runId,
        scenario
      }),
      sendMatrixDeliveryMessages: createFakeDelivery({
        runId: params.runId,
        scenario,
        writtenSentFiles: fakeSentFiles
      }),
      ...(params.options.debug
        ? {
            runSupportAutomationTurnV2: async (input) => {
              return runDebugSupportAutomationTurn({
                bufferedMessages: input.bufferedMessages,
                scenario,
                options: params.options,
                debugArtifacts
              });
            },
            ...(params.options.until !== "all"
              ? {
                  applyLiveMemoryUpdate: async () => {
                    return seedLiveMemory;
                  }
                }
              : {})
          }
        : {})
    },
    logger: params.options.debug && params.options.verbose ? console : {
      log: () => undefined,
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined
    }
  });
  const records = await handle.flushPending();
  await handle.stop();

  const sentContentParts: string[] = [];

  for (const filePath of fakeSentFiles) {
    const rawContent = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(rawContent) as { content?: unknown };

    if (typeof parsed.content === "string" && parsed.content.trim() !== "") {
      sentContentParts.push(parsed.content);
    }
  }

  const sentContent = sentContentParts.join("\n\n");
  const liveMemory = await readLiveMemoryContext(turnIdentity.conversationKey);
  const ragUsage = records[0]?.supportAutomationTurnResult
    .supportProcessingOutput.ragUsage;
  const matrixDeliveryResults = records.flatMap((record) => {
    return record.matrixDeliveryResults;
  });
  const stoppedByDebug = debugArtifacts.value?.debugStatus.status === "stopped";
  const assertions = stoppedByDebug
    ? []
    : [
        ...assertSentShouldMention({
          expectedFragments: scenario.expected?.sentShouldMention,
          sentContent
        }),
        ...assertSentShouldNotMention({
          expectedFragments: scenario.expected?.sentShouldNotMention,
          sentContent
        }),
        ...assertLastBotVerbatim({
          enabled: scenario.expected?.liveMemoryLastBotShouldEqualSent,
          sentContent,
          liveMemory
        }),
        ...assertRagUsage({
          expected: scenario.expected,
          ragUsage
        })
      ];
  const datasetAssertionsFailed =
    debugArtifacts.value?.datasetAssertions.status === "failed";
  const report: ScenarioReport = {
    scenarioId: scenario.id,
    name: scenario.name,
    conversationKey: turnIdentity.conversationKey,
    fakeReceivedFiles,
    fakeSentFiles,
    sentContent,
    liveMemoryPath,
    liveMemory,
    matrixDeliveryResults,
    assertions,
    ...(debugArtifacts.value ? { debugArtifacts: debugArtifacts.value } : {}),
    status: stoppedByDebug
      ? "stopped"
      : assertions.some((assertion) => assertion.status === "failed") ||
        datasetAssertionsFailed
      ? "failed"
      : "passed"
  };

  if (params.options.debug && debugArtifacts.value) {
    const paths = await writeCaseReportFiles({
      runId: params.runId,
      scenario,
      report,
      reportDir: params.reportDir,
      splitDebugFiles: params.options.splitDebugFiles
    });
    logDebugScenarioSummary({
      report,
      summaryPath: paths.summaryPath,
      debugPath: paths.debugPath,
      verbose: params.options.verbose
    });
  } else {
    await writeJsonFile(path.join(params.reportDir, `${scenario.id}.json`), report);
  }

  return report;
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex]);
    }
  }

  await Promise.all(
    Array.from({
      length: Math.min(concurrency, items.length)
    }, () => runWorker())
  );

  return results;
}

async function runScenarioSet(params: {
  runId: string;
  scenarios: GlobalPipelineCase[];
  options: RunnerOptions;
  reportDir: string;
}): Promise<ScenarioReport[]> {
  const reports: ScenarioReport[] = [];

  for (
    let startIndex = 0;
    startIndex < params.scenarios.length;
    startIndex += params.options.waveSize
  ) {
    const wave = params.scenarios.slice(
      startIndex,
      startIndex + params.options.waveSize
    );
    const waveReports = await runWithConcurrency(
      wave,
      params.options.concurrency,
      async (scenario) => {
        try {
          return await runScenario({
            runId: params.runId,
            scenario,
            reportDir: params.reportDir,
            options: params.options
          });
        } catch (error) {
          const report: ScenarioReport = {
            scenarioId: scenario.id,
            name: scenario.name,
            conversationKey: "",
            fakeReceivedFiles: [],
            fakeSentFiles: [],
            sentContent: "",
            liveMemoryPath: "",
            liveMemory: null,
            matrixDeliveryResults: [],
            assertions: [],
            status: "failed",
            error: error instanceof Error ? error.message : String(error)
          };

          if (params.options.debug) {
            await writeCaseReportFiles({
              runId: params.runId,
              scenario,
              report,
              reportDir: params.reportDir,
              splitDebugFiles: params.options.splitDebugFiles
            });
          } else {
            await writeJsonFile(
              path.join(params.reportDir, `${scenario.id}.json`),
              report
            );
          }

          return report;
        }
      }
    );

    reports.push(...waveReports);

    if (startIndex + params.options.waveSize < params.scenarios.length) {
      await sleep(params.options.waveDelayMs);
    }
  }

  return reports;
}

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  const options = parseOptions(process.argv.slice(2));

  if (options.emptyData) {
    await emptyFakeMatrixDataDirectories();
    console.log("Emptied fake Matrix data directories.");
    return;
  }

  if (options.list) {
    listScenarios();
    return;
  }

  const selectedScenarios = selectScenarios(options);

  if (selectedScenarios.length === 0) {
    throw new Error("No global pipeline cases selected.");
  }

  const runId = buildRunId();
  const reportDir = path.join(REPORT_ROOT_DIR, runId);

  await fs.mkdir(FAKE_RECEIVED_DIR, {
    recursive: true
  });
  await fs.mkdir(FAKE_SENT_DIR, {
    recursive: true
  });
  await fs.mkdir(reportDir, {
    recursive: true
  });

  const reports = await runScenarioSet({
    runId,
    scenarios: selectedScenarios,
    options,
    reportDir
  });
  const completedAt = new Date().toISOString();
  const status = reports.some((report) => report.status === "failed")
    ? "failed"
    : reports.some((report) => report.status === "stopped")
      ? "stopped"
      : "passed";
  const summary = {
    runId,
    status,
    reportDir,
    startedAt,
    completedAt,
    selectedCaseIds: selectedScenarios.map((scenario) => scenario.id),
    totalCases: reports.length,
    passedCount: reports.filter((report) => report.status === "passed").length,
    failedCount: reports.filter((report) => report.status === "failed").length,
    stoppedCount: reports.filter((report) => report.status === "stopped").length,
    skippedCount: 0,
    cases: reports.map((report) => {
      const paths = buildCaseReportPaths({
        reportDir,
        caseId: report.scenarioId
      });
      const stoppedAfterStep =
        report.debugArtifacts?.debugStatus.stoppedAfterStep;

      return {
      caseId: report.scenarioId,
      name: report.name,
      status: report.status,
      assertionSummary: buildAssertionSummary(report),
      ...(stoppedAfterStep ? { stoppedAfterStep } : {}),
      ...(report.sentContent ? { sentContent: report.sentContent } : {}),
      summaryPath: paths.summaryPath,
      debugPath: paths.debugPath
      };
    })
  };

  await writeJsonFile(path.join(reportDir, "summary.json"), summary);

  if (options.cleanFiles) {
    await cleanupRunFiles(runId);
  }

  console.log("Global summary:");
  console.log(path.join(reportDir, "summary.json"));

  if (summary.status === "failed") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
