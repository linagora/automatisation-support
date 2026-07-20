import { describe, expect, it } from "vitest";

import {
  buildUnansweredRequestedFieldNamesForTopic
} from "../../../src/support-automation/support-processing-pipeline-v2/unansweredRequestedFields";

import type {
  MergedTopicSnapshot,
  ResponsePlanV2
} from "../../../src/support-automation/support-processing-pipeline-v2/typesSupportProcessingPipelineV2.types";

function snapshot(
  overrides: Partial<MergedTopicSnapshot> = {}
): MergedTopicSnapshot {
  return {
    snapshotId: "topic_1",
    topicId: 1,
    temporaryTopicId: null,
    isNewTopic: false,
    title: "Login problem",
    broadCategoryHint: "access_security",
    summary: "The user cannot log in.",
    caseDetails: [
      {
        key: "platform",
        value: "Android",
        evidence: "Android"
      }
    ],
    attemptedActions: [],
    sourceUnderstandingIds: ["understanding_1"],
    sourceVerbatims: ["I cannot log in on Android."],
    sourceOpIndex: 0,
    baseTopic: null,
    ...overrides
  };
}

function responsePlan(overrides: Partial<ResponsePlanV2> = {}): ResponsePlanV2 {
  return {
    topicId: 1,
    acknowledge: [],
    answer: [],
    ask: [
      {
        fieldName: "error_message",
        goal: "Identify the exact login failure."
      }
    ],
    say: ["Ask for the error message."],
    review: null,
    ...overrides
  };
}

describe("buildUnansweredRequestedFieldNamesForTopic", function () {
  it("preserves previous unanswered fields that are still absent", function () {
    const fieldNames = buildUnansweredRequestedFieldNamesForTopic({
      snapshot: snapshot(),
      topicResponsePlan: responsePlan({ ask: [] }),
      previousUnansweredRequestedFieldNames: [
        "error_message",
        "failure_step"
      ]
    });

    expect(fieldNames).toEqual(["error_message", "failure_step"]);
  });

  it("removes fields once present in caseDetails", function () {
    const fieldNames = buildUnansweredRequestedFieldNamesForTopic({
      snapshot: snapshot({
        caseDetails: [
          {
            key: "plan_or_subscription",
            value: "Pro plan",
            evidence: "Pro plan"
          }
        ]
      }),
      topicResponsePlan: responsePlan({ ask: [] }),
      previousUnansweredRequestedFieldNames: [
        "plan_or_subscription",
        "billing_or_payment_status"
      ]
    });

    expect(fieldNames).toEqual(["billing_or_payment_status"]);
  });

  it("adds current validated ask fields and deduplicates while preserving order", function () {
    const fieldNames = buildUnansweredRequestedFieldNamesForTopic({
      snapshot: snapshot({
        caseDetails: []
      }),
      topicResponsePlan: responsePlan({
        ask: [
          {
            fieldName: "amount",
            goal: "Confirm the charged amount."
          },
          {
            fieldName: "billing_or_payment_status",
            goal: "Confirm the payment status."
          },
          {
            fieldName: "amount",
            goal: "Duplicate ask should not duplicate memory."
          }
        ]
      }),
      previousUnansweredRequestedFieldNames: [
        "plan_or_subscription",
        "billing_or_payment_status"
      ]
    });

    expect(fieldNames).toEqual([
      "plan_or_subscription",
      "billing_or_payment_status",
      "amount"
    ]);
  });

  it("ignores say instructions and does not infer diagnostic flow delivery", function () {
    const fieldNames = buildUnansweredRequestedFieldNamesForTopic({
      snapshot: snapshot({
        caseDetails: []
      }),
      topicResponsePlan: responsePlan({
        ask: [],
        say: [
          "Ask the user for platform, error_message, and diagnostic flow details."
        ]
      }),
      previousUnansweredRequestedFieldNames: []
    });

    expect(fieldNames).toEqual([]);
  });
});
