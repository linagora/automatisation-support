import { describe, expect, it } from "vitest";

import {
  formatProposeTopicUpdatesOutput
} from "../../../../src/support-processing-pipeline/v2/propose-topic-updates/formatProposeTopicUpdatesOutput";
import {
  buildProposeTopicUpdatesPrompt
} from "../../../../src/support-processing-pipeline/v2/propose-topic-updates/buildProposeTopicUpdatesPrompt";

import type {
  TextUnderstanding
} from "../../../../src/support-processing-pipeline/v2/typesSupportProcessingPipelineV2.types";

function understanding(params: {
  id: string;
  summary: string;
  sourceVerbatims: string[];
  broadCategoryHint?: TextUnderstanding["broadCategoryHint"];
}): TextUnderstanding {
  return {
    understandingId: params.id,
    sourceSegmentIds: [`segment_${params.id}`],
    sourceVerbatims: params.sourceVerbatims,
    summary: params.summary,
    primaryUserExpectation: "wants_solution",
    supportNeeds: ["possible_bug"],
    ...(params.broadCategoryHint
      ? { broadCategoryHint: params.broadCategoryHint }
      : {}),
    contextDependency: "standalone_but_may_match_existing",
    contextualAnswer: {
      type: "none",
      value: null,
      evidence: null
    },
    facts: [],
    testedActions: [],
    uncertainties: []
  };
}

function completed(parsedResponse: unknown) {
  return {
    status: "completed" as const,
    parsedResponse,
    rawResponse: JSON.stringify(parsedResponse)
  };
}

function updateProposal(params: {
  understandingIds: string[];
  topicId: string;
  relationship?: string;
  blockingIssue?: string;
  selectedSourceVerbatims?: string[];
}) {
  return {
    action: "update_existing_topic",
    fromUnderstandingIds: params.understandingIds,
    topicId: params.topicId,
    selectedSourceVerbatims: params.selectedSourceVerbatims ?? [],
    updateIntent: {
      relationship: params.relationship ?? "adds_new_information",
      blockingIssue: params.blockingIssue ?? "yes",
      statusHint: "open",
      userGoal: null,
      correctionNote: null
    },
    newTopic: null,
    reason: "Updates the existing topic."
  };
}

const accountTopic = {
  id_topic: "topic_account",
  topic_category: "access_security",
  summary: "Compte bloqué"
};

const billingTopic = {
  id_topic: "topic_billing",
  topic_category: "billing",
  summary: "Billing issue"
};

