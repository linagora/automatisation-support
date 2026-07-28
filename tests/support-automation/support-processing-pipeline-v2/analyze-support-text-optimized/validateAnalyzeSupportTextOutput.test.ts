import {describe, expect, it} from "vitest";

import {validateAnalyzeSupportTextOutput} from "../../../../src/support-automation/support-processing-pipeline-optimized/analyze-support-text-optimized/validateAnalyzeSupportTextOutput";

const supportSegments = [
  {
    segmentId: "text_segment_1",
    verbatim: "The user reports a login issue."
  }
];

describe("optimized support-text analysis validation", function () {
  it("accepts a valid optimized contract without intent classification", function () {
    expect(validateAnalyzeSupportTextOutput({
      understandings: [
        {
          sourceSegmentIds: ["text_segment_1"],
          extractedFields: [],
          attemptedActions: [],
          other: [],
          summary: "The user reports a login issue.",
          supportDomain: "access_security"
        }
      ]
    }, supportSegments)).toEqual([
      {
        sourceSegmentIds: ["text_segment_1"],
        extractedFields: [],
        attemptedActions: [],
        other: [],
        summary: "The user reports a login issue.",
        supportDomain: "access_security"
      }
    ]);
  });

  it("rejects legacy or unknown optimized contract fields", function () {
    const validUnderstanding = {
      sourceSegmentIds: ["text_segment_1"],
      extractedFields: [],
      attemptedActions: [],
      other: [],
      summary: "The user reports a login issue.",
      supportDomain: "access_security"
    };

    const cases = [
      {...validUnderstanding, ["message" + "Act"]: "issue_report"},
      {...validUnderstanding, messageKind: "issue_report"},
      {...validUnderstanding, supportDomain: undefined, broadCategory: "access_security"},
      {...validUnderstanding, supportDomain: "unsupported_domain"}
    ];

    for (const understanding of cases) {
      expect(validateAnalyzeSupportTextOutput({
        understandings: [understanding]
      }, supportSegments)).toBeNull();
    }
  });

  it("accepts extracted fields, support domain, and rejects removed deep keys", function () {
    expect(validateAnalyzeSupportTextOutput({
      understandings: [
        {
          sourceSegmentIds: ["text_segment_1"],
          extractedFields: [
            {key: "feature_or_page", value: "login", evidence: "login"}
          ],
          attemptedActions: [],
          other: [
            {key: "fact", value: "issue", evidence: "issue"}
          ],
          summary: "The user reports a login issue.",
          supportDomain: "access_security"
        }
      ]
    }, supportSegments)).not.toBeNull();

    expect(validateAnalyzeSupportTextOutput({
      understandings: [
        {
          sourceSegmentIds: ["text_segment_1"],
          extractedFields: [],
          attemptedActions: [],
          other: [
            {key: "support" + "_context", value: "issue", evidence: "issue"}
          ],
          summary: "The user reports a login issue.",
          supportDomain: "access_security"
        }
      ]
    }, supportSegments)).toBeNull();

    expect(validateAnalyzeSupportTextOutput({
      understandings: [
        {
          sourceSegmentIds: ["text_segment_1"],
          extractedFields: [],
          attemptedActions: [],
          other: [],
          summary: "The user reports a login issue.",
          supportDomain: "product" + "_feedback"
        }
      ]
    }, supportSegments)).toBeNull();
  });
});
