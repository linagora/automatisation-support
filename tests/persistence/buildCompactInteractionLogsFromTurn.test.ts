import { describe, expect, it } from "vitest";

import {
  buildCompactInteractionLogsFromTurn
} from "../../src/persistence/buildCompactInteractionLogsFromTurn";

import type {
  ResponsePlan,
  TurnUnderstandingDelta
} from "../../src/support-processing-pipeline/typesSupportProcessingPipeline.types";

function buildDelta(
  overrides: Partial<TurnUnderstandingDelta> = {}
): TurnUnderstandingDelta {
  return {
    user_language: "French",
    segments_lack_comprehension: [],
    segments_topic: [],
    segments_signal: [],
    segments_scope_boundary: [],
    segments_suspicious: [],
    ...overrides
  };
}

function buildResponsePlan(
  overrides: Partial<ResponsePlan> = {}
): ResponsePlan {
  return {
    responseLanguage: "french",
    messagesPlan: {
      scopeBoundaryPlanMessages: [],
      topicPlanMessages: [],
      signalPlanMessages: [],
      handoverPlanMessages: []
    },
    ...overrides
  };
}

describe("buildCompactInteractionLogsFromTurn", function () {
  it("logs a newly created user topic", function () {
    const logs = buildCompactInteractionLogsFromTurn({
      generatedAt: "2026-06-05T10:00:05.000Z",
      turnUnderstandingDelta: buildDelta({
        segments_topic: [
          {
            matched_historical_topic: "no",
            id_topic: 1,
            topic_category: "bug",
            tool_or_product: "Twake",
            topic_action: "create",
            topic_object: "room",
            topic_details: {},
            user_goal: "Create a Twake room",
            blocking_issue: "yes"
          }
        ]
      }),
      responsePlan: buildResponsePlan()
    });

    expect(logs.map((log) => log.line)).toContain(
      'User(topic): add_topic topic_id=1 label="Twake : create : room" category=bug'
    );
  });

  it("logs user topic detail updates with internal field names", function () {
    const logs = buildCompactInteractionLogsFromTurn({
      generatedAt: "2026-06-05T10:00:05.000Z",
      turnUnderstandingDelta: buildDelta({
        segments_topic: [
          {
            matched_historical_topic: "yes",
            id_topic: 2,
            topic_details: {
              platform: "web"
            }
          }
        ]
      }),
      responsePlan: buildResponsePlan()
    });

    expect(logs.map((log) => log.line)).toContain(
      "User(topic): update_topic topic_id=2 fields=[platform]"
    );
  });

  it("does not describe a non-blocking unresolved bug as resolved", function () {
    const logs = buildCompactInteractionLogsFromTurn({
      generatedAt: "2026-06-05T10:00:05.000Z",
      turnUnderstandingDelta: buildDelta({
        segments_topic: [
          {
            matched_historical_topic: "yes",
            id_topic: 4,
            segment_verbatims: ["I still do not receive notifications."],
            blocking_issue: "no"
          }
        ]
      }),
      responsePlan: buildResponsePlan()
    });
    const lines = logs.map((log) => log.line);

    expect(lines).toContain("User(topic): mark_non_blocking topic_id=4");
    expect(lines).not.toContain("User(topic): mark_resolved topic_id=4");
  });

  it("logs bot ask_fields responses", function () {
    const logs = buildCompactInteractionLogsFromTurn({
      generatedAt: "2026-06-05T10:00:05.000Z",
      turnUnderstandingDelta: buildDelta(),
      responsePlan: buildResponsePlan({
        messagesPlan: {
          scopeBoundaryPlanMessages: [],
          topicPlanMessages: [
            {
              politeness_opening: "understanding_1",
              topic_relation_acknowledgement: {
                no_matched_historical_topic_count: 0,
                matched_historical_topic_count: 1
              },
              topics_responses: [
                {
                  topic_response: {
                    title: {
                      topic_id: 2,
                      topic_category: "bug",
                      tool_or_product: "Twake",
                      topic_action: "create",
                      topic_object: "room",
                      matched_historical_topic: true
                    },
                    updated_fields_acknowledgement: {},
                    main_response: {
                      type: "ask_fields",
                      details: {
                        fields_requested: ["platform"]
                      }
                    },
                    next_step: "wait_more_info"
                  }
                }
              ],
              politeness_closure: "thanks_for_cooperation1"
            }
          ],
          signalPlanMessages: [],
          handoverPlanMessages: []
        }
      })
    });

    expect(logs.map((log) => log.line)).toContain(
      'Bot(topic): ask_more_info topic_id=2 label="Twake : create : room" fields=[platform]'
    );
  });

  it("logs bot acknowledgements with next step", function () {
    const logs = buildCompactInteractionLogsFromTurn({
      generatedAt: "2026-06-05T10:00:05.000Z",
      turnUnderstandingDelta: buildDelta(),
      responsePlan: buildResponsePlan({
        messagesPlan: {
          scopeBoundaryPlanMessages: [],
          topicPlanMessages: [
            {
              politeness_opening: "understanding_1",
              topic_relation_acknowledgement: {
                no_matched_historical_topic_count: 0,
                matched_historical_topic_count: 1
              },
              topics_responses: [
                {
                  topic_response: {
                    title: {
                      topic_id: 2,
                      matched_historical_topic: true
                    },
                    updated_fields_acknowledgement: {},
                    main_response: {
                      type: "acknowledgement"
                    },
                    next_step: "wait_for_support"
                  }
                }
              ],
              politeness_closure: "thanks_for_cooperation1"
            }
          ],
          signalPlanMessages: [],
          handoverPlanMessages: []
        }
      })
    });

    expect(logs.map((log) => log.line)).toContain(
      "Bot(topic): acknowledge topic_id=2 next_step=wait_for_support"
    );
  });
});
