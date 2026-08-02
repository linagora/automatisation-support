import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {
  createEmptyLiveMemoryContextOptimized,
  createEmptyLiveMemoryTopicOptimized
} from "../../src/infrastructure/live-memory/liveMemoryDefaults";
import {
  buildLiveMemoryContextPath,
  getConversationMemoryDirectoryPath,
  getConversationMemoryFilePath,
  getKnowledgeMemoryFilePath,
  getLegacyLiveMemoryFilePath,
  getStateMemoryFilePath,
  readLiveMemoryContext,
  writeLiveMemoryContext
} from "../../src/infrastructure/live-memory/liveMemoryContextStore";

import type {
  LiveMemoryContextOptimized,
  LiveMemoryTopicOptimized
} from "../../src/infrastructure/live-memory/liveMemoryContextOptimized.template";

function buildTopic(params: {
  topicId: number;
  title: string | null;
  status: LiveMemoryTopicOptimized["status"];
  supportNeed: LiveMemoryTopicOptimized["sourceTopicManager"]["supportNeedResolution"]["supportNeed"]["value"];
}): LiveMemoryTopicOptimized {
  const topic = createEmptyLiveMemoryTopicOptimized(params.topicId);

  return {
    ...topic,
    status: params.status,
    sourceProposeTopicUpdates: {
      ...topic.sourceProposeTopicUpdates,
      title: params.title
    },
    sourceTopicManager: {
      ...topic.sourceTopicManager,
      supportNeedResolution: {
        supportNeed: {
          value: params.supportNeed,
          reason: null
        }
      }
    }
  };
}

function buildThreeTopics(): LiveMemoryTopicOptimized[] {
  return [
    buildTopic({
      topicId: 3,
      title: "Unsolved topic",
      status: "unsolved",
      supportNeed: "support_action"
    }),
    buildTopic({
      topicId: 1,
      title: "In progress topic",
      status: "in_progress",
      supportNeed: "issue_resolution"
    }),
    buildTopic({
      topicId: 2,
      title: null,
      status: "solved_by_bot",
      supportNeed: "knowledge_answer"
    })
  ];
}

