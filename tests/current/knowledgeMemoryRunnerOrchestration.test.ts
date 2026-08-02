import {afterEach, describe, expect, it, vi} from "vitest";

import {
  createEmptyKnowledgeMemory
} from "../../src/infrastructure/live-memory/knowledgeMemoryStore";
import {
  createEmptyLiveMemoryContextOptimized,
  createEmptyLiveMemoryTopicOptimized
} from "../../src/infrastructure/live-memory/liveMemoryDefaults";
import {
  persistSupportMemories
} from "../../src/support-automation/runSupportAutomation";

import type {KnowledgeMemoryRetrieval} from "../../src/infrastructure/live-memory/knowledgeMemory.template";
import type {RawRagKnowledge} from "../../src/support-automation/support-processing-pipeline-optimized/topic-manager/topic-treatement/issue-resolution-branch/retrieve-knowledge/ranked-search/runRankedSearch--oneShotStep";
import type {RunSolutionInput} from "../../src/support-automation/support-processing-pipeline-optimized/topic-manager/topic-treatement/issue-resolution-branch/solution/runSolution";
import type {SegmentedKnowledgeBySource} from "../../src/support-automation/support-processing-pipeline-optimized/topic-manager/topic-treatement/issue-resolution-branch/retrieve-knowledge/segmentation-knowledge/runSegmentationKnowledge--oneShotStep";

const issueBranchPath =
  "../../src/support-automation/support-processing-pipeline-optimized/topic-manager/topic-treatement/issue-resolution-branch/runIssueResolutionBranch";
const basicQualificationPath =
  "../../src/support-automation/support-processing-pipeline-optimized/topic-manager/topic-treatement/issue-resolution-branch/basic-qualification/runBasicQualification";
const retrieveKnowledgePath =
  "../../src/support-automation/support-processing-pipeline-optimized/topic-manager/topic-treatement/issue-resolution-branch/retrieve-knowledge/runRetrieveKnowledge";
const solutionPath =
  "../../src/support-automation/support-processing-pipeline-optimized/topic-manager/topic-treatement/issue-resolution-branch/solution/runSolution";

function buildRawKnowledge(): RawRagKnowledge {
  return {
    query: "query active",
    content: "content active",
    candidates: [{
      rawKnowledgeId: "raw_knowledge_1",
      rawKnowledge: "Clear the local cache.",
      whyPotentiallyRelevant: "cache",
      sourceHint: "FAQ"
    }],
    sources: [],
    metadata: {
      retriever: "openrag"
    }
  };
}

function buildSegmentedKnowledge(): SegmentedKnowledgeBySource[] {
  return [{
    rawKnowledgeId: "raw_knowledge_1",
    userFacingKnowledge: [{
      text: "Clear the local cache.",
      sourceHint: "FAQ",
      sourceSpan: null
    }],
    supportFacingKnowledge: [{
      text: "Local cache corruption can block sync.",
      sourceHint: "Runbook",
      sourceSpan: null
    }]
  }];
}

function buildRetrieval(input: {
  rawRagKnowledge?: RawRagKnowledge | null;
  segmentedKnowledge?: SegmentedKnowledgeBySource[];
}): KnowledgeMemoryRetrieval {
  return {
    retrievalId: "retrieval_active",
    topicId: 1,
    workflow: "issueResolution",
    rawRagKnowledge: input.rawRagKnowledge ?? null,
    segmentedKnowledge: input.segmentedKnowledge ?? []
  };
}