describe("formatProposeTopicUpdatesOutput", function () {
  it("formats an update_existing_topic proposal", function () {
    const accountUnderstanding = understanding({
      id: "text_understanding_1",
      summary: "Compte toujours bloqué",
      sourceVerbatims: ["Mon compte est toujours bloqué"]
    });
    const output = formatProposeTopicUpdatesOutput({
      existingTopics: [accountTopic],
      textUnderstandings: [accountUnderstanding],
      rawProposeTopicUpdates: completed({
        proposals: [
          updateProposal({
            understandingIds: [accountUnderstanding.understandingId],
            topicId: "topic_account",
            relationship: "reopens_or_persists_issue"
          })
        ]
      })
    });

    expect(output).toMatchObject({
      status: "valid",
      topicUpdateProposals: [
        {
          proposalId: "topic_update_proposal_1",
          action: "update_existing_topic",
          topicId: "topic_account",
          updateIntent: {
            relationship: "reopens_or_persists_issue",
            blockingIssue: "yes",
            statusHint: "open"
          }
        }
      ]
    });
  });

  it("formats a create_new_topic proposal without generating a final topic id", function () {
    const billingUnderstanding = understanding({
      id: "text_understanding_1",
      summary: "Facture de mai reçue deux fois",
      sourceVerbatims: ["facture de mai reçue deux fois"],
      broadCategoryHint: "billing"
    });
    const output = formatProposeTopicUpdatesOutput({
      existingTopics: [accountTopic],
      textUnderstandings: [billingUnderstanding],
      rawProposeTopicUpdates: completed({
        proposals: [
          {
            action: "create_new_topic",
            fromUnderstandingIds: [billingUnderstanding.understandingId],
            topicId: null,
            selectedSourceVerbatims: ["facture de mai reçue deux fois"],
            updateIntent: {
              relationship: "creates_distinct_topic",
              blockingIssue: "unknown",
              statusHint: "open",
              userGoal: "Fix duplicate invoice",
              correctionNote: null
            },
            newTopic: {
              title: "Duplicate May invoice",
              broadCategoryHint: "billing",
              userGoal: "Fix duplicate invoice",
              blockingIssue: "unknown"
            },
            reason: "The billing issue is distinct from account access."
          }
        ]
      })
    });

    expect(output.status).toBe("valid");
    expect(output.topicUpdateProposals[0]).toMatchObject({
      action: "create_new_topic",
      topicId: null,
      newTopic: {
        broadCategoryHint: "billing",
        blockingIssue: "unknown"
      }
    });
  });

  it("updates an existing topic for an answer to a requested field", function () {
    const answerUnderstanding = understanding({
      id: "text_understanding_1",
      summary: "The user confirms billing relevance.",
      sourceVerbatims: ["Oui pour la facturation"],
      broadCategoryHint: "billing"
    });
    const output = formatProposeTopicUpdatesOutput({
      existingTopics: [billingTopic],
      textUnderstandings: [answerUnderstanding],
      rawProposeTopicUpdates: completed({
        proposals: [
          updateProposal({
            understandingIds: [answerUnderstanding.understandingId],
            topicId: "topic_billing",
            relationship: "answers_requested_field"
          })
        ]
      })
    });

    expect(output.topicUpdateProposals[0]).toMatchObject({
      action: "update_existing_topic",
      topicId: "topic_billing",
      newTopic: null,
      updateIntent: {
        relationship: "answers_requested_field"
      }
    });
  });

  it("allows several understandings to update the same topic", function () {
    const blockedAccount = understanding({
      id: "text_understanding_1",
      summary: "Compte bloqué",
      sourceVerbatims: ["Mon compte est bloqué"]
    });
    const failedReconnect = understanding({
      id: "text_understanding_2",
      summary: "Reconnection failed",
      sourceVerbatims: ["J'ai réessayé de me connecter"]
    });
    const output = formatProposeTopicUpdatesOutput({
      existingTopics: [accountTopic],
      textUnderstandings: [blockedAccount, failedReconnect],
      rawProposeTopicUpdates: completed({
        proposals: [
          updateProposal({
            understandingIds: [
              blockedAccount.understandingId,
              failedReconnect.understandingId
            ],
            topicId: "topic_account",
            relationship: "reports_test_result"
          })
        ]
      })
    });

    expect(output.status).toBe("valid");
    expect(output.topicUpdateProposals).toHaveLength(1);
    expect(output.topicUpdateProposals[0]?.fromUnderstandingIds).toEqual([
      "text_understanding_1",
      "text_understanding_2"
    ]);
    expect(output.topicUpdateProposals[0]?.action).toBe(
      "update_existing_topic"
    );
  });

  it("keeps unclear matching as needs_review", function () {
    const vagueUnderstanding = understanding({
      id: "text_understanding_1",
      summary: "Still not working",
      sourceVerbatims: ["Toujours pareil"]
    });
    const output = formatProposeTopicUpdatesOutput({
      existingTopics: [accountTopic, billingTopic],
      textUnderstandings: [vagueUnderstanding],
      rawProposeTopicUpdates: completed({
        proposals: [
          {
            action: "needs_review",
            fromUnderstandingIds: [vagueUnderstanding.understandingId],
            topicId: null,
            selectedSourceVerbatims: ["Toujours pareil"],
            updateIntent: {
              relationship: "unclear",
              blockingIssue: "unknown",
              statusHint: "unclear",
              userGoal: null,
              correctionNote: null
            },
            newTopic: null,
            reason: "The existing topic match is ambiguous."
          }
        ]
      })
    });

    expect(output.status).toBe("valid");
    expect(output.topicUpdateProposals[0]?.action).toBe("needs_review");
    expect(output.topicUpdateProposals[0]?.newTopic).toBeNull();
  });

  it("rejects invalid proposals and creates deterministic review fallback", function () {
    const blockedAccount = understanding({
      id: "text_understanding_1",
      summary: "Compte bloqué",
      sourceVerbatims: ["Mon compte est bloqué"]
    });
    const output = formatProposeTopicUpdatesOutput({
      existingTopics: [accountTopic],
      textUnderstandings: [blockedAccount],
      rawProposeTopicUpdates: completed({
        proposals: [
          {
            action: "update_existing_topic",
            fromUnderstandingIds: ["unknown_understanding"],
            topicId: "unknown_topic",
            selectedSourceVerbatims: ["not exact"],
            updateIntent: {
              relationship: "adds_new_information",
              blockingIssue: "yes",
              statusHint: "open",
              userGoal: null,
              correctionNote: null
            },
            newTopic: null,
            reason: "Invalid proposal."
          }
        ]
      })
    });

    expect(output.status).toBe("invalid");
    expect(output.topicUpdateProposals).toEqual([
      {
        proposalId: "topic_update_proposal_1",
        action: "needs_review",
        fromUnderstandingIds: ["text_understanding_1"],
        topicId: null,
        selectedSourceVerbatims: [],
        updateIntent: {
          relationship: "unclear",
          blockingIssue: "unknown",
          statusHint: "unclear",
          userGoal: null,
          correctionNote: null
        },
        newTopic: null,
        reason: "No valid topic update proposal covered this understanding."
      }
    ]);
  });
});

describe("buildProposeTopicUpdatesPrompt", function () {
  it("keeps topic matching independent from standard segments and documents conservative blocking rules", function () {
    const prompt = buildProposeTopicUpdatesPrompt({
      existingTopics: [accountTopic],
      textUnderstandings: [
        understanding({
          id: "text_understanding_1",
          summary: "Compte bloqué",
          sourceVerbatims: ["Mon compte est toujours bloqué"]
        })
      ],
      recentInteractionContext: {},
      latestUserMessageContent: "Mon compte est toujours bloqué"
    });
    const content = prompt.messages.map((message) => message.content).join("\n");

    expect(content).not.toContain("standard_segments");
    expect(content).not.toContain("linkedStandardSegmentIds");
    expect(content).toContain("\"Mon compte est toujours bloqué.\" -> blockingIssue yes");
    expect(content).toContain("\"J'ai reçu ma facture de mai deux fois.\" -> blockingIssue unknown");
    expect(content).toContain("Do not infer that billing topics are blocking");
  });
});
