import "dotenv/config";

import * as fs from "fs/promises";
import * as path from "path";

import {
  fakeMatrixScenarioDataset
} from "./fakeMatrixScenarioDataset";
import {
  buildSupportTurnIdentityV2
} from "../../src/support-automation/build-input/buildSupportTurnIdentityV2";
import {
  runMatrixSupportAutomationV2
} from "../../src/support-automation/runMatrixSupportAutomationV2";
import {
  buildLiveMemoryContextPath,
  readLiveMemoryContext
} from "../../src/infrastructure/live-memory/liveMemoryContextStore";

import type {
  FakeMatrixScenario
} from "./fakeMatrixScenarioDataset";
import type {
  BufferedMessages,
  MessagingEvent
} from "../../src/support-automation/buffer/typesMessaging.types";
import type {
  MatrixChannelConfig,
  MatrixDeliveryResult
} from "../../src/infrastructure/matrix/typesMatrixChannel.types";
import type {
  LiveMemoryContext
} from "../../src/infrastructure/live-memory/typesLiveMemoryContext.types";

const FAKE_RECEIVED_DIR = path.resolve("data/fake-received");
const FAKE_SENT_DIR = path.resolve("data/fake-sent");
const REPORT_ROOT_DIR = "/tmp/support-v2-fake-matrix-runs";

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
  status: "passed" | "failed";
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
  debug: boolean;
  caseIds: string[];
  tags: string[];
};

function getArgValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);

  return index === -1 ? undefined : args[index + 1];
}

function getAllArgValues(args: string[], flag: string): string[] {
  const values: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === flag && args[index + 1]) {
      values.push(args[index + 1]);
    }
  }

  return values;
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
    debug: args.includes("--debug"),
    caseIds: getAllArgValues(args, "--case"),
    tags: getAllArgValues(args, "--tag")
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

function formatMessageIndex(index: number): string {
  return String(index + 1).padStart(3, "0");
}

function buildFakeBufferedMessages(scenario: FakeMatrixScenario): BufferedMessages {
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

function buildSeedLiveMemory(scenario: FakeMatrixScenario): LiveMemoryContext {
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

function selectScenarios(options: RunnerOptions): FakeMatrixScenario[] {
  if (options.list) {
    return [];
  }

  if (options.caseIds.length > 0) {
    return options.caseIds.map((caseId) => {
      const scenario = fakeMatrixScenarioDataset.find((candidate) => {
        return candidate.id === caseId;
      });

      if (!scenario) {
        throw new Error(`Unknown fake Matrix scenario "${caseId}".`);
      }

      return scenario;
    });
  }

  if (options.tags.length > 0) {
    return fakeMatrixScenarioDataset.filter((scenario) => {
      return options.tags.every((tag) => scenario.tags.includes(tag));
    });
  }

  if (options.all) {
    return fakeMatrixScenarioDataset;
  }

  return [fakeMatrixScenarioDataset[0]];
}

function listScenarios(): void {
  console.log("\nAvailable fake Matrix V2 scenarios:\n");

  for (const scenario of fakeMatrixScenarioDataset) {
    console.log(`  ${scenario.id} - ${scenario.name} [${scenario.tags.join(", ")}]`);
  }

  console.log("");
}

async function writeFakeReceivedFiles(params: {
  runId: string;
  scenario: FakeMatrixScenario;
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
  scenario: FakeMatrixScenario;
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
  scenario: FakeMatrixScenario;
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
  expected: FakeMatrixScenario["expected"];
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

async function runScenario(params: {
  runId: string;
  scenario: FakeMatrixScenario;
  reportDir: string;
  debug: boolean;
}): Promise<ScenarioReport> {
  const scenario = params.scenario;
  const turnIdentity = buildSupportTurnIdentityV2(buildFakeBufferedMessages(scenario));
  const liveMemoryPath = buildLiveMemoryContextPath(turnIdentity.conversationKey);
  const seedLiveMemory = buildSeedLiveMemory(scenario);
  const fakeSentFiles: string[] = [];

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
      })
    },
    logger: params.debug ? console : {
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
  const assertions = [
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
  const matrixDeliveryResults = records.flatMap((record) => {
    return record.matrixDeliveryResults;
  });
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
    status: assertions.some((assertion) => assertion.status === "failed")
      ? "failed"
      : "passed"
  };

  await writeJsonFile(path.join(params.reportDir, `${scenario.id}.json`), report);

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
  scenarios: FakeMatrixScenario[];
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
            debug: params.options.debug
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

          await writeJsonFile(
            path.join(params.reportDir, `${scenario.id}.json`),
            report
          );

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
  const options = parseOptions(process.argv.slice(2));

  if (options.list) {
    listScenarios();
    return;
  }

  const selectedScenarios = selectScenarios(options);

  if (selectedScenarios.length === 0) {
    throw new Error("No fake Matrix scenarios selected.");
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
  const summary = {
    runId,
    reportDir,
    selectedScenarioIds: selectedScenarios.map((scenario) => scenario.id),
    status: reports.some((report) => report.status === "failed")
      ? "failed"
      : "passed",
    reports: reports.map((report) => ({
      scenarioId: report.scenarioId,
      status: report.status,
      assertionSummary: {
        passed: report.assertions.filter((assertion) => assertion.status === "passed").length,
        failed: report.assertions.filter((assertion) => assertion.status === "failed").length,
        skipped: report.assertions.filter((assertion) => assertion.status === "skipped").length
      },
      reportPath: path.join(reportDir, `${report.scenarioId}.json`)
    }))
  };

  await writeJsonFile(path.join(reportDir, "summary.json"), summary);

  if (!options.keepFiles) {
    await cleanupRunFiles(runId);
  }

  console.log(stringify(summary));

  if (summary.status === "failed") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
