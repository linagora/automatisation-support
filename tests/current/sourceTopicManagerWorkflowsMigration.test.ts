import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {
  createEmptyLiveMemoryContextOptimized,
  createEmptyLiveMemoryTopicOptimized
} from "../../src/infrastructure/live-memory/liveMemoryDefaults";
import {
  getStateMemoryFilePath,
  readLiveMemoryContext,
  writeLiveMemoryContext
} from "../../src/infrastructure/live-memory/liveMemoryContextStore";
import {buildLiveMemoryPatches} from "../../src/support-automation/support-processing-pipeline-optimized/build-live-memory-patches/buildLiveMemoryPatches";
import {
  buildProposeTopicUpdatesPrompt,
  deriveTopicCurrentStep
} from "../../src/support-automation/support-processing-pipeline-optimized/propose-topic-updates-optimized/buildProposeTopicUpdatesPrompt";
import {runFeatureRequestBranch} from "../../src/support-automation/support-processing-pipeline-optimized/topic-manager/topic-treatement/feature-request-branch/runFeatureRequestBranch";
import {runIdleMode} from "../../src/support-automation/support-processing-pipeline-optimized/topic-manager/topic-treatement/issue-resolution-branch/idle-mode/runIdleMode";
import {runIssueResolutionBranch} from "../../src/support-automation/support-processing-pipeline-optimized/topic-manager/topic-treatement/issue-resolution-branch/runIssueResolutionBranch";
import {runKnowledgeAnswerBranch} from "../../src/support-automation/support-processing-pipeline-optimized/topic-manager/topic-treatement/knowledge-answer-branch/runKnowledgeAnswerBranch";
import {runSupportActionBranch} from "../../src/support-automation/support-processing-pipeline-optimized/topic-manager/topic-treatement/support-action-branch/runSupportActionBranch";
import {runUnclearTopicBranch} from "../../src/support-automation/support-processing-pipeline-optimized/topic-manager/topic-treatement/unclear-topic-branch/runUnclearTopicBranch";
import {
  buildAnalyzeSupportTextPendingRequestedItems,
  hasTopicManagerHandoverRequested
} from "../../src/support-automation/support-processing-pipeline-optimized/runSupportProcessingPipelineOptimized";

import type {
  LiveMemoryContextOptimized,
  LiveMemoryTopicOptimized
} from "../../src/infrastructure/live-memory/liveMemoryContextOptimized.template";
import type {TopicUpdatePlan} from "../../src/support-automation/support-processing-pipeline-optimized/propose-topic-updates-optimized/runProposeTopicUpdates";

type JsonRecord = Record<string, unknown>;
type BuildLiveMemoryPatchesInput = Parameters<typeof buildLiveMemoryPatches>[0];
type TopicManagerOutput = NonNullable<
  BuildLiveMemoryPatchesInput["intermOutputs"]["topicManagerOutputs"]
>[number];

const topicUpdatePlan: TopicUpdatePlan = {
  topicId: 1,
  sourceCaseDetailIds: [],
  sourceAttemptedActionIds: [],
  sourceOtherIds: [],
  title: "Topic",
  summaryTopic: "User needs support.",
  supportDomain: {
    value: "account",
    reason: null
  }
};

function buildContext(topic: LiveMemoryTopicOptimized): LiveMemoryContextOptimized {
  return {
    ...createEmptyLiveMemoryContextOptimized(),
    topics: [topic]
  };
}

function buildTopic(): LiveMemoryTopicOptimized {
  return createEmptyLiveMemoryTopicOptimized(1);
}

function buildTopicWithSupportNeed(
  supportNeed: LiveMemoryTopicOptimized["sourceTopicManager"]["supportNeedResolution"]["supportNeed"]["value"]
): LiveMemoryTopicOptimized {
  const topic = buildTopic();

  return {
    ...topic,
    sourceTopicManager: {
      ...topic.sourceTopicManager,
      supportNeedResolution: {
        supportNeed: {
          value: supportNeed,
          reason: null
        }
      }
    }
  };
}

