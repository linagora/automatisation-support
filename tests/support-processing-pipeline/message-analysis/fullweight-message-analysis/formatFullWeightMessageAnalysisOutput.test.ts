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

  it("omits nullable topic identity fields from the normalized delta", function () {
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
              topic_category: "access_security",
              tool_or_product: null,
              topic_action: "reset",
              topic_object: "password",
              topic_details: [],
              tested_actions: [],
              user_goal: "Reset password",
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
      topic_action: "reset",
      topic_object: "password"
    });
    expect(output.analysis?.segments_topic?.[0]).not.toHaveProperty(
      "tool_or_product"
    );
  });

  it("keeps non-empty topic segment verbatims", function () {
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
              topic_category: "question_faq",
              tool_or_product: "Drive",
              topic_action: "share",
              topic_object: "folder",
              segment_verbatims: [
                " Comment partager un dossier avec un collègue dans Drive ? "
              ],
              topic_details: [
                {
                  field_name: "question_intent",
                  value: "how_to"
                }
              ],
              tested_actions: [],
              user_goal: "Share a folder in Drive",
              blocking_issue: "no"
            }
          ],
          segments_signal: [],
          segments_scope_boundary: [],
          segments_suspicious: []
        }
      }
    });

    expect(output.decision.route).toBe("continue");
    expect(output.analysis?.segments_topic?.[0].segment_verbatims).toEqual([
      "Comment partager un dossier avec un collègue dans Drive ?"
    ]);
  });

  it("drops empty topic segment verbatim strings", function () {
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
              topic_category: "billing",
              tool_or_product: null,
              topic_action: null,
              topic_object: null,
              segment_verbatims: ["", "   "],
              topic_details: [],
              tested_actions: [],
              user_goal: "Report a billing issue",
              blocking_issue: "no"
            }
          ],
          segments_signal: [],
          segments_scope_boundary: [],
          segments_suspicious: []
        }
      }
    });

    expect(output.decision.route).toBe("continue");
    expect(output.analysis?.segments_topic?.[0]).not.toHaveProperty(
      "segment_verbatims"
    );
  });
});
