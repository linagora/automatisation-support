import * as fs from "fs/promises";
import * as path from "path";

import { describe, expect, it } from "vitest";

import {
  JsonKnowledgeRepository
} from "../../../src/repositories/json/jsonKnowledgeRepository";

import type {
  TopicEvidence
} from "../../../src/support-processing-pipeline/v2/typesSupportProcessingPipelineV2.types";

function buildTopicEvidence(params: {
  verbatim: string;
  summary: string;
  broadCategoryHint?: "bug" | "billing" | "access_security";
  supportNeeds?: (
    | "possible_bug"
    | "possible_billing_or_payment_action"
    | "possible_account_or_access_action"
  )[];
}): TopicEvidence {
  return {
    proposalId: "proposal_1",
    topicId: null,
    topicSourceVerbatims: [params.verbatim],
    relatedUnderstandingIds: ["understanding_1"],
    relatedTextUnderstandings: [
      {
        understandingId: "understanding_1",
        sourceSegmentIds: ["segment_1"],
        sourceVerbatims: [params.verbatim],
        summary: params.summary,
        primaryUserExpectation: "wants_solution",
        supportNeeds: params.supportNeeds ?? ["possible_bug"],
        ...(params.broadCategoryHint
          ? { broadCategoryHint: params.broadCategoryHint }
          : {}),
        contextDependency: "standalone_complete",
        contextualAnswer: {
          type: "none",
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
}

describe("JsonKnowledgeRepository", function () {
  it("loads active knowledge items", async function () {
    const repository = new JsonKnowledgeRepository();
    const items = await repository.listActive();

    expect(items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        knowledgeId: "android_push_notification_not_received",
        status: "active"
      })
    ]));
  });

  it("retrieves Android notification knowledge from topic evidence", async function () {
    const repository = new JsonKnowledgeRepository();
    const matches = await repository.searchRelevant({
      topicEvidence: buildTopicEvidence({
        verbatim:
          "I do not receive notifications on Android when I get a new email.",
        summary: "Android push notifications are missing after new email.",
        broadCategoryHint: "bug"
      }),
      selectedFieldNames: [
        "platform",
        "notification_permission_status"
      ]
    });

    expect(matches[0]).toMatchObject({
      item: {
        knowledgeId: "android_push_notification_not_received"
      }
    });
    expect(matches[0].score).toBeGreaterThan(0);
  });

  it("does not retrieve notification knowledge for billing or account topics", async function () {
    const repository = new JsonKnowledgeRepository();
    const billingMatches = await repository.searchRelevant({
      topicEvidence: buildTopicEvidence({
        verbatim: "I received my invoice twice.",
        summary: "Duplicate invoice.",
        broadCategoryHint: "billing",
        supportNeeds: ["possible_billing_or_payment_action"]
      })
    });
    const accountMatches = await repository.searchRelevant({
      topicEvidence: buildTopicEvidence({
        verbatim: "My account is blocked.",
        summary: "Blocked account.",
        broadCategoryHint: "access_security",
        supportNeeds: ["possible_account_or_access_action"]
      })
    });

    expect(billingMatches).toEqual([]);
    expect(accountMatches).toEqual([]);
  });

  it("does not retrieve notification knowledge for an unrelated Android bug", async function () {
    const matches = await new JsonKnowledgeRepository().searchRelevant({
      topicEvidence: buildTopicEvidence({
        verbatim: "The Android mobile app crashes when I open a folder.",
        summary: "Android app crashes on folder opening.",
        broadCategoryHint: "bug"
      })
    });

    expect(matches).toEqual([]);
  });

  it("does not mutate knowledge.json during runtime retrieval", async function () {
    const knowledgePath = path.resolve("data/knowledge.json");
    const before = await fs.readFile(knowledgePath, "utf8");

    await new JsonKnowledgeRepository(knowledgePath).searchRelevant({
      topicEvidence: buildTopicEvidence({
        verbatim:
          "I do not receive notifications on Android when I get a new email.",
        summary: "Android notifications are missing.",
        broadCategoryHint: "bug"
      })
    });

    await expect(fs.readFile(knowledgePath, "utf8")).resolves.toBe(before);
  });
});
