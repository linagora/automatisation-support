import { describe, expect, it } from "vitest";

import {
  retrieveSupportKnowledge
} from "../../../../src/support-processing-pipeline/v2/retrieve-support-knowledge/retrieveSupportKnowledge";

import type {
  RetrieveSupportKnowledgeInput
} from "../../../../src/support-processing-pipeline/v2/typesSupportProcessingPipelineV2.types";

function buildInput(): RetrieveSupportKnowledgeInput {
  const topicEvidence = {
    proposalId: "proposal_notification",
    topicId: null,
    topicSourceVerbatims: [
      "I do not receive notifications on Android when I get a new email."
    ],
    relatedUnderstandingIds: ["understanding_notification"],
    relatedTextUnderstandings: [
      {
        understandingId: "understanding_notification",
        sourceSegmentIds: ["segment_notification"],
        sourceVerbatims: [
          "I do not receive notifications on Android when I get a new email."
        ],
        summary: "Android push notification is missing after new email.",
        primaryUserExpectation: "wants_solution" as const,
        supportNeeds: ["possible_bug" as const],
        broadCategoryHint: "bug" as const,
        contextDependency: "standalone_complete" as const,
        contextualAnswer: {
          type: "none" as const,
          value: null,
          evidence: null
        },
        facts: [],
        testedActions: [],
        uncertainties: []
      }
    ],
    relatedAttachmentUnderstandings: [],
    relatedSupportResponseCues: []
  };
  const topicKnowledgeEnrichmentPlan = {
    route: "retrieve_knowledge" as const,
    retrievalRequests: [
      {
        topicId: 0,
        query: "android notification new email"
      }
    ],
    reason: "matching_mock_knowledge_available"
  };

  return {
    knowledgeEnrichmentPlan: topicKnowledgeEnrichmentPlan,
    topicKnowledgeEnrichmentPlan,
    topicEvidence,
    selectedCatalogKnowledge: {
      selectedFields: [
        {
          fieldName: "platform",
          description: "Platform",
          askableByUser: true
        }
      ],
      selectedGenericKnowledge: [],
      scopeReason: "notification topic",
      rejectedFieldNames: []
    }
  };
}

describe("retrieveSupportKnowledge", function () {
  it("returns a ranked Android notification chunk for the current topic", async function () {
    const chunks = await retrieveSupportKnowledge(buildInput());

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({
      topicId: 0,
      sourceId: "android_push_notification_not_received"
    });
    expect(chunks[0].content).toContain(
      "Android push notification not received after new email"
    );
  });
});
