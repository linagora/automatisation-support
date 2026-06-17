import { describe, expect, it } from "vitest";

import {
  buildSupportPatchesV2
} from "../../../../src/support-processing-pipeline/v2/build-support-patches/buildSupportPatchesV2";

import type {
  BuildSupportPatchesInput,
  TextUnderstanding,
  TopicUpdateProposal
} from "../../../../src/support-processing-pipeline/v2/typesSupportProcessingPipelineV2.types";

const textUnderstanding: TextUnderstanding = {
  understandingId: "understanding_1",
  sourceSegmentIds: ["segment_1"],
  sourceVerbatims: ["J'ai reçu ma facture deux fois."],
  summary: "Duplicate invoice.",
  primaryUserExpectation: "wants_acknowledgement",
  supportNeeds: ["possible_billing_or_payment_action"],
  broadCategoryHint: "billing",
  contextDependency: "standalone_complete",
  contextualAnswer: {
    type: "none",
    value: null,
    evidence: null
  },
  facts: [
    {
      type: "catalogued_field",
      fieldName: "billing_issue_type",
      value: "duplicate invoice",
      evidence: "facture deux fois"
    }
  ],
  testedActions: [],
  uncertainties: []
};

function buildInput(
  topicUpdateProposals: TopicUpdateProposal[]
): BuildSupportPatchesInput {
  return {
    promptSecuritySignals: {
      matchedPatternIds: []
    },
    turnAnalysisPlan: {
      analyzeText: true,
      analyzeAttachments: false,
      matchedPatternIds: []
    },
    supportTopicKnowledge: {
      segments_topic: [
        {
          id_topic: 4,
          topic_category: "access_security",
          topic_label: "Compte bloqué",
          topic_details: {},
          user_goal: "Récupérer l'accès au compte",
          blocking_issue: "yes"
        }
      ]
    },
    textUnderstandings: [textUnderstanding],
    topicUpdateProposals,
    userResponse: {
      messages: [
        {
          type: "topic_response",
          content: "Message final."
        }
      ]
    }
  };
}

describe("buildSupportPatchesV2", function () {
  it("converts create_new_topic and update_existing_topic proposals into V1-compatible topic deltas", function () {
    const patches = buildSupportPatchesV2(buildInput([
      {
        proposalId: "proposal_create",
        action: "create_new_topic",
        fromUnderstandingIds: ["understanding_1"],
        topicId: null,
        selectedSourceVerbatims: ["J'ai reçu ma facture deux fois."],
        updateIntent: null,
        newTopic: {
          title: "Facture en double",
          broadCategoryHint: "billing",
          userGoal: "Comprendre la facture en double",
          blockingIssue: "unknown"
        },
        reason: "Distinct billing topic."
      },
      {
        proposalId: "proposal_update",
        action: "update_existing_topic",
        fromUnderstandingIds: ["understanding_1"],
        topicId: "topic_4",
        selectedSourceVerbatims: ["J'ai reçu ma facture deux fois."],
        updateIntent: {
          relationship: "adds_new_information",
          blockingIssue: "no",
          statusHint: "open",
          userGoal: "Ajouter le contexte de facturation",
          correctionNote: null
        },
        newTopic: null,
        reason: "Adds information to an existing topic."
      }
    ]));

    expect(patches.analysisPatch.turnUnderstandingDelta.segments_topic).toEqual([
      expect.objectContaining({
        matched_historical_topic: "no",
        id_topic: 5,
        topic_category: "billing",
        topic_label: "Facture en double",
        topic_details: {
          billing_issue_type: "duplicate invoice"
        },
        blocking_issue: "no"
      }),
      expect.objectContaining({
        matched_historical_topic: "yes",
        id_topic: 4,
        topic_details: {
          billing_issue_type: "duplicate invoice"
        },
        user_goal: "Ajouter le contexte de facturation",
        blocking_issue: "no"
      })
    ]);
  });

  it("keeps needs_review proposals out of topic deltas and records them in metadata", function () {
    const reviewProposal: TopicUpdateProposal = {
      proposalId: "proposal_review",
      action: "needs_review",
      fromUnderstandingIds: ["understanding_1"],
      topicId: null,
      selectedSourceVerbatims: ["Ambiguous"],
      updateIntent: null,
      newTopic: null,
      reason: "Ambiguous topic relationship."
    };
    const patches = buildSupportPatchesV2(buildInput([reviewProposal]));

    expect(patches.analysisPatch.turnUnderstandingDelta.segments_topic).toEqual([]);
    expect(patches.metadataPatch).toMatchObject({
      reviewProposals: [reviewProposal]
    });
  });
});
