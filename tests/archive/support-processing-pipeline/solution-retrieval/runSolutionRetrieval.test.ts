import { describe, expect, it } from "vitest";

import {
  runSolutionRetrieval
} from "../../../src/archive/support-processing-pipeline/solution-retrieval/runSolutionRetrieval";

import type {
  SolutionRetrievalInput
} from "../../../src/archive/support-processing-pipeline/typesSupportProcessingPipeline.types";

function buildInput(): SolutionRetrievalInput {
  return {
    supportTopicKnowledge: {
      segments_topic: []
    },
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
  };
}

describe("runSolutionRetrieval", function () {
  it("currently returns no possible solution", async function () {
    const output = await runSolutionRetrieval(buildInput());

    expect(output).toEqual([]);
  });
});
