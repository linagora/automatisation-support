import {describe, expect, it} from "vitest";

import {assessTopicReadiness} from "../../../../src/support-automation/support-processing-pipeline-v2/assess-topic-readiness-optimized/assessTopicReadiness";

import type {AssessTopicReadinessInput} from "../../../../src/support-automation/support-processing-pipeline-v2/assess-topic-readiness-optimized/assessTopicReadiness";

describe("optimized topic readiness assessment", function () {
  it("detects absence of material fields", function () {
    const assessment = assessTopicReadiness(buildInput());

    expect(assessment.hasMaterialFields).toBe(false);
    expect(assessment.hasSearchableDetails).toBe(false);
    expect(assessment.hasAttemptedActions).toBe(false);
  });

  it("detects material fields without searchable details", function () {
    const assessment = assessTopicReadiness(buildInput({
      sourceUnderstandings: [
        buildUnderstanding({
          extractedFields: [
            {key: "user_identifier", value: "alice", evidence: "alice"}
          ]
        })
      ]
    }));

    expect(assessment.hasMaterialFields).toBe(true);
    expect(assessment.hasSearchableDetails).toBe(false);
  });

  it("detects searchable details from strong field keys", function () {
    const assessment = assessTopicReadiness(buildInput({
      sourceUnderstandings: [
        buildUnderstanding({
          extractedFields: [
            {key: "error_message", value: "SAML invalid audience", evidence: "SAML invalid audience"}
          ]
        })
      ]
    }));

    expect(assessment.hasMaterialFields).toBe(true);
    expect(assessment.hasSearchableDetails).toBe(true);
  });

  it("detects attempted actions", function () {
    const assessment = assessTopicReadiness(buildInput({
      sourceUnderstandings: [
        buildUnderstanding({
          attemptedActions: [
            {action: "Retried SSO login", outcome: "failed", evidence: "Retried SSO login"}
          ]
        })
      ]
    }));

    expect(assessment.hasAttemptedActions).toBe(true);
  });

  it("marks missing previous knowledge as absent", function () {
    const assessment = assessTopicReadiness(buildInput({
      previousSupportKnowledgeSummary: null
    }));

    expect(assessment.hasPreviousKnowledge).toBe(false);
    expect(assessment.previousKnowledgeLooksUseful).toBeNull();
    expect(assessment.previousKnowledgeLooksEmpty).toBeNull();
  });

  it("marks empty previous knowledge as present but not useful", function () {
    const assessment = assessTopicReadiness(buildInput({
      previousSupportKnowledgeSummary: "Retrieval did not provide specific useful information."
    }));

    expect(assessment.hasPreviousKnowledge).toBe(true);
    expect(assessment.previousKnowledgeLooksEmpty).toBe(true);
    expect(assessment.previousKnowledgeLooksUseful).toBe(false);
  });

  it("marks specific previous knowledge as useful", function () {
    const assessment = assessTopicReadiness(buildInput({
      previousSupportKnowledgeSummary: "A similar case was found with a known SSO configuration workaround."
    }));

    expect(assessment.hasPreviousKnowledge).toBe(true);
    expect(assessment.previousKnowledgeLooksEmpty).toBe(false);
    expect(assessment.previousKnowledgeLooksUseful).toBe(true);
  });
});

function buildInput(overrides: Partial<AssessTopicReadinessInput> = {}): AssessTopicReadinessInput {
  return {
    supportNeedAssessment: {
      supportNeed: "issue_resolution",
      unclearReason: null,
      reason: "The topic is a concrete issue to resolve."
    },
    supportDomain: "access_security",
    sourceUnderstandings: [buildUnderstanding()],
    previousSupportKnowledgeSummary: null,
    ...overrides
  };
}

function buildUnderstanding(overrides = {}) {
  return {
    understandingId: "text_understanding_1",
    sourceSegmentIds: ["text_segment_1"],
    messageAct: "issue_report",
    extractedFields: [],
    attemptedActions: [],
    other: [],
    summary: "The user reports a login issue.",
    supportDomain: "access_security",
    ...overrides
  };
}
