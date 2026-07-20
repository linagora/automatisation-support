import {describe, expect, it} from "vitest";

import {validateAnalyzeSupportTextOutput} from "../../../../src/support-automation/support-processing-pipeline-optimized/analyze-support-text-optimized/validateAnalyzeSupportTextOutput";

const supportSegments = [
  {
    segmentId: "text_segment_1",
    verbatim: "The user reports a login issue."
  }
];

describe("optimized support-text analysis validation", function () {
  it("accepts messageAct and supportDomain in the optimized contract", function () {
    expect(validateAnalyzeSupportTextOutput({
      understandings: [
        {
          sourceSegmentIds: ["text_segment_1"],
          messageAct: "issue_report",
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
        messageAct: "issue_report",
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
      messageAct: "issue_report",
      extractedFields: [],
      attemptedActions: [],
      other: [],
      summary: "The user reports a login issue.",
      supportDomain: "access_security"
    };

    const cases = [
      {...validUnderstanding, messageAct: undefined, messageKind: "issue_report"},
      {...validUnderstanding, supportDomain: undefined, broadCategory: "access_security"},
      {...validUnderstanding, messageAct: "unsupported_act"},
      {...validUnderstanding, supportDomain: "unsupported_domain"}
    ];

    for (const understanding of cases) {
      expect(validateAnalyzeSupportTextOutput({
        understandings: [understanding]
      }, supportSegments)).toBeNull();
    }
  });
});
