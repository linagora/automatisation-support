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

async function writeRawMemory(conversationKey: string, value: unknown): Promise<void> {
  const filePath = buildLiveMemoryContextPath(conversationKey);

  await fs.mkdir(path.dirname(filePath), {recursive: true});
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

describe("live memory optimized first migration fields", function () {
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

    await writeRawMemory("old-memory", {
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
    });

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
});