function buildTopicWithNonEmptyIssueWorkflow(): LiveMemoryTopicOptimized {
  const topic = buildTopic();

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
          basicQualification: {
            isBuilt: true,
            isCompleted: true,
            caseDetailsToAskBecauseOfBasicQualification: [{
              key: "browser",
              reason: "needed",
              status: "obtained"
            }]
          },
          retrieveKnowledge: {
            ...topic.sourceTopicManager.workflows.issueResolution.retrieveKnowledge,
            isCompleted: true,
            segmentationKnowledge: {
              isSegmented: true
            }
          },
          solution: {
            ...topic.sourceTopicManager.workflows.issueResolution.solution,
            caseDetailsToAskBecauseOfSolutionFound: [{
              key: "workspace",
              question: "Which workspace?",
              reason: "needed",
              status: "obtained"
            }]
          },
          deepQualification: {
            isBuilt: true,
            isCompleted: true,
            caseDetailsToAskBecauseOfDeepQualification: [{
              key: "logs",
              reason: "needed",
              status: "obtained"
            }]
          },
          idle: {
            isActivated: false
          }
        },
        knowledgeAnswer: {
          idle: {
            isActivated: false
          }
        },
        supportAction: {
          idle: {
            isActivated: false
          }
        },
        featureRequest: {
          idle: {
            isActivated: false
          }
        }
      }
    }
  };
}

function buildLegacyFlatTopic(): JsonRecord {
  const topic = buildTopic() as unknown as JsonRecord;
  const sourceTopicManager = {
    ...(topic.sourceTopicManager as JsonRecord)
  };
  const workflows = sourceTopicManager.workflows as LiveMemoryTopicOptimized["sourceTopicManager"]["workflows"];

  delete sourceTopicManager.workflows;
  sourceTopicManager.basicQualification = {
    ...workflows.issueResolution.basicQualification,
    isBuilt: true
  };
  sourceTopicManager.retrieveKnowledge = {
    ...workflows.issueResolution.retrieveKnowledge,
    isCompleted: "failed"
  };
  sourceTopicManager.solution = {
    ...workflows.issueResolution.solution,
    isActionForUserBuilt: true
  };
  sourceTopicManager.deepQualification = {
    ...workflows.issueResolution.deepQualification,
    isBuilt: true
  };
  sourceTopicManager.idleMode = {
    isActivated: true
  };
  sourceTopicManager.currentStep = "idle";
  sourceTopicManager.resolutionStatus = {
    value: "solved_by_bot",
    reason: "legacy"
  };
  sourceTopicManager.handover = {
    isRequested: true,
    reason: "legacy_handover"
  };

  return {
    ...topic,
    sourceTopicManager
  };
}

function buildRawMemory(topic: unknown): unknown {
  return {
    isBotActive: true,
    topicsSummary: {
      total: 0,
      byStatus: {
        in_progress: 0,
        solved_by_bot: 0,
        unsolved: 0
      },
      topics: []
    },
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
    topics: [topic]
  };
}

