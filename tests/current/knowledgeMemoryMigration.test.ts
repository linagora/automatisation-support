import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {
  createEmptyLiveMemoryContextOptimized,
  createEmptyLiveMemoryTopicOptimized
} from "../../src/infrastructure/live-memory/liveMemoryDefaults";
import {
  consumeLegacyKnowledgeRetrievals,
  getKnowledgeMemoryFilePath,
  getStateMemoryFilePath,
  readLiveMemoryContext,
  writeLiveMemoryContext
} from "../../src/infrastructure/live-memory/liveMemoryContextStore";
import {
  applyKnowledgeMemoryPatch,
  attachKnowledgeRetrievalTopicIds,
  createEmptyKnowledgeMemory,
  createKnowledgeRetrieval,
  getKnowledgeRetrievalById,
  readKnowledgeMemory,
  upsertKnowledgeRetrieval,
  writeKnowledgeMemory
} from "../../src/infrastructure/live-memory/knowledgeMemoryStore";
import {runRetrieveKnowledge} from "../../src/support-automation/support-processing-pipeline-optimized/topic-manager/topic-treatement/issue-resolution-branch/retrieve-knowledge/runRetrieveKnowledge";
import {
  getActiveKnowledgeRetrievalAfterPatch
} from "../../src/support-automation/support-processing-pipeline-optimized/topic-manager/topic-treatement/issue-resolution-branch/runIssueResolutionBranch";

import type {KnowledgeMemoryRetrieval} from "../../src/infrastructure/live-memory/knowledgeMemory.template";
import type {LiveMemoryTopicOptimized} from "../../src/infrastructure/live-memory/liveMemoryContextOptimized.template";
import type {RawRagKnowledge} from "../../src/support-automation/support-processing-pipeline-optimized/topic-manager/topic-treatement/issue-resolution-branch/retrieve-knowledge/ranked-search/runRankedSearch--oneShotStep";
import type {SegmentedKnowledgeBySource} from "../../src/support-automation/support-processing-pipeline-optimized/topic-manager/topic-treatement/issue-resolution-branch/retrieve-knowledge/segmentation-knowledge/runSegmentationKnowledge--oneShotStep";

function buildRawKnowledge(label: string, candidates: RawRagKnowledge["candidates"] = []): RawRagKnowledge {
  return {
    query: `query ${label}`,
    content: `content ${label}`,
    candidates,
    sources: [{source: label}],
    metadata: {
      retriever: "openrag"
    }
  };
}

function buildSegmentedKnowledge(rawKnowledgeId: string): SegmentedKnowledgeBySource[] {
  return [{
    rawKnowledgeId,
    userFacingKnowledge: [{
      text: "Try clearing the local cache.",
      sourceHint: "FAQ",
      sourceSpan: null
    }],
    supportFacingKnowledge: [{
      text: "Cache invalidation can block sync.",
      sourceHint: "Runbook",
      sourceSpan: null
    }]
  }];
}

function buildRetrieval(params: {
  retrievalId: string;
  topicId: number | null;
  workflow?: KnowledgeMemoryRetrieval["workflow"];
  rawRagKnowledge?: RawRagKnowledge | null;
  segmentedKnowledge?: SegmentedKnowledgeBySource[];
}): KnowledgeMemoryRetrieval {
  return {
    retrievalId: params.retrievalId,
    topicId: params.topicId,
    workflow: params.workflow ?? "issueResolution",
    rawRagKnowledge: params.rawRagKnowledge ?? null,
    segmentedKnowledge: params.segmentedKnowledge ?? []
  };
}

function buildTopicWithRetrievals(input: {
  topicId: number;
  activeRetrievalId: string | null;
  retrievalIds: string[];
}): LiveMemoryTopicOptimized {
  const topic = createEmptyLiveMemoryTopicOptimized(input.topicId);

  return {
    ...topic,
    sourceTopicManager: {
      ...topic.sourceTopicManager,
      supportNeedResolution: {
        supportNeed: {
          value: "issue_resolution",
          reason: null
        }
      },
      workflows: {
        ...topic.sourceTopicManager.workflows,
        issueResolution: {
          ...topic.sourceTopicManager.workflows.issueResolution,
          retrieveKnowledge: {
            ...topic.sourceTopicManager.workflows.issueResolution.retrieveKnowledge,
            activeRetrievalId: input.activeRetrievalId,
            retrievalIds: input.retrievalIds
          }
        }
      }
    }
  };
}

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function writeRawJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), {recursive: true});
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

