import {describe, expect, it} from "vitest";

import {
  buildStandardResponseFragments
} from "../../../../src/support-automation/support-processing-pipeline-v2-LEGACY/build-standard-response-fragments/buildStandardResponseFragments";

import type {
  BuildStandardResponseFragmentsInput
} from "../../../../src/support-automation/support-processing-pipeline-v2-LEGACY/build-standard-response-fragments/buildStandardResponseFragments";

function buildInput(
  params: BuildStandardResponseFragmentsInput
): BuildStandardResponseFragmentsInput {
  return params;
}

describe("buildStandardResponseFragments", function () {
  it("ignores support-relevant segments", function () {
    expect(
      buildStandardResponseFragments(buildInput({
        textSurfaceAnalysis: {
          segments: [
            {
              segmentId: "text_segment_1",
              verbatim: "Mon calendrier ne synchronise plus.",
              category: "support_relevant"
            }
          ]
        }
      }))
    ).toEqual([]);
  });

  it("projects non-support surface segments to standard English instructions", function () {
    const [fragment] = buildStandardResponseFragments(buildInput({
      textSurfaceAnalysis: {
        segments: [
          {
            segmentId: "text_segment_1",
            verbatim: "Bonjour",
            category: "standard_interaction",
            standardSubcategory: "greeting"
          }
        ]
      }
    }));

    expect(fragment).toEqual({
      segmentId: "text_segment_1",
      verbatim: "Bonjour",
      category: "standard_interaction",
      standardSubcategory: "greeting",
      say: expect.stringContaining(
        "Acknowledge the greeting naturally."
      ),
      content: expect.stringContaining("Acknowledge the greeting naturally.")
    });
    expect(fragment?.content).toBe(fragment?.say);
  });

  it("returns no fallback fragment when there is no usable surface segment", function () {
    expect(buildStandardResponseFragments(buildInput({}))).toEqual([]);
    expect(
      buildStandardResponseFragments(buildInput({
        textSurfaceAnalysis: {
          segments: [
            {
              segmentId: "text_segment_1",
              verbatim: "???",
              category: "lack_comprehension"
            }
          ]
        }
      }))
    ).toEqual([]);
  });
});
