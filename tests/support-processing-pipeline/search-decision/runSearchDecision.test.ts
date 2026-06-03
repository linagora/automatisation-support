import { describe, expect, it } from "vitest";

import {
  runSearchDecision
} from "../../../src/support-processing-pipeline/search-decision/runSearchDecision";

import type {
  SearchDecisionInput
} from "../../../src/support-processing-pipeline/typesSupportProcessingPipeline.types";

function buildInput(
  overrides: Partial<SearchDecisionInput> = {}
): SearchDecisionInput {
  return {
    supportTopicKnowledge: {
      segments_topic: []
    },
    turnUnderstandingDelta: {
      user_language: "french",
      segments_lack_comprehension: [],
      segments_topic: [],
      segments_signal: [],
      segments_scope_boundary: [],
      segments_suspicious: []
    },
    accountInteractionTraits: {
      labels: [],
      lastUpdatedAt: "2026-06-03T08:00:00.000Z"
    },
    conversationHistory: [],
    ...overrides
  };
}

describe("runSearchDecision", function () {
  it("returns no_topic when the turn has no topic segment", async function () {
    const output = await runSearchDecision(buildInput());

    expect(output).toMatchObject({
      decision: {
        route: "continue",
        topics: []
      },
      detected: {
        topicsQualificationResult: "no_topic",
        solutionLikelihoodResult: "no_topic"
      }
    });
  });

  it("asks for missing required fields before searching solutions", async function () {
    const output = await runSearchDecision(
      buildInput({
        turnUnderstandingDelta: {
          user_language: "french",
          segments_lack_comprehension: [],
          segments_topic: [
            {
              matched_historical_topic: "no",
              id_topic: 1,
              topic_category: "bug",
              tool_or_product: "Twake Drive",
              topic_action: "create",
              topic_object: "folder",
              topic_details: {
                observed_result: "nothing happens"
              },
              user_goal: "Create a folder",
              blocking_issue: "yes"
            }
          ],
          segments_signal: [],
          segments_scope_boundary: [],
          segments_suspicious: []
        }
      })
    );

    expect(output.decision.topics).toEqual([
      {
        topic_id: 1,
        type: "ask_more_info",
        missing_fields: ["expected_result", "trigger_action", "platform"]
      }
    ]);
    expect(output.detected.solutionLikelihoodResult).toBe("rag_not_relevant");
  });

  it("searches solutions for a qualified RAG eligible topic", async function () {
    const output = await runSearchDecision(
      buildInput({
        turnUnderstandingDelta: {
          user_language: "french",
          segments_lack_comprehension: [],
          segments_topic: [
            {
              matched_historical_topic: "no",
              id_topic: 1,
              topic_category: "bug",
              tool_or_product: "Twake Drive",
              topic_action: "create",
              topic_object: "folder",
              topic_details: {
                observed_result: "nothing happens",
                expected_result: "folder should be created",
                trigger_action: "click create folder",
                platform: "web"
              },
              user_goal: "Create a folder",
              blocking_issue: "yes"
            }
          ],
          segments_signal: [],
          segments_scope_boundary: [],
          segments_suspicious: []
        }
      })
    );

    expect(output.decision.topics).toEqual([
      {
        topic_id: 1,
        type: "solution_searching",
        missing_fields: []
      }
    ]);
    expect(output.detected.solutionLikelihoodResult).toBe("rag_relevant");
  });

  it("acknowledges instead of searching when handover is explicitly requested", async function () {
    const output = await runSearchDecision(
      buildInput({
        turnUnderstandingDelta: {
          user_language: "french",
          segments_lack_comprehension: [],
          segments_topic: [
            {
              matched_historical_topic: "no",
              id_topic: 1,
              topic_category: "bug",
              tool_or_product: "Twake Drive",
              topic_action: "create",
              topic_object: "folder",
              topic_details: {
                observed_result: "nothing happens",
                expected_result: "folder should be created",
                trigger_action: "click create folder",
                platform: "web"
              },
              user_goal: "Create a folder",
              blocking_issue: "yes"
            }
          ],
          segments_signal: [
            {
              signal_verbatim: "Je veux parler à un humain",
              signal_types: ["handover_request"]
            }
          ],
          segments_scope_boundary: [],
          segments_suspicious: []
        }
      })
    );

    expect(output.decision.topics).toEqual([
      {
        topic_id: 1,
        type: "acknowledgement",
        missing_fields: []
      }
    ]);
    expect(output.detected.solutionLikelihoodResult).toBe("rag_not_relevant");
  });
});
