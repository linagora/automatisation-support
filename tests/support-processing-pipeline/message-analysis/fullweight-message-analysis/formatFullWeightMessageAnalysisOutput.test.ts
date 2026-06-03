import { describe, expect, it } from "vitest";

import {
  formatFullWeightMessageAnalysisOutput
} from "../../../../src/support-processing-pipeline/message-analysis/fullweight-message-analysis/formatFullWeightMessageAnalysisOutput";

describe("formatFullWeightMessageAnalysisOutput", function () {
  it("filters legacy attachment presence fields from normalized topic details", function () {
    const output = formatFullWeightMessageAnalysisOutput({
      rawFullWeightMessageAnalysis: {
        status: "completed",
        parsedResponse: {
          user_language: "French",
          segments_lack_comprehension: [],
          segments_topic: [
            {
              matched_historical_topic: "no",
              id_topic: 1,
              topic_category: "bug",
              tool_or_product: "Twake Drive",
              topic_action: "create",
              topic_object: "folder",
              topic_details: [
                {
                  field_name: "observed_result",
                  value: "validation button is disabled"
                },
                {
                  field_name: "screenshot_available",
                  value: "yes"
                },
                {
                  field_name: "image_available",
                  value: "yes"
                },
                {
                  field_name: "video_available",
                  value: "yes"
                },
                {
                  field_name: "attachment_available",
                  value: "yes"
                }
              ],
              tested_actions: [],
              user_goal: "Create a folder",
              blocking_issue: "yes"
            }
          ],
          segments_signal: [],
          segments_scope_boundary: [],
          segments_suspicious: []
        }
      }
    });

    expect(output.decision.route).toBe("continue");
    expect(output.analysis?.segments_topic?.[0].topic_details).toEqual({
      observed_result: "validation button is disabled"
    });
  });

  it("accepts fullweight output without topic_label", function () {
    const output = formatFullWeightMessageAnalysisOutput({
      rawFullWeightMessageAnalysis: {
        status: "completed",
        parsedResponse: {
          user_language: "French",
          segments_lack_comprehension: [],
          segments_topic: [
            {
              matched_historical_topic: "no",
              id_topic: 1,
              topic_category: "bug",
              tool_or_product: "Twake Drive",
              topic_action: "create",
              topic_object: "folder",
              topic_details: [
                {
                  field_name: "observed_result",
                  value: "validation button is disabled"
                }
              ],
              tested_actions: [],
              user_goal: "Create a folder",
              blocking_issue: "yes"
            }
          ],
          segments_signal: [],
          segments_scope_boundary: [],
          segments_suspicious: []
        }
      }
    });

    expect(output.decision.route).toBe("continue");
    expect(output.analysis?.segments_topic?.[0]).toMatchObject({
      tool_or_product: "Twake Drive",
      topic_action: "create",
      topic_object: "folder"
    });
    expect(output.analysis?.segments_topic?.[0]).not.toHaveProperty(
      "topic_label"
    );
  });

  it("keeps legacy topic_label compatible when old fullweight output contains it", function () {
    const output = formatFullWeightMessageAnalysisOutput({
      rawFullWeightMessageAnalysis: {
        status: "completed",
        parsedResponse: {
          user_language: "French",
          segments_lack_comprehension: [],
          segments_topic: [
            {
              matched_historical_topic: "no",
              id_topic: 1,
              topic_category: "bug",
              tool_or_product: "Twake Drive",
              topic_action: "create",
              topic_object: "folder",
              topic_label: "Legacy topic label",
              topic_details: [],
              tested_actions: [],
              user_goal: "Create a folder",
              blocking_issue: "yes"
            }
          ],
          segments_signal: [],
          segments_scope_boundary: [],
          segments_suspicious: []
        }
      }
    });

    expect(output.decision.route).toBe("continue");
    expect(output.analysis?.segments_topic?.[0]).toMatchObject({
      topic_label: "Legacy topic label"
    });
  });
});