describe("knowledge memory runner orchestration", function () {
  afterEach(function () {
    vi.doUnmock(basicQualificationPath);
    vi.doUnmock(retrieveKnowledgePath);
    vi.doUnmock(solutionPath);
    vi.resetModules();
  });

  it("passes segmented knowledge from the latest retrieval snapshot to solution in the same run", async function () {
    vi.resetModules();

    const rawRagKnowledge = buildRawKnowledge();
    const segmentedKnowledge = buildSegmentedKnowledge();
    const topic = createEmptyLiveMemoryTopicOptimized(1);
    const sourceTopicManager = {
      ...topic.sourceTopicManager,
      supportNeedResolution: {
        supportNeed: {
          value: "issue_resolution" as const,
          reason: null
        }
      }
    };
    const retrieveKnowledge = {
      ...sourceTopicManager.workflows.issueResolution.retrieveKnowledge,
      isCompleted: true,
      activeRetrievalId: "retrieval_active",
      retrievalIds: ["retrieval_active"],
      rankedSearch: {
        isSearched: true
      },
      filter: {
        isFiltered: true,
        keptRawKnowledgeIds: ["raw_knowledge_1"],
        filterExplanation: null
      },
      selection: {
        isClearSelected: true,
        clarificationQuestion: null,
        selectedRawKnowledgeIds: ["raw_knowledge_1"],
        selectionExplanation: null
      },
      segmentationKnowledge: {
        isSegmented: true
      }
    };
    const snapshots = [
      buildRetrieval({}),
      buildRetrieval({rawRagKnowledge}),
      buildRetrieval({
        rawRagKnowledge,
        segmentedKnowledge
      })
    ];
    const solutionInputs: RunSolutionInput[] = [];

    vi.doMock(basicQualificationPath, () => ({
      runBasicQualification: async () => ({
        say: null,
        basicQualification: sourceTopicManager.workflows.issueResolution.basicQualification
      })
    }));
    vi.doMock(retrieveKnowledgePath, () => ({
      runRetrieveKnowledge: async () => ({
        say: null,
        retrieveKnowledge,
        knowledgeMemoryPatch: {
          upsertRetrievals: snapshots
        }
      })
    }));
    vi.doMock(solutionPath, () => ({
      runSolution: async (input: RunSolutionInput) => {
        solutionInputs.push(input);

        return {
          say: "solution received knowledge",
          solution: sourceTopicManager.workflows.issueResolution.solution
        };
      }
    }));

    const {runIssueResolutionBranch} = await import(issueBranchPath);

    const output = await runIssueResolutionBranch({
      topicUpdatePlan: {
        topicId: 1,
        sourceCaseDetailIds: [],
        sourceAttemptedActionIds: [],
        sourceOtherIds: [],
        title: "Sync issue",
        summaryTopic: "Sync issue",
        supportDomain: {
          value: "sync",
          reason: null
        }
      },
      currentTopic: null,
      sourceFacts: {
        caseDetailsExtracted: [],
        attemptedActionsExtracted: [],
        otherExtracted: []
      },
      currentUserMessage: {
        content: "Sync is broken"
      },
      previousConversationTurn: {
        previousUserMessage: null,
        previousBotMessage: null
      },
      sourceTopicManager,
      activeKnowledgeRetrieval: null
    });

    expect(output.status).toBe("processed");
    expect(solutionInputs).toHaveLength(1);
    expect(solutionInputs[0].segmentedKnowledge).toEqual(segmentedKnowledge);
  });

  it("writes knowledge memory before state memory", async function () {
    const calls: string[] = [];
    const knowledgeMemory = createEmptyKnowledgeMemory();
    const liveMemoryContext = createEmptyLiveMemoryContextOptimized();

    await persistSupportMemories({
      conversationKey: "conversation",
      knowledgeMemory,
      liveMemoryContext,
      writeKnowledgeMemory: async (conversationKey, memory) => {
        calls.push(`knowledge:${conversationKey}`);
        expect(memory).toBe(knowledgeMemory);
      },
      writeLiveMemoryContext: async (conversationKey, memory) => {
        calls.push(`state:${conversationKey}`);
        expect(memory).toBe(liveMemoryContext);
      }
    });

    expect(calls).toEqual([
      "knowledge:conversation",
      "state:conversation"
    ]);
  });

  it("does not write state when knowledge memory write fails", async function () {
    const calls: string[] = [];
    const stateWriter = vi.fn(async () => {
      calls.push("state");
    });

    await expect(persistSupportMemories({
      conversationKey: "conversation",
      knowledgeMemory: createEmptyKnowledgeMemory(),
      liveMemoryContext: createEmptyLiveMemoryContextOptimized(),
      writeKnowledgeMemory: async () => {
        calls.push("knowledge");
        throw new Error("knowledge write failed");
      },
      writeLiveMemoryContext: stateWriter
    })).rejects.toThrow("knowledge write failed");

    expect(calls).toEqual(["knowledge"]);
    expect(stateWriter).not.toHaveBeenCalled();
  });
});
