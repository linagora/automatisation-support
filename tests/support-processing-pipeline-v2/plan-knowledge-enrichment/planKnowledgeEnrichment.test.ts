import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/archive/repositories/json/jsonKnowledgeRepository", () => ({
  JsonKnowledgeRepository: vi.fn(() => {
    throw new Error("planKnowledgeEnrichment_must_not_read_knowledge_json");
  })
}));

import {
  planKnowledgeEnrichment
} from "../../../src/support-automation/support-processing-pipeline-v2/plan-knowledge-enrichment/planKnowledgeEnrichment";

import type {
  MergedTopicSnapshot,
  PlanKnowledgeEnrichmentInput,
  TextUnderstanding
} from "../../../src/support-automation/support-processing-pipeline-v2/typesSupportProcessingPipelineV2.types";

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
  it("activates RAG for bug topics without reading knowledge.json", async function () {
    const plan = await planKnowledgeEnrichment(buildInput());

    expect(plan.route).toBe("rag_only");
    expect(plan.reason).toBe("rag_enabled_for_bug_topics");
  });

  it("activates RAG for access_security topics", async function () {
    const plan = await planKnowledgeEnrichment(buildInput(buildSnapshot({
      broadCategoryHint: "access_security",
      summary: "The user cannot sign in on the iOS app."
    })));

    expect(plan.route).toBe("rag_only");
    expect(plan.reason).toBe("rag_enabled_for_access_security_topics");
  });

  it("disables RAG for billing topics", async function () {
    const plan = await planKnowledgeEnrichment(buildInput(buildSnapshot({
      broadCategoryHint: "billing",
      summary: "The user received the invoice twice."
    })));

    expect(plan).toEqual({
      route: "none",
      retrievalRequests: [],
      reason: "rag_disabled_for_billing_topics"
    });
  });

  it("builds a canonical query from the topic snapshot", async function () {
    const plan = await planKnowledgeEnrichment(buildInput());
    const request = plan.retrievalRequests[0];

    expect(request).toMatchObject({
      topicId: 1,
      searchPurpose: "support_answer_and_qualification",
      desiredKnowledge: expect.arrayContaining([
        "customer_facing_information",
        "customer_answerable_questions",
        "internal_support_notes",
        "limitations",
        "do_not_expose"
      ]),
      filters: {
        broadCategoryHint: "bug",
        featureOrPage: "push notifications",
        platform: "Android"
      },
      context: {
        topicSummary:
          "Android push notifications are not received for new emails.",
        latestUserUpdate:
          "I do not receive Android notifications when a new email arrives.",
        knownDetails: expect.arrayContaining([
          { key: "platform", value: "Android" }
        ]),
        attemptedActions: [
          {
            action: "Enabled notification permissions",
            outcome: "failed"
          }
        ]
      }
    });
    expect(request.queryText).toContain(
      "Support issue: Android push notifications are not received"
    );
    expect(request.queryText).toContain("Environment: Android");
    expect(request.queryText).toContain(
      "Already tried: Enabled notification permissions (failed)."
    );
    expect(request.queryText).toContain(
      "customer-facing information, customer-answerable questions"
    );
    expect(request.queryText).not.toContain("{");
  });
});