async function writeRawJsonFile(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), {recursive: true});
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readJsonFile(filePath: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function parseExistingTopicsFromPrompt(prompt: string): JsonRecord[] {
  const match = prompt.match(/<existing_topics>\n([\s\S]*?)\n<\/existing_topics>/);
  if (!match) {
    throw new Error("Missing existing_topics block");
  }

  return JSON.parse(match[1]) as JsonRecord[];
}

function expectNoLegacyTopicManagerFields(sourceTopicManager: unknown): void {
  const raw = sourceTopicManager as JsonRecord;

  expect("currentStep" in raw).toBe(false);
  expect("resolutionStatus" in raw).toBe(false);
  expect("handover" in raw).toBe(false);
}

function buildPatchInput(params: {
  topicManagerOutputs?: TopicManagerOutput[];
  topicUpdatePlans?: TopicUpdatePlan[];
  analyzeTextSurfaceOutput?: BuildLiveMemoryPatchesInput["intermOutputs"]["analyzeTextSurfaceOutput"];
}): BuildLiveMemoryPatchesInput {
  return {
    latestUserMessage: {
      content: "Please help"
    },
    latestUserAttachments: [],
    liveMemory: {
      handover: {
        handoverReason: null
      }
    },
    intermOutputs: {
      analyzeTextSurfaceOutput: params.analyzeTextSurfaceOutput ?? null,
      analyzeSupportTextOutput: {
        status: "analyzed",
        fallbackReason: null,
        summaryMessage: null,
        userLanguage: "en",
        caseDetailsExtracted: [],
        attemptedActionsExtracted: [],
        otherExtracted: []
      },
      proposeTopicUpdatesOutput: {
        status: "analyzed",
        fallbackReason: null,
        topicUpdatePlans: params.topicUpdatePlans ?? []
      },
      topicManagerOutputs: params.topicManagerOutputs ?? []
    }
  } as BuildLiveMemoryPatchesInput;
}

function buildProcessedTopicManagerOutput(params: {
  topicStatus: LiveMemoryTopicOptimized["status"];
  topicHandoverRequest: {
    isRequested: boolean;
    reason: string | null;
  };
  sourceTopicManager?: LiveMemoryTopicOptimized["sourceTopicManager"];
}): TopicManagerOutput {
  return {
    status: "processed",
    fallbackReason: null,
    topicPlannerOutput: {
      topicId: 1,
      title: "Topic",
      say: "Thanks"
    },
    topicStatus: params.topicStatus,
    topicHandoverRequest: params.topicHandoverRequest,
    sourceTopicManager: params.sourceTopicManager ?? buildTopic().sourceTopicManager,
    intermediateOutputs: {
      supportNeedResolutionOutput: null,
      issueResolutionBranchOutput: null,
      featureRequestBranchOutput: null,
      knowledgeAnswerBranchOutput: null,
      supportActionBranchOutput: null,
      unclearTopicBranchOutput: null
    }
  };
}

describe("sourceTopicManager workflows migration", function () {
  let tempDir: string;
  let previousDirectory: string | undefined;

  beforeEach(async function () {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "source-topic-manager-workflows-"));
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

  it("creates default workflows for a new topic", function () {
    const sourceTopicManager = buildTopic().sourceTopicManager;

    expect(Object.keys(sourceTopicManager)).toEqual(["supportNeedResolution", "workflows"]);
    expectNoLegacyTopicManagerFields(sourceTopicManager);
    expect(sourceTopicManager.workflows.issueResolution.basicQualification).toBeDefined();
    expect(sourceTopicManager.workflows.issueResolution.retrieveKnowledge).toBeDefined();
    expect(sourceTopicManager.workflows.issueResolution.solution).toBeDefined();
    expect(sourceTopicManager.workflows.issueResolution.deepQualification).toBeDefined();
    expect(sourceTopicManager.workflows.issueResolution.idle).toEqual({isActivated: false});
    expect(sourceTopicManager.workflows.knowledgeAnswer.idle).toEqual({isActivated: false});
    expect(sourceTopicManager.workflows.supportAction.idle).toEqual({isActivated: false});
    expect(sourceTopicManager.workflows.featureRequest.idle).toEqual({isActivated: false});
  });

  it("normalizes an old flat sourceTopicManager into issueResolution workflow", async function () {
    await writeRawJsonFile(
      getStateMemoryFilePath("legacy-flat"),
      buildRawMemory(buildLegacyFlatTopic())
    );

    const context = await readLiveMemoryContext("legacy-flat");
    const sourceTopicManager = context?.topics?.[0]?.sourceTopicManager;

    expect(sourceTopicManager?.workflows.issueResolution.basicQualification.isBuilt).toBe(true);
    expect(sourceTopicManager?.workflows.issueResolution.retrieveKnowledge.isCompleted).toBe("failed");
    expect(sourceTopicManager?.workflows.issueResolution.solution.isActionForUserBuilt).toBe(true);
    expect(sourceTopicManager?.workflows.issueResolution.deepQualification.isBuilt).toBe(true);
    expect(sourceTopicManager?.workflows.issueResolution.idle).toEqual({isActivated: true});
    expect(sourceTopicManager?.workflows.knowledgeAnswer.idle).toEqual({isActivated: false});
    expect(sourceTopicManager?.workflows.supportAction.idle).toEqual({isActivated: false});
    expect(sourceTopicManager?.workflows.featureRequest.idle).toEqual({isActivated: false});
    expectNoLegacyTopicManagerFields(sourceTopicManager);
    expect("basicQualification" in (sourceTopicManager as unknown as JsonRecord)).toBe(false);
    expect("retrieveKnowledge" in (sourceTopicManager as unknown as JsonRecord)).toBe(false);
    expect("solution" in (sourceTopicManager as unknown as JsonRecord)).toBe(false);
    expect("deepQualification" in (sourceTopicManager as unknown as JsonRecord)).toBe(false);
    expect("idleMode" in (sourceTopicManager as unknown as JsonRecord)).toBe(false);
  });

  it("prioritizes workflow fields over legacy flat fields", async function () {
    const rawTopic = buildLegacyFlatTopic();
    const sourceTopicManager = rawTopic.sourceTopicManager as JsonRecord;
    const newFormatTopic = buildTopic();

    sourceTopicManager.workflows = {
      ...newFormatTopic.sourceTopicManager.workflows,
      issueResolution: {
        ...newFormatTopic.sourceTopicManager.workflows.issueResolution,
        basicQualification: {
          ...newFormatTopic.sourceTopicManager.workflows.issueResolution.basicQualification,
          isBuilt: false
        }
      }
    };
    sourceTopicManager.basicQualification = {
      ...newFormatTopic.sourceTopicManager.workflows.issueResolution.basicQualification,
      isBuilt: true
    };

    await writeRawJsonFile(getStateMemoryFilePath("new-priority"), buildRawMemory(rawTopic));

    const context = await readLiveMemoryContext("new-priority");

    expect(
      context?.topics?.[0]?.sourceTopicManager.workflows.issueResolution.basicQualification.isBuilt
    ).toBe(false);
    expectNoLegacyTopicManagerFields(context?.topics?.[0]?.sourceTopicManager);
  });

  it("preserves issue workflow when knowledge answer activates its idle", async function () {
    const topic = buildTopicWithNonEmptyIssueWorkflow();
    const issueResolution = topic.sourceTopicManager.workflows.issueResolution;

    const output = await runKnowledgeAnswerBranch({
      topicUpdatePlan,
      sourceTopicManager: topic.sourceTopicManager
    });

    expect(output.sourceTopicManager.workflows.issueResolution).toEqual(issueResolution);
    expect(output.sourceTopicManager.workflows.knowledgeAnswer.idle).toEqual({isActivated: true});
    expect(output.sourceTopicManager.workflows.supportAction).toEqual(topic.sourceTopicManager.workflows.supportAction);
    expect(output.sourceTopicManager.workflows.featureRequest).toEqual(topic.sourceTopicManager.workflows.featureRequest);
    expect(output.topicStatus).toBe("unsolved");
    expect(output.topicHandoverRequest).toEqual({
      isRequested: true,
      reason: "knowledge_question_received: topic finished as knowledge question and needs support review"
    });
    expectNoLegacyTopicManagerFields(output.sourceTopicManager);
  });

  it("preserves issue workflow when support action activates its idle", async function () {
    const topic = buildTopicWithNonEmptyIssueWorkflow();
    const issueResolution = topic.sourceTopicManager.workflows.issueResolution;

    const output = await runSupportActionBranch({
      topicUpdatePlan,
      sourceTopicManager: topic.sourceTopicManager
    });

    expect(output.sourceTopicManager.workflows.issueResolution).toEqual(issueResolution);
    expect(output.sourceTopicManager.workflows.supportAction.idle).toEqual({isActivated: true});
    expect(output.sourceTopicManager.workflows.knowledgeAnswer).toEqual(topic.sourceTopicManager.workflows.knowledgeAnswer);
    expect(output.sourceTopicManager.workflows.featureRequest).toEqual(topic.sourceTopicManager.workflows.featureRequest);
    expect(output.topicStatus).toBe("unsolved");
    expect(output.topicHandoverRequest).toEqual({
      isRequested: true,
      reason: "support_action_requested: topic finished as support action request and needs support review"
    });
    expectNoLegacyTopicManagerFields(output.sourceTopicManager);
  });

  it("preserves issue workflow when feature request activates its idle", async function () {
    const topic = buildTopicWithNonEmptyIssueWorkflow();
    const issueResolution = topic.sourceTopicManager.workflows.issueResolution;

    const output = await runFeatureRequestBranch({
      topicUpdatePlan,
      sourceTopicManager: topic.sourceTopicManager
    });

    expect(output.sourceTopicManager.workflows.issueResolution).toEqual(issueResolution);
    expect(output.sourceTopicManager.workflows.featureRequest.idle).toEqual({isActivated: true});
    expect(output.sourceTopicManager.workflows.knowledgeAnswer).toEqual(topic.sourceTopicManager.workflows.knowledgeAnswer);
    expect(output.sourceTopicManager.workflows.supportAction).toEqual(topic.sourceTopicManager.workflows.supportAction);
    expect(output.topicStatus).toBe("unsolved");
    expect(output.topicHandoverRequest).toEqual({
      isRequested: true,
      reason: "feature_request_received: topic finished as feature request and needs support review"
    });
    expectNoLegacyTopicManagerFields(output.sourceTopicManager);
  });

  it("updates an issue step while preserving other issue steps and workflows", async function () {
    const topic = buildTopicWithNonEmptyIssueWorkflow();
    const initialIssueResolution = topic.sourceTopicManager.workflows.issueResolution;
    const initialOtherWorkflows = {
      knowledgeAnswer: topic.sourceTopicManager.workflows.knowledgeAnswer,
      supportAction: topic.sourceTopicManager.workflows.supportAction,
      featureRequest: topic.sourceTopicManager.workflows.featureRequest
    };

    const output = await runIssueResolutionBranch({
      topicUpdatePlan,
      currentTopic: topic,
      sourceFacts: {
        caseDetailsExtracted: [],
        attemptedActionsExtracted: [],
        otherExtracted: []
      },
      currentUserMessage: {
        content: "Thanks"
      },
      previousConversationTurn: {
        previousUserMessage: null,
        previousBotMessage: null
      },
      sourceTopicManager: topic.sourceTopicManager
    });

    expect(output.status).toBe("processed");
    if (output.status !== "processed") return;

    expect(output.sourceTopicManager.workflows.issueResolution.basicQualification).toEqual(
      initialIssueResolution.basicQualification
    );
    expect(output.sourceTopicManager.workflows.issueResolution.retrieveKnowledge).toEqual(
      initialIssueResolution.retrieveKnowledge
    );
    expect(output.sourceTopicManager.workflows.issueResolution.deepQualification).toEqual(
      initialIssueResolution.deepQualification
    );
    expect(output.sourceTopicManager.workflows.issueResolution.solution.isCompleted).toBe(true);
    expect(output.sourceTopicManager.workflows.issueResolution.idle).toEqual({isActivated: true});
    expect(output.sourceTopicManager.workflows.knowledgeAnswer).toEqual(initialOtherWorkflows.knowledgeAnswer);
    expect(output.sourceTopicManager.workflows.supportAction).toEqual(initialOtherWorkflows.supportAction);
    expect(output.sourceTopicManager.workflows.featureRequest).toEqual(initialOtherWorkflows.featureRequest);
    expect(output.topicStatus).toBe("unsolved");
    expect(output.topicHandoverRequest).toEqual({
      isRequested: true,
      reason: "issue_finished_unresolved_need_review: topic 1 finished but needs support review"
    });
    expectNoLegacyTopicManagerFields(output.sourceTopicManager);
  });

  it("builds pending items from issueResolution workflow", function () {
    const topic = buildTopicWithNonEmptyIssueWorkflow();
    topic.sourceTopicManager.workflows.issueResolution.basicQualification.caseDetailsToAskBecauseOfBasicQualification = [{
      key: "browser",
      reason: "needed",
      status: "asking"
    }];
    topic.sourceTopicManager.workflows.issueResolution.deepQualification.caseDetailsToAskBecauseOfDeepQualification = [{
      key: "logs",
      reason: "needed",
      status: "asking"
    }];
    topic.sourceTopicManager.workflows.issueResolution.solution.caseDetailsToAskBecauseOfSolutionFound = [{
      key: "workspace",
      question: "Which workspace?",
      reason: "needed",
      status: "asking"
    }];
    topic.sourceTopicManager.workflows.issueResolution.solution.attemptedActionsToAskBecauseOfSolutionFound = [{
      action: "Restart the browser",
      reason: "try simple recovery",
      status: "asking"
    }];

    const pendingItems = buildAnalyzeSupportTextPendingRequestedItems([topic]);

    expect(pendingItems.caseDetailsToAsk.map((item) => item.key)).toEqual([
      "browser",
      "logs",
      "workspace"
    ]);
    expect(pendingItems.attemptedActionsToAsk).toEqual([{
      action: "Restart the browser",
      reason: "try simple recovery",
      status: "asking"
    }]);
  });

  it("builds propose topic updates prompt with active workflow idle and issue pending items", function () {
    const topic = buildTopicWithSupportNeed("support_action");
    topic.sourceTopicManager.workflows.issueResolution.basicQualification.caseDetailsToAskBecauseOfBasicQualification = [{
      key: "browser",
      reason: "needed",
      status: "asking"
    }];
    topic.sourceTopicManager.workflows.supportAction.idle = {
      isActivated: true
    };

    const request = buildProposeTopicUpdatesPrompt({
      existingTopics: [topic],
      currentUserMessage: {
        content: "Here is an update"
      },
      summaryMessage: null,
      caseDetailsExtracted: [],
      attemptedActionsExtracted: [],
      otherExtracted: [],
      recentInteractionContext: {}
    });
    const userPrompt = request.messages[1]?.content ?? "";
    const existingTopics = parseExistingTopicsFromPrompt(userPrompt);

    expect(existingTopics[0].idleMode).toEqual({isActivated: true});
    expect(existingTopics[0].status).toBe("in_progress");
    expect(existingTopics[0].currentStep).toBe("idle");
    expect(existingTopics[0].supportNeed).toEqual({
      value: "support_action",
      reason: null
    });
    expect(existingTopics[0].pendingBasicFieldKeys).toEqual(["browser"]);
    expect(userPrompt).not.toContain("sourceTopicManager.basicQualification");
    expect(userPrompt).not.toContain("sourceTopicManager.retrieveKnowledge");
    expect(userPrompt).not.toContain("sourceTopicManager.solution");
    expect(userPrompt).not.toContain("sourceTopicManager.deepQualification");
    expect(userPrompt).not.toContain("sourceTopicManager.idleMode");
    expect(userPrompt).not.toContain("resolutionStatus");
    expect(userPrompt).not.toContain("resolution reason");
    expect(userPrompt).not.toContain("topic handover");
    expect(userPrompt).not.toContain("topicHandover");
    expect(userPrompt).not.toContain("handoverReason");
  });

  it("derives temporary topic current step from support need and workflow state", function () {
    const newTopic = buildTopic();
    expect(deriveTopicCurrentStep(newTopic.sourceTopicManager)).toBe("support_need_resolution");

    const basicIncompleteTopic = buildTopicWithSupportNeed("issue_resolution");
    expect(deriveTopicCurrentStep(basicIncompleteTopic.sourceTopicManager)).toBe("basic_qualification");

    const retrievalPendingTopic = buildTopicWithSupportNeed("issue_resolution");
    retrievalPendingTopic.sourceTopicManager.workflows.issueResolution.basicQualification.isCompleted = true;
    expect(deriveTopicCurrentStep(retrievalPendingTopic.sourceTopicManager)).toBe("retrieve_knowledge");

    const retrievalFailedTopic = buildTopicWithSupportNeed("issue_resolution");
    retrievalFailedTopic.sourceTopicManager.workflows.issueResolution.basicQualification.isCompleted = true;
    retrievalFailedTopic.sourceTopicManager.workflows.issueResolution.retrieveKnowledge.isCompleted = "failed";
    expect(deriveTopicCurrentStep(retrievalFailedTopic.sourceTopicManager)).toBe("solution");

    const solutionIncompleteTopic = buildTopicWithSupportNeed("issue_resolution");
    solutionIncompleteTopic.sourceTopicManager.workflows.issueResolution.basicQualification.isCompleted = true;
    solutionIncompleteTopic.sourceTopicManager.workflows.issueResolution.retrieveKnowledge.isCompleted = true;
    expect(deriveTopicCurrentStep(solutionIncompleteTopic.sourceTopicManager)).toBe("solution");

    const deepIncompleteTopic = buildTopicWithSupportNeed("issue_resolution");
    deepIncompleteTopic.sourceTopicManager.workflows.issueResolution.basicQualification.isCompleted = true;
    deepIncompleteTopic.sourceTopicManager.workflows.issueResolution.retrieveKnowledge.isCompleted = true;
    deepIncompleteTopic.sourceTopicManager.workflows.issueResolution.solution.isCompleted = true;
    expect(deriveTopicCurrentStep(deepIncompleteTopic.sourceTopicManager)).toBe("deep_qualification");

    const deepCompletedTopic = buildTopicWithSupportNeed("issue_resolution");
    deepCompletedTopic.sourceTopicManager.workflows.issueResolution.basicQualification.isCompleted = true;
    deepCompletedTopic.sourceTopicManager.workflows.issueResolution.retrieveKnowledge.isCompleted = true;
    deepCompletedTopic.sourceTopicManager.workflows.issueResolution.solution.isCompleted = true;
    deepCompletedTopic.sourceTopicManager.workflows.issueResolution.deepQualification.isCompleted = true;
    expect(deriveTopicCurrentStep(deepCompletedTopic.sourceTopicManager)).toBe("idle");

    const idleActiveTopic = buildTopicWithSupportNeed("issue_resolution");
    idleActiveTopic.sourceTopicManager.workflows.issueResolution.idle.isActivated = true;
    expect(deriveTopicCurrentStep(idleActiveTopic.sourceTopicManager)).toBe("idle");

    const knowledgeTopic = buildTopicWithSupportNeed("knowledge_answer");
    expect(deriveTopicCurrentStep(knowledgeTopic.sourceTopicManager)).toBe(null);
    knowledgeTopic.sourceTopicManager.workflows.knowledgeAnswer.idle.isActivated = true;
    expect(deriveTopicCurrentStep(knowledgeTopic.sourceTopicManager)).toBe("idle");
  });

  it("produces topic status from branch outputs", async function () {
    const inProgressPatch = buildLiveMemoryPatches(buildPatchInput({
      topicManagerOutputs: [
        buildProcessedTopicManagerOutput({
          topicStatus: "in_progress",
          topicHandoverRequest: {
            isRequested: false,
            reason: null
          }
        })
      ],
      topicUpdatePlans: [topicUpdatePlan]
    }));

    expect(inProgressPatch.topics?.[0]?.status).toBe("in_progress");

    const solvedTopic = buildTopicWithSupportNeed("issue_resolution");
    solvedTopic.sourceTopicManager.workflows.issueResolution.solution.attemptedActionsToAskBecauseOfSolutionFound = [{
      action: "Restart the browser",
      reason: "recovery",
      status: "succeeded"
    }];

    const solvedIdleOutput = await runIdleMode({
      mode: "finalize_after_solution",
      topicId: 1,
      currentUserMessage: {
        content: "It works now"
      },
      summaryTopic: "Browser issue",
      sourceTopicManager: solvedTopic.sourceTopicManager
    });

    expect(solvedIdleOutput.topicStatus).toBe("solved_by_bot");

    const unsolvedTopic = buildTopicWithSupportNeed("issue_resolution");
    const unsolvedIdleOutput = await runIdleMode({
      mode: "finalize_after_solution",
      topicId: 1,
      currentUserMessage: {
        content: "Still not working"
      },
      summaryTopic: "Browser issue",
      sourceTopicManager: unsolvedTopic.sourceTopicManager
    });

    expect(unsolvedIdleOutput.topicStatus).toBe("unsolved");

    const unclearOutput = await runUnclearTopicBranch({
      topicUpdatePlan,
      sourceTopicManager: buildTopicWithSupportNeed("unclear").sourceTopicManager
    });

    expect(unclearOutput.topicStatus).toBe("in_progress");
  });

  it("aggregates temporary topic handover requests globally without persisting them on topics", async function () {
    const topic = buildTopicWithNonEmptyIssueWorkflow();
    const knowledgeOutput = await runKnowledgeAnswerBranch({
      topicUpdatePlan,
      sourceTopicManager: topic.sourceTopicManager
    });

    const patch = buildLiveMemoryPatches(buildPatchInput({
      topicManagerOutputs: [
        buildProcessedTopicManagerOutput({
          topicStatus: knowledgeOutput.topicStatus,
          topicHandoverRequest: knowledgeOutput.topicHandoverRequest,
          sourceTopicManager: knowledgeOutput.sourceTopicManager
        })
      ],
      topicUpdatePlans: [topicUpdatePlan]
    }));

    expect(knowledgeOutput.topicHandoverRequest.isRequested).toBe(true);
    expect(patch.handover).toEqual({
      isHandover: true,
      handoverReason: knowledgeOutput.topicHandoverRequest.reason
    });
    expect(patch.topics?.[0]?.sourceTopicManager).toEqual(knowledgeOutput.sourceTopicManager);
    expectNoLegacyTopicManagerFields(patch.topics?.[0]?.sourceTopicManager);
  });

  it("keeps surface handover global when there is no topic handover", function () {
    const patch = buildLiveMemoryPatches(buildPatchInput({
      analyzeTextSurfaceOutput: {
        status: "analyzed",
        fallbackReason: null,
        userLanguage: "en",
        segments: [{
          category: "standard_interaction",
          standardSubcategory: "handover_request"
        }]
      } as BuildLiveMemoryPatchesInput["intermOutputs"]["analyzeTextSurfaceOutput"]
    }));

    expect(patch.handover).toEqual({
      isHandover: true,
      handoverReason: "asked_by_user"
    });
    expect(patch.topics).toBe(null);
  });

  it("derives handoffRecommended from temporary topic handover requests", function () {
    expect(hasTopicManagerHandoverRequested([
      buildProcessedTopicManagerOutput({
        topicStatus: "unsolved",
        topicHandoverRequest: {
          isRequested: true,
          reason: "needs_review"
        }
      })
    ])).toBe(true);

    expect(hasTopicManagerHandoverRequested([
      buildProcessedTopicManagerOutput({
        topicStatus: "in_progress",
        topicHandoverRequest: {
          isRequested: false,
          reason: null
        }
      })
    ])).toBe(false);
  });

  it("writes a migrated old flat memory using only workflows", async function () {
    await writeRawJsonFile(
      getStateMemoryFilePath("write-migrated"),
      buildRawMemory(buildLegacyFlatTopic())
    );

    const context = await readLiveMemoryContext("write-migrated");
    if (!context) {
      throw new Error("Expected context");
    }

    await writeLiveMemoryContext("write-migrated", context);

    const written = await readJsonFile(getStateMemoryFilePath("write-migrated")) as JsonRecord;
    const topics = written.topics as JsonRecord[];
    const sourceTopicManager = topics[0].sourceTopicManager as JsonRecord;

    expect(sourceTopicManager.workflows).toBeDefined();
    expect(sourceTopicManager.basicQualification).toBeUndefined();
    expect(sourceTopicManager.retrieveKnowledge).toBeUndefined();
    expect(sourceTopicManager.solution).toBeUndefined();
    expect(sourceTopicManager.deepQualification).toBeUndefined();
    expect(sourceTopicManager.idleMode).toBeUndefined();
    expect(sourceTopicManager.currentStep).toBeUndefined();
    expect(sourceTopicManager.resolutionStatus).toBeUndefined();
    expect(sourceTopicManager.handover).toBeUndefined();
  });
});
