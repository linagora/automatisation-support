import { describe, expect, it } from "vitest";

import {
  buildTopicDisplayLabel
} from "../../src/support-processing-pipeline/buildTopicDisplayLabel";

describe("buildTopicDisplayLabel", function () {
  it("builds the display label from structured topic fields", function () {
    expect(
      buildTopicDisplayLabel({
        tool_or_product: "Twake Drive",
        topic_action: "create",
        topic_object: "folder"
      })
    ).toBe("Twake Drive : create : folder");
  });

  it("keeps legacy topic_label as fallback when structured fields are missing", function () {
    expect(
      buildTopicDisplayLabel({
        topic_label: "Legacy topic label"
      })
    ).toBe("Legacy topic label");
  });
});