describe("knowledge memory migration", function () {
  let tempDir: string;
  let previousDirectory: string | undefined;

  beforeEach(async function () {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "knowledge-memory-migration-"));
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

  it("creates a default state without raw or segmented knowledge content", async function () {
    const retrieveKnowledge =
      createEmptyLiveMemoryTopicOptimized(1)
        .sourceTopicManager
        .workflows
        .issueResolution
        .retrieveKnowledge;

    expect(retrieveKnowledge.activeRetrievalId).toBe(null);
    expect(retrieveKnowledge.retrievalIds).toEqual([]);
    expect("rawRagKnowledge" in retrieveKnowledge.rankedSearch).toBe(false);
    expect("segmentedKnowledge" in retrieveKnowledge.segmentationKnowledge).toBe(false);
    expect("retrievalAttemptCount" in retrieveKnowledge).toBe(false);
    expect("attempt" in retrieveKnowledge).toBe(false);

    await writeLiveMemoryContext("default-state", {
      ...createEmptyLiveMemoryContextOptimized(),
      topics: [createEmptyLiveMemoryTopicOptimized(1)]
    });

    const state = await readJson(getStateMemoryFilePath("default-state"));
    expect(JSON.stringify(state)).not.toContain("rawRagKnowledge");
    expect(JSON.stringify(state)).not.toContain("segmentedKnowledge");
    expect(JSON.stringify(state)).not.toContain("retrievalAttemptCount");
  });

  it("creates the first retrieval with raw knowledge stored outside state", async function () {
    const rawRagKnowledge = buildRawKnowledge("first");

    const output = await runRetrieveKnowledge({
      previousRetrieveKnowledge: createEmptyLiveMemoryTopicOptimized(1).sourceTopicManager.workflows.issueResolution.retrieveKnowledge,
      activeKnowledgeRetrieval: null,
      topicId: 1,
      summaryTopic: "Sync issue",
      currentUserMessage: {content: "Sync is broken"},
      previousConversationTurn: {
        previousUserMessage: null,
        previousBotMessage: null
      },
      searchSimilarIssueTopics: async () => rawRagKnowledge
    });

    const retrievalId = output.retrieveKnowledge.activeRetrievalId;
    expect(retrievalId).toMatch(/^retrieval_/u);
    expect(output.retrieveKnowledge.retrievalIds).toEqual([retrievalId]);
    expect("rawRagKnowledge" in output.retrieveKnowledge.rankedSearch).toBe(false);
    expect(output.knowledgeMemoryPatch.upsertRetrievals.at(-1)).toMatchObject({
      retrievalId,
      topicId: 1,
      workflow: "issueResolution",
      rawRagKnowledge
    });
  });

  it("stores segmented knowledge in the same knowledge retrieval entry", function () {
    const retrieval = createKnowledgeRetrieval({
      topicId: 1,
      workflow: "issueResolution",
      rawRagKnowledge: buildRawKnowledge("segmented"),
      segmentedKnowledge: buildSegmentedKnowledge("raw_knowledge_1")
    });
    const knowledgeMemory = upsertKnowledgeRetrieval(createEmptyKnowledgeMemory(), retrieval);

    expect(knowledgeMemory.retrievals).toHaveLength(1);
    expect(knowledgeMemory.retrievals[0].segmentedKnowledge).toEqual(
      buildSegmentedKnowledge("raw_knowledge_1")
    );
  });

  it("replaces retrievals with complete newer snapshots", function () {
    const rawRagKnowledge = buildRawKnowledge("snapshot");
    const firstSnapshot = buildRetrieval({
      retrievalId: "retrieval_snapshot",
      topicId: 1,
      rawRagKnowledge
    });
    const newerSnapshot = buildRetrieval({
      retrievalId: "retrieval_snapshot",
      topicId: 1,
      rawRagKnowledge,
      segmentedKnowledge: buildSegmentedKnowledge("raw_knowledge_1")
    });

    const knowledgeMemory = applyKnowledgeMemoryPatch(createEmptyKnowledgeMemory(), {
      upsertRetrievals: [
        firstSnapshot,
        newerSnapshot
      ]
    });

    expect(knowledgeMemory.retrievals).toEqual([newerSnapshot]);
    expect(knowledgeMemory.retrievals[0].rawRagKnowledge).toBe(rawRagKnowledge);
    expect(knowledgeMemory.retrievals[0].segmentedKnowledge).toEqual(
      buildSegmentedKnowledge("raw_knowledge_1")
    );
  });

  it("supports a second retrieval without overwriting the first one", function () {
    const first = createKnowledgeRetrieval({
      topicId: 1,
      workflow: "issueResolution",
      rawRagKnowledge: buildRawKnowledge("first")
    });
    const second = createKnowledgeRetrieval({
      topicId: 1,
      workflow: "issueResolution",
      rawRagKnowledge: buildRawKnowledge("second")
    });
    const state = {
      ...createEmptyLiveMemoryTopicOptimized(1).sourceTopicManager.workflows.issueResolution.retrieveKnowledge,
      activeRetrievalId: second.retrievalId,
      retrievalIds: [first.retrievalId, second.retrievalId]
    };
    const knowledgeMemory = applyKnowledgeMemoryPatch(createEmptyKnowledgeMemory(), {
      upsertRetrievals: [first, second]
    });

    expect(state.retrievalIds).toEqual([first.retrievalId, second.retrievalId]);
    expect(state.activeRetrievalId).toBe(second.retrievalId);
    expect("retrievalAttemptCount" in state).toBe(false);
    expect(knowledgeMemory.retrievals).toEqual([first, second]);
  });

  it("selects the latest active retrieval snapshot from the current run", function () {
    const rawRagKnowledge = buildRawKnowledge("active");
    const firstSnapshot = buildRetrieval({
      retrievalId: "retrieval_active",
      topicId: 1
    });
    const secondSnapshot = buildRetrieval({
      retrievalId: "retrieval_active",
      topicId: 1,
      rawRagKnowledge
    });
    const thirdSnapshot = buildRetrieval({
      retrievalId: "retrieval_active",
      topicId: 1,
      rawRagKnowledge,
      segmentedKnowledge: buildSegmentedKnowledge("raw_knowledge_1")
    });

    const activeRetrieval = getActiveKnowledgeRetrievalAfterPatch({
      previous: null,
      activeRetrievalId: "retrieval_active",
      patch: {
        upsertRetrievals: [
          firstSnapshot,
          secondSnapshot,
          thirdSnapshot
        ]
      }
    });

    expect(activeRetrieval).toBe(thirdSnapshot);
    expect(activeRetrieval?.segmentedKnowledge).toEqual(
      buildSegmentedKnowledge("raw_knowledge_1")
    );
  });

  it("reloads state and knowledge independently", async function () {
    const retrieval = createKnowledgeRetrieval({
      topicId: 1,
      workflow: "issueResolution",
      rawRagKnowledge: buildRawKnowledge("reload", [{
        rawKnowledgeId: "raw_knowledge_1",
        rawKnowledge: "Restart the sync client.",
        whyPotentiallyRelevant: "sync",
        sourceHint: "FAQ"
      }]),
      segmentedKnowledge: buildSegmentedKnowledge("raw_knowledge_1")
    });
    const topic = buildTopicWithRetrievals({
      topicId: 1,
      activeRetrievalId: retrieval.retrievalId,
      retrievalIds: [retrieval.retrievalId]
    });

    await writeLiveMemoryContext("reload", {
      ...createEmptyLiveMemoryContextOptimized(),
      topics: [topic]
    });
    await writeKnowledgeMemory("reload", {
      retrievals: [retrieval]
    });

    const state = await readLiveMemoryContext("reload");
    const knowledgeMemory = await readKnowledgeMemory("reload");
    const activeRetrieval = getKnowledgeRetrievalById(
      knowledgeMemory,
      state?.topics?.[0]?.sourceTopicManager.workflows.issueResolution.retrieveKnowledge.activeRetrievalId ?? ""
    );

    expect(activeRetrieval?.rawRagKnowledge?.candidates[0].rawKnowledgeId).toBe("raw_knowledge_1");
    expect(activeRetrieval?.segmentedKnowledge[0].rawKnowledgeId).toBe("raw_knowledge_1");
    expect(JSON.stringify(state)).not.toContain("Restart the sync client.");
  });

  it("attaches final topic IDs to retrievals created with topicId null", function () {
    const retrieval = buildRetrieval({
      retrievalId: "retrieval_new",
      topicId: null
    });
    const topic = buildTopicWithRetrievals({
      topicId: 7,
      activeRetrievalId: "retrieval_new",
      retrievalIds: ["retrieval_new"]
    });

    const updated = attachKnowledgeRetrievalTopicIds({
      knowledgeMemory: {
        retrievals: [retrieval]
      },
      topics: [topic]
    });

    expect(updated.retrievals[0]).toEqual({
      ...retrieval,
      topicId: 7
    });
  });

  it("attaches multiple null-topic retrievals to their final topics without changing ids", function () {
    const firstRetrieval = buildRetrieval({
      retrievalId: "retrieval_first",
      topicId: null
    });
    const secondRetrieval = buildRetrieval({
      retrievalId: "retrieval_second",
      topicId: null
    });
    const firstTopic = buildTopicWithRetrievals({
      topicId: 10,
      activeRetrievalId: "retrieval_first",
      retrievalIds: ["retrieval_first"]
    });
    const secondTopic = buildTopicWithRetrievals({
      topicId: 11,
      activeRetrievalId: "retrieval_second",
      retrievalIds: ["retrieval_second"]
    });

    const updated = attachKnowledgeRetrievalTopicIds({
      knowledgeMemory: {
        retrievals: [
          firstRetrieval,
          secondRetrieval
        ]
      },
      topics: [
        firstTopic,
        secondTopic
      ]
    });

    expect(updated.retrievals).toEqual([
      {
        ...firstRetrieval,
        topicId: 10
      },
      {
        ...secondRetrieval,
        topicId: 11
      }
    ]);
  });

  it("rejects ambiguous retrieval ids attached to multiple final topics", function () {
    const firstTopic = buildTopicWithRetrievals({
      topicId: 10,
      activeRetrievalId: "retrieval_shared",
      retrievalIds: ["retrieval_shared"]
    });
    const secondTopic = buildTopicWithRetrievals({
      topicId: 11,
      activeRetrievalId: "retrieval_shared",
      retrievalIds: ["retrieval_shared"]
    });

    expect(() => attachKnowledgeRetrievalTopicIds({
      knowledgeMemory: {
        retrievals: [
          buildRetrieval({
            retrievalId: "retrieval_shared",
            topicId: null
          })
        ]
      },
      topics: [
        firstTopic,
        secondTopic
      ]
    })).toThrow(/Ambiguous knowledge retrieval/u);
  });

  it("preserves orphan retrievals without making them active", function () {
    const orphanRetrieval = buildRetrieval({
      retrievalId: "retrieval_orphan",
      topicId: null,
      rawRagKnowledge: buildRawKnowledge("orphan")
    });
    const topic = buildTopicWithRetrievals({
      topicId: 1,
      activeRetrievalId: null,
      retrievalIds: []
    });

    const updated = attachKnowledgeRetrievalTopicIds({
      knowledgeMemory: {
        retrievals: [orphanRetrieval]
      },
      topics: [topic]
    });

    expect(updated.retrievals).toEqual([orphanRetrieval]);
    expect(topic.sourceTopicManager.workflows.issueResolution.retrieveKnowledge.activeRetrievalId)
      .toBe(null);
  });

  it("captures legacy inline raw and segmented knowledge without writing during read", async function () {
    const topic = buildTopicWithRetrievals({
      topicId: 1,
      activeRetrievalId: null,
      retrievalIds: []
    }) as unknown as Record<string, unknown>;
    const sourceTopicManager = topic.sourceTopicManager as {
      workflows: LiveMemoryTopicOptimized["sourceTopicManager"]["workflows"];
    };
    sourceTopicManager.workflows.issueResolution.retrieveKnowledge = {
      ...sourceTopicManager.workflows.issueResolution.retrieveKnowledge,
      rankedSearch: {
        isSearched: true,
        rawRagKnowledge: buildRawKnowledge("legacy")
      },
      segmentationKnowledge: {
        isSegmented: true,
        segmentedKnowledge: buildSegmentedKnowledge("raw_knowledge_1")
      }
    } as unknown as LiveMemoryTopicOptimized["sourceTopicManager"]["workflows"]["issueResolution"]["retrieveKnowledge"];

    await writeRawJson(getStateMemoryFilePath("legacy"), {
      ...createEmptyLiveMemoryContextOptimized(),
      topics: [topic]
    });

    const beforeRead = await fs.readFile(getStateMemoryFilePath("legacy"), "utf8");
    const state = await readLiveMemoryContext("legacy");
    const afterRead = await fs.readFile(getStateMemoryFilePath("legacy"), "utf8");
    const legacyRetrievals = consumeLegacyKnowledgeRetrievals(state!);

    expect(afterRead).toBe(beforeRead);
    expect(state?.topics?.[0]?.sourceTopicManager.workflows.issueResolution.retrieveKnowledge.activeRetrievalId).toMatch(/^retrieval_/u);
    expect(JSON.stringify(state)).not.toContain("rawRagKnowledge");
    expect(JSON.stringify(state)).not.toContain("segmentedKnowledge");
    expect(legacyRetrievals).toHaveLength(1);
    expect(legacyRetrievals[0].rawRagKnowledge?.query).toBe("query legacy");
    expect(legacyRetrievals[0].segmentedKnowledge).toEqual(
      buildSegmentedKnowledge("raw_knowledge_1")
    );
  });

  it("accepts future knowledgeAnswer retrievals in knowledge memory", function () {
    const retrieval = createKnowledgeRetrieval({
      topicId: 2,
      workflow: "knowledgeAnswer"
    });

    expect(retrieval.workflow).toBe("knowledgeAnswer");
    expect("attempt" in retrieval).toBe(false);
  });
});
