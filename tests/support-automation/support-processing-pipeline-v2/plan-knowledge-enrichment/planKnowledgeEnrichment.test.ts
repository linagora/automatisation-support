import { beforeEach, describe, expect, it, vi } from "vitest";

const requestKnowledgeEnrichmentPlanMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../src/archive/repositories/json/jsonKnowledgeRepository", () => ({
  JsonKnowledgeRepository: vi.fn(() => {
    throw new Error("planKnowledgeEnrichment_must_not_read_knowledge_json");
  })
}));

vi.mock("../../../../src/support-automation/support-processing-pipeline-v2/plan-knowledge-enrichment/requestKnowledgeEnrichmentPlan", () => ({
  requestKnowledgeEnrichmentPlan: requestKnowledgeEnrichmentPlanMock
}));

import {
  planKnowledgeEnrichment
} from "../../../../src/support-automation/support-processing-pipeline-v2/plan-knowledge-enrichment/planKnowledgeEnrichment";

import type {
  MergedTopicSnapshot,
  PlanKnowledgeEnrichmentInput,
  TextUnderstanding
} from "../../../../src/support-automation/support-processing-pipeline-v2/typesSupportProcessingPipelineV2.types";

type RuntimeKnowledgeEnrichmentPlan = {
  rag: {
    shouldRetrieve: boolean;
    mode: "answer" | "answer_and_soft_probe" | null;
    reason: string;
  };
};

function mockKnowledgeDecision(params: {
  broadIntentMode?: string;
  broadIntentReason?: string;
  shouldRetrieve: boolean;
  ragMode: "answer" | "answer_and_soft_probe" | null;
  ragReason?: string;
}): void {
  requestKnowledgeEnrichmentPlanMock.mockResolvedValue({
    status: "completed",
    parsedResponse: {
      broadIntent: {
        mode: params.broadIntentMode ?? "issue",
        reason: params.broadIntentReason ?? "test_broad_intent"
      },
      rag: {
        shouldRetrieve: params.shouldRetrieve,
        mode: params.ragMode,
        reason: params.ragReason ?? "test_rag_decision"
      }
    }
  });
}

const baseUnderstanding: TextUnderstanding = {
  understandingId: "understanding_1",
  sourceSegmentIds: ["segment_1"],
  messageKinds: [],
  caseDetails: [],
  attemptedActions: [],
  supportMetadata: [],
  sourceVerbatims: [
    "I do not receive Android notifications when a new email arrives."
  ],
  summary: "Android push notification is missing after new email.",
  primaryUserExpectation: "wants_solution",
  supportNeeds: ["possible_bug"],
  broadCategoryHint: "bug",
  contextDependency: "standalone_complete",
  contextualAnswer: {
    type: "none",
    value: null,
    evidence: null
  },
  facts: [],
  testedActions: [],
  uncertainties: []
};

function buildSnapshot(
  overrides: Partial<MergedTopicSnapshot> = {}
): MergedTopicSnapshot {
  return {
    snapshotId: "snapshot_1",
    topicId: 1,
    temporaryTopicId: null,
    isNewTopic: false,
    title: "Android notifications",
    broadCategoryHint: "bug",
    summary: "Android push notifications are not received for new emails.",
    caseDetails: [
      {
        key: "platform",
        value: "Android",
        evidence: "Android notifications"
      },
      {
        key: "feature",
        value: "push notifications",
        evidence: "notifications"
      }
    ],
    attemptedActions: [
      {
        action: "Enabled notification permissions",
        outcome: "failed",
        evidence: "permissions are already enabled"
      }
    ],
    sourceUnderstandingIds: ["understanding_1"],
    sourceVerbatims: [
      "Notification permissions are already enabled but the issue still happens."
    ],
    sourceOpIndex: 0,
    baseTopic: null,
    ...overrides
  };
}

function buildInput(
  snapshot: MergedTopicSnapshot = buildSnapshot()
): PlanKnowledgeEnrichmentInput {
  return {
    topicEvidence: {
      proposalId: "proposal_1",
      topicId: snapshot.topicId,
      topicSnapshot: snapshot,
      topicSourceVerbatims: snapshot.sourceVerbatims,
      relatedUnderstandingIds: ["understanding_1"],
      relatedTextUnderstandings: [baseUnderstanding],
      relatedAttachmentUnderstandings: [],
      relatedSupportResponseCues: []
    },
    topicSnapshot: snapshot,
    extractableFieldCatalog: []
  };
}

describe("planKnowledgeEnrichment", function () {
  beforeEach(function () {
    requestKnowledgeEnrichmentPlanMock.mockReset();
  });

  it("activates RAG for bug topics without reading knowledge.json", async function () {
    mockKnowledgeDecision({
      shouldRetrieve: true,
      ragMode: "answer",
      ragReason: "rag_enabled_for_bug_topics"
    });

    const plan = await planKnowledgeEnrichment(buildInput());
    const runtimePlan = plan as typeof plan & RuntimeKnowledgeEnrichmentPlan;

    expect(plan.route).toBe("catalog_and_rag");
    expect(runtimePlan.rag).toEqual({
      shouldRetrieve: true,
      mode: "answer",
      reason: "rag_enabled_for_bug_topics"
    });
    expect(plan.retrievalRequests).toEqual([]);
  });

  it("activates RAG for access_security topics", async function () {
    mockKnowledgeDecision({
      shouldRetrieve: true,
      ragMode: "answer",
      ragReason: "rag_enabled_for_access_security_topics"
    });

    const plan = await planKnowledgeEnrichment(buildInput(buildSnapshot({
      broadCategoryHint: "access_security",
      summary: "The user cannot sign in on the iOS app."
    })));
    const runtimePlan = plan as typeof plan & RuntimeKnowledgeEnrichmentPlan;

    expect(plan.route).toBe("catalog_and_rag");
    expect(runtimePlan.rag.reason).toBe(
      "rag_enabled_for_access_security_topics"
    );
  });

  it("disables RAG for billing topics", async function () {
    mockKnowledgeDecision({
      broadIntentMode: "issue",
      shouldRetrieve: false,
      ragMode: null,
      ragReason: "rag_disabled_for_billing_topics"
    });

    const plan = await planKnowledgeEnrichment(buildInput(buildSnapshot({
      broadCategoryHint: "billing",
      summary: "The user received the invoice twice."
    })));
    const runtimePlan = plan as typeof plan & RuntimeKnowledgeEnrichmentPlan;

    expect(plan).toMatchObject({
      route: "catalog_only",
      retrievalRequests: []
    });
    expect(runtimePlan.rag).toEqual({
      shouldRetrieve: false,
      mode: null,
      reason: "rag_disabled_for_billing_topics"
    });
  });

  it("passes a topic-scoped prompt to the knowledge enrichment LLM request", async function () {
    mockKnowledgeDecision({
      shouldRetrieve: true,
      ragMode: "answer"
    });

    const plan = await planKnowledgeEnrichment(buildInput());

    expect(plan.route).toBe("catalog_and_rag");
    expect(requestKnowledgeEnrichmentPlanMock).toHaveBeenCalledTimes(1);

    const request = requestKnowledgeEnrichmentPlanMock.mock.calls[0]?.[0];
    const serializedPrompt = JSON.stringify(request.prompt);

    expect(serializedPrompt).toContain(
      "Android push notifications are not received for new emails."
    );
    expect(serializedPrompt).toContain(
      "I do not receive Android notifications when a new email arrives."
    );
    expect(serializedPrompt).toContain("platform");
    expect(serializedPrompt).toContain("Enabled notification permissions");
  });
});
