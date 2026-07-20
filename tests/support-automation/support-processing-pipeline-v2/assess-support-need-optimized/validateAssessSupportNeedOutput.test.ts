import {describe, expect, it, vi} from "vitest";

import {buildAssessSupportNeedPrompt} from "../../../../src/support-automation/support-processing-pipeline-optimized/assess-support-need-optimized/buildAssessSupportNeedPrompt";
import {runAssessSupportNeed} from "../../../../src/support-automation/support-processing-pipeline-optimized/assess-support-need-optimized/runAssessSupportNeed";
import {validateAssessSupportNeedOutput} from "../../../../src/support-automation/support-processing-pipeline-optimized/assess-support-need-optimized/validateAssessSupportNeedOutput";
import {outputContractForPrompt} from "../../../../src/support-automation/support-processing-pipeline-optimized/assess-support-need-optimized/responseFormat";

import type {AssessSupportNeedInput} from "../../../../src/support-automation/support-processing-pipeline-optimized/assess-support-need-optimized/runAssessSupportNeed";

const callLLMMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../src/support-automation/infrastructure/llm/llm-client", () => ({
  callLLM: callLLMMock
}));

describe("optimized support-need assessment validation", function () {
  it("accepts valid support-need assessments", function () {
    const cases = [
      {
        supportNeed: "issue_resolution",
        unclearReason: null,
        reason: "The topic is a concrete issue to resolve."
      },
      {
        supportNeed: "knowledge_answer",
        unclearReason: null,
        reason: "The topic asks for support knowledge."
      },
      {
        supportNeed: "support_action",
        unclearReason: null,
        reason: "The topic asks support to perform an action."
      },
      {
        supportNeed: "feature_request",
        unclearReason: null,
        reason: "The topic requests a missing product capability."
      },
      {
        supportNeed: "product_feedback",
        unclearReason: null,
        reason: "The topic expresses subjective product feedback."
      },
      {
        supportNeed: "unclear",
        unclearReason: "knowledge_answer_or_issue_resolution",
        reason: "The topic may be either a how-to question or a malfunction."
      }
    ];

    for (const supportNeedAssessment of cases) {
      expect(validateAssessSupportNeedOutput({supportNeedAssessment})).toEqual(supportNeedAssessment);
    }
  });

  it("rejects invalid support-need assessments", function () {
    const validAssessment = {
      supportNeed: "issue_resolution",
      unclearReason: null,
      reason: "The topic is a concrete issue to resolve."
    };

    const cases = [
      {supportNeedAssessment: {...validAssessment, supportNeed: "unknown_need"}},
      {supportNeedAssessment: {supportNeed: "unclear", unclearReason: "unknown_reason", reason: "Ambiguous."}},
      {supportNeedAssessment: {...validAssessment, reason: ""}},
      {supportNeedAssessment: {...validAssessment, unclearReason: "too_ambiguous"}},
      {supportNeedAssessment: {supportNeed: "unclear", unclearReason: null, reason: "Ambiguous."}},
      {supportNeedAssessment: validAssessment, extra: true},
      {}
    ];

    for (const value of cases) {
      expect(validateAssessSupportNeedOutput(value)).toBeNull();
    }
  });
});

describe("optimized support-need assessment runner fallback", function () {
  it("returns the safe unclear fallback when the LLM call fails", async function () {
    callLLMMock.mockResolvedValueOnce({success: false});

    await expect(runAssessSupportNeed(buildInput())).resolves.toEqual({
      status: "fallback",
      fallbackReason: "llm_call_failed",
      supportNeedAssessment: null
    });
  });
});

describe("optimized support-need assessment prompt contract", function () {
  it("describes a valid JSON shape and lists accepted values outside JSON", function () {
    expect(outputContractForPrompt).toContain('"supportNeed": "<accepted_support_need>"');
    expect(outputContractForPrompt).toContain('"unclearReason": null');
    expect(outputContractForPrompt).toContain('"reason": "<short_grounded_reason>"');
    expect(outputContractForPrompt).toContain("Accepted supportNeed values:");
    expect(outputContractForPrompt).toContain('- "issue_resolution"');
    expect(outputContractForPrompt).toContain("Accepted unclearReason values, only when supportNeed is \"unclear\":");
    expect(outputContractForPrompt).toContain('- "knowledge_answer_or_issue_resolution"');
    expect(outputContractForPrompt).toContain("unclearReason must be null");
    expect(outputContractForPrompt).toContain("must not mention retrieval, catalogue routing, response planning, or memory updates");
    expect(outputContractForPrompt).not.toContain("one of");
    expect(outputContractForPrompt).not.toContain("null unless");
    expect(outputContractForPrompt).not.toContain("login problem");
  });

  it("keeps the displayed JSON shape parseable", function () {
    const jsonShape = outputContractForPrompt.slice(
      outputContractForPrompt.indexOf("{"),
      outputContractForPrompt.indexOf("\n\nAccepted supportNeed values:")
    );

    expect(JSON.parse(jsonShape)).toEqual({
      supportNeedAssessment: {
        supportNeed: "<accepted_support_need>",
        unclearReason: null,
        reason: "<short_grounded_reason>"
      }
    });
  });

  it("renders prompt inputs as pretty JSON and repeats strict unclearReason rules", function () {
    const {messages} = buildAssessSupportNeedPrompt(buildInput());
    const systemPrompt = messages.find((message) => message.role === "system")?.content ?? "";
    const userPrompt = messages.find((message) => message.role === "user")?.content ?? "";

    expect(systemPrompt).toContain("If supportNeed is not \"unclear\", unclearReason must be null.");
    expect(systemPrompt).toContain("If supportNeed is \"unclear\", unclearReason must be non-null");
    expect(systemPrompt).toContain("reason must be short, grounded in the topic and latest source understandings");
    expect(systemPrompt).toContain("must not mention retrieval, catalogue routing, response planning, or memory updates");
    expect(userPrompt).toContain('\n  "topicId": null,');
    expect(userPrompt).toContain('\n  "previousSupportNeedAssessment": null,');
    expect(userPrompt).toContain("topic.previousSupportNeedAssessment is the previous global support need assessment");
  });
});

function buildInput(): AssessSupportNeedInput {
  return {
    topic: {
      topicId: null,
      title: "Login issue",
      supportDomain: "access_security",
      summary: "The user reports a login issue.",
      previousSupportNeedAssessment: null,
      previousSupportKnowledgeSummary: null,
      sourceUnderstandings: [
        {
          understandingId: "text_understanding_1",
          sourceSegmentIds: ["text_segment_1"],
          messageAct: "issue_report",
          extractedFields: [],
          attemptedActions: [],
          other: [],
          summary: "The user reports a login issue.",
          supportDomain: "access_security"
        }
      ]
    },
    recentInteractionContext: {}
  };
}
