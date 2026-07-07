import { describe, expect, it } from "vitest";

import {
  applyTurnUnderstandingDeltaToTicket
} from "../../src/archive/persistence/applyTurnUnderstandingDeltaToTicket";

import type {
  JsonTicket
} from "../../src/archive/repositories/json/typesJsonRepositories.types";
import type {
  ConversationHistory,
  SupportTopicKnowledge,
  TurnUnderstandingDelta
} from "../../src/archive/support-processing-pipeline/typesSupportProcessingPipeline.types";

const conversationHistory = [] as ConversationHistory;

function buildTicket(
  supportTopicKnowledge: SupportTopicKnowledge
): JsonTicket {
  return {
    ticketId: "ticket_1",
    roomId: "!room:example.org",
    userId: "@user:example.org",
    status: "active",
    supportTopicKnowledge,
    conversationHistory,
    createdAt: "2026-06-05T10:00:00.000Z",
    updatedAt: "2026-06-05T10:00:00.000Z"
  };
}

function buildDelta(
  overrides: Partial<TurnUnderstandingDelta> = {}
): TurnUnderstandingDelta {
  return {
    user_language: "french",
    securityGateSummary: {
      gateChecked: {},
      gateFailed: []
    },
    segments_lack_comprehension: [],
    segments_topic: [],
    segments_signal: [],
    segments_scope_boundary: [],
    segments_suspicious: [],
    ...overrides
  };
}

describe("applyTurnUnderstandingDeltaToTicket", function () {
  it("adds new topics from unmatched topic deltas", function () {
    const ticket = buildTicket({
      segments_topic: []
    });
    const result = applyTurnUnderstandingDeltaToTicket({
      ticket,
      generatedAt: "2026-06-05T10:00:05.000Z",
      turnUnderstandingDelta: buildDelta({
        segments_topic: [
          {
            matched_historical_topic: "no",
            id_topic: 1,
            topic_category: "question_faq",
            tool_or_product: "Drive",
            topic_action: "share",
            topic_object: "folder",
            segment_verbatims: ["Comment partager un dossier ?"],
            topic_details: {
              question_intent: "how_to"
            },
            user_goal: "Share a folder",
            blocking_issue: "no"
          }
        ]
      })
    });

    expect(result.supportTopicKnowledge.topics).toEqual([
      {
        id_topic: 1,
        topic_category: "question_faq",
        tool_or_product: "Drive",
        topic_action: "share",
        topic_object: "folder",
        segment_verbatims: ["Comment partager un dossier ?"],
        topic_details: {
          question_intent: "how_to"
        },
        user_goal: "Share a folder",
        blocking_issue: "no"
      }
    ]);
    expect(result.metadata).toMatchObject({
      lastPatchGeneratedAt: "2026-06-05T10:00:05.000Z",
      lastUserLanguage: "french"
    });
  });

  it("merges matched topic details, tested actions and verbatims without duplicates", function () {
    const ticket = buildTicket({
      segments_topic: [
        {
          id_topic: 1,
          topic_category: "bug",
          tool_or_product: "Drive",
          topic_action: "create",
          topic_object: "folder",
          segment_verbatims: ["Le bouton est grisé"],
          topic_details: {
            observed_result: "button disabled"
          },
          tested_actions: [
            {
              tested_action: "reload",
              outcome_tested_action: "failed"
            }
          ],
          user_goal: "Create folder",
          blocking_issue: "yes"
        }
      ]
    });

    const result = applyTurnUnderstandingDeltaToTicket({
      ticket,
      generatedAt: "2026-06-05T10:00:05.000Z",
      turnUnderstandingDelta: buildDelta({
        segments_topic: [
          {
            matched_historical_topic: "yes",
            id_topic: 1,
            topic_details: {
              platform: "web"
            },
            tested_actions: [
              {
                tested_action: "reload",
                outcome_tested_action: "failed"
              },
              {
                tested_action: "logout/login",
                outcome_tested_action: "failed"
              }
            ],
            segment_verbatims: [
              "Le bouton est grisé",
              "Sur web uniquement"
            ],
            user_goal: "Create a Drive folder",
            blocking_issue: "yes"
          }
        ]
      })
    });

    expect(result.supportTopicKnowledge.topics[0]).toMatchObject({
      topic_details: {
        observed_result: "button disabled",
        platform: "web"
      },
      tested_actions: [
        {
          tested_action: "reload",
          outcome_tested_action: "failed"
        },
        {
          tested_action: "logout/login",
          outcome_tested_action: "failed"
        }
      ],
      segment_verbatims: [
        "Le bouton est grisé",
        "Sur web uniquement"
      ],
      user_goal: "Create a Drive folder",
      blocking_issue: "yes"
    });
  });
});