async function writeRawJsonFile(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), {recursive: true});
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readJsonFile(filePath: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function buildLegacyMemory(topics: LiveMemoryTopicOptimized[] = buildThreeTopics()): unknown {
  return {
    handover: {
      isHandover: false,
      handoverReason: null
    },
    previousConversationTurn: {
      previousUserMessage: null,
      previousBotMessage: null
    },
    failedPipelineMessages: [],
    securityAlerts: [],
    userState: {
      status: "normal",
      flags: []
    },
    topics
  };
}

function buildContext(params: {
  isBotActive?: boolean;
  topics?: LiveMemoryTopicOptimized[];
} = {}): LiveMemoryContextOptimized {
  return {
    ...createEmptyLiveMemoryContextOptimized(),
    isBotActive: params.isBotActive ?? true,
    topics: params.topics ?? buildThreeTopics()
  };
}

async function expectFileExists(filePath: string): Promise<void> {
  await expect(fs.access(filePath)).resolves.toBeUndefined();
}

describe("live memory optimized storage migration", function () {
  let tempDir: string;
  let previousDirectory: string | undefined;

  beforeEach(async function () {
    tempDir = await fs.mkdtemp(path.join(
      os.tmpdir(),
      "live-memory-optimized-migration-"
    ));
    previousDirectory = process.env.LIVE_MEMORY_CONTEXT_DIR;
    process.env.LIVE_MEMORY_CONTEXT_DIR = tempDir;
  });

  afterEach(async function () {
    if (previousDirectory === undefined) {
      delete process.env.LIVE_MEMORY_CONTEXT_DIR;
    } else {
      process.env.LIVE_MEMORY_CONTEXT_DIR = previousDirectory;
    }

    await fs.rm(tempDir, {
      recursive: true,
      force: true
    });
  });

  it("creates an empty context with bot active and an empty topics summary", function () {
    const context = createEmptyLiveMemoryContextOptimized();

    expect(context.isBotActive).toBe(true);
    expect(context.topicsSummary.total).toBe(0);
    expect(context.topicsSummary.topics).toEqual([]);
  });

  it("normalizes an old memory without new fields with a recalculated topics summary", async function () {
    const topics = buildThreeTopics();

    await writeRawJsonFile(
      getLegacyLiveMemoryFilePath("old-memory"),
      buildLegacyMemory(topics)
    );

    const context = await readLiveMemoryContext("old-memory");

    expect(context?.isBotActive).toBe(true);
    expect(context?.topicsSummary).toEqual({
      total: 3,
      byStatus: {
        in_progress: 1,
        solved_by_bot: 1,
        unsolved: 1
      },
      topics: [
        {
          topicId: 1,
          title: "In progress topic",
          status: "in_progress",
          supportNeed: "issue_resolution"
        },
        {
          topicId: 2,
          title: null,
          status: "solved_by_bot",
          supportNeed: "knowledge_answer"
        },
        {
          topicId: 3,
          title: "Unsolved topic",
          status: "unsolved",
          supportNeed: "support_action"
        }
      ]
    });
  });

  it("recalculates an inconsistent provided summary when writing and preserves isBotActive", async function () {
    const context: LiveMemoryContextOptimized = {
      ...createEmptyLiveMemoryContextOptimized(),
      isBotActive: false,
      topicsSummary: {
        total: 999,
        byStatus: {
          in_progress: 999,
          solved_by_bot: 999,
          unsolved: 999
        },
        topics: []
      },
      topics: buildThreeTopics()
    };

    await writeLiveMemoryContext("written-memory", context);

    const rawWritten = JSON.parse(
      await fs.readFile(buildLiveMemoryContextPath("written-memory"), "utf8")
    ) as LiveMemoryContextOptimized;

    expect(Object.keys(rawWritten).slice(0, 2)).toEqual([
      "isBotActive",
      "topicsSummary"
    ]);
    expect(rawWritten.isBotActive).toBe(false);
    expect(rawWritten.topicsSummary.total).toBe(3);
    expect(rawWritten.topicsSummary.byStatus).toEqual({
      in_progress: 1,
      solved_by_bot: 1,
      unsolved: 1
    });
    expect(rawWritten.topicsSummary.topics).toEqual([
      {
        topicId: 1,
        title: "In progress topic",
        status: "in_progress",
        supportNeed: "issue_resolution"
      },
      {
        topicId: 2,
        title: null,
        status: "solved_by_bot",
        supportNeed: "knowledge_answer"
      },
      {
        topicId: 3,
        title: "Unsolved topic",
        status: "unsolved",
        supportNeed: "support_action"
      }
    ]);
  });

  it("creates the new conversation directory with state, conversation, and knowledge files", async function () {
    await writeLiveMemoryContext("first-write", buildContext());

    const stateMemoryPath = getStateMemoryFilePath("first-write");
    const conversationMemoryPath = getConversationMemoryFilePath("first-write");
    const knowledgeMemoryPath = getKnowledgeMemoryFilePath("first-write");

    await expectFileExists(stateMemoryPath);
    await expectFileExists(conversationMemoryPath);
    await expectFileExists(knowledgeMemoryPath);
    expect(buildLiveMemoryContextPath("first-write")).toBe(stateMemoryPath);
    expect(await readJsonFile(conversationMemoryPath)).toEqual({
      messages: []
    });
    expect(await readJsonFile(knowledgeMemoryPath)).toEqual({
      retrievals: []
    });
  });

  it("writes the current state memory shape and recalculates topicsSummary", async function () {
    await writeLiveMemoryContext("state-shape", {
      ...buildContext(),
      topicsSummary: {
        total: 42,
        byStatus: {
          in_progress: 42,
          solved_by_bot: 42,
          unsolved: 42
        },
        topics: []
      }
    });

    const stateMemory = await readJsonFile(
      getStateMemoryFilePath("state-shape")
    ) as Record<string, unknown>;

    expect(Object.keys(stateMemory)).toEqual([
      "isBotActive",
      "topicsSummary",
      "handover",
      "previousConversationTurn",
      "failedPipelineMessages",
      "securityAlerts",
      "userState",
      "topics"
    ]);
    expect((stateMemory.topicsSummary as {total: number}).total).toBe(3);
  });

  it("reads the new state-memory.json format", async function () {
    await writeRawJsonFile(
      getStateMemoryFilePath("new-format"),
      {
        ...buildLegacyMemory(),
        isBotActive: false,
        topicsSummary: {
          total: 999,
          byStatus: {
            in_progress: 999,
            solved_by_bot: 999,
            unsolved: 999
          },
          topics: []
        }
      }
    );

    const context = await readLiveMemoryContext("new-format");

    expect(context?.isBotActive).toBe(false);
    expect(context?.topicsSummary.total).toBe(3);
  });

  it("prioritizes state-memory.json over the legacy file", async function () {
    await writeRawJsonFile(
      getLegacyLiveMemoryFilePath("both-formats"),
      {
        ...buildLegacyMemory([
          buildTopic({
            topicId: 9,
            title: "Legacy topic",
            status: "unsolved",
            supportNeed: "support_action"
          })
        ]),
        isBotActive: true
      }
    );
    await writeRawJsonFile(
      getStateMemoryFilePath("both-formats"),
      {
        ...buildLegacyMemory([
          buildTopic({
            topicId: 1,
            title: "New topic",
            status: "solved_by_bot",
            supportNeed: "knowledge_answer"
          })
        ]),
        isBotActive: false
      }
    );

    const context = await readLiveMemoryContext("both-formats");

    expect(context?.isBotActive).toBe(false);
    expect(context?.topicsSummary.topics).toEqual([
      {
        topicId: 1,
        title: "New topic",
        status: "solved_by_bot",
        supportNeed: "knowledge_answer"
      }
    ]);
  });

  it("migrates progressively from the legacy file on the next write", async function () {
    const legacyPath = getLegacyLiveMemoryFilePath("progressive");

    await writeRawJsonFile(legacyPath, buildLegacyMemory([
      buildTopic({
        topicId: 1,
        title: "Legacy before write",
        status: "in_progress",
        supportNeed: "issue_resolution"
      })
    ]));

    const context = await readLiveMemoryContext("progressive");
    expect(context?.topicsSummary.topics[0]?.title).toBe("Legacy before write");

    await writeLiveMemoryContext("progressive", {
      ...context,
      isBotActive: false,
      topics: [
        buildTopic({
          topicId: 1,
          title: "New after write",
          status: "solved_by_bot",
          supportNeed: "knowledge_answer"
        })
      ]
    } as LiveMemoryContextOptimized);

    await expectFileExists(getConversationMemoryDirectoryPath("progressive"));
    await expectFileExists(getStateMemoryFilePath("progressive"));
    await expectFileExists(getConversationMemoryFilePath("progressive"));
    await expectFileExists(getKnowledgeMemoryFilePath("progressive"));
    await expectFileExists(legacyPath);

    const reread = await readLiveMemoryContext("progressive");

    expect(reread?.isBotActive).toBe(false);
    expect(reread?.topicsSummary.topics[0]?.title).toBe("New after write");
  });

  it("does not overwrite existing conversation or knowledge memory files", async function () {
    await writeLiveMemoryContext("auxiliary-files", buildContext());

    const conversationMemoryPath =
      getConversationMemoryFilePath("auxiliary-files");
    const knowledgeMemoryPath = getKnowledgeMemoryFilePath("auxiliary-files");
    const conversationMemory = {
      messages: [{role: "user", content: "Already stored"}]
    };
    const knowledgeMemory = {
      retrievals: [{id: "retrieval_1"}]
    };

    await writeRawJsonFile(conversationMemoryPath, conversationMemory);
    await writeRawJsonFile(knowledgeMemoryPath, knowledgeMemory);
    await writeLiveMemoryContext("auxiliary-files", buildContext({
      isBotActive: false,
      topics: [
        buildTopic({
          topicId: 1,
          title: "Updated state only",
          status: "unsolved",
          supportNeed: "support_action"
        })
      ]
    }));

    expect(await readJsonFile(conversationMemoryPath)).toEqual(conversationMemory);
    expect(await readJsonFile(knowledgeMemoryPath)).toEqual(knowledgeMemory);
  });
});
