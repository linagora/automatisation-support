import {describe, expect, it} from "vitest";

import {deriveSupportRouting} from "../../../../src/support-automation/support-processing-pipeline-optimized/derive-support-routing-optimized/deriveSupportRouting";

import type {DeriveSupportRoutingInput} from "../../../../src/support-automation/support-processing-pipeline-optimized/derive-support-routing-optimized/deriveSupportRouting";

describe("optimized support routing derivation", function () {
  it("runs catalogue clarification and skips search when support need is unclear", function () {
    const routing = deriveSupportRouting(buildInput({
      supportNeedAssessment: {
        supportNeed: "unclear",
        unclearReason: "too_ambiguous",
        reason: "The topic is ambiguous."
      }
    }));

    expect(routing.catalogueRouting.shouldRun).toBe(true);
    expect(routing.catalogueRouting.mode).toBe("need_clarification");
    expect(routing.similarTopicSearchRouting.shouldSearch).toBe(false);
  });

  it.each([null, "other"])("runs domain clarification and skips search when support domain is %s", function (supportDomain) {
    const routing = deriveSupportRouting(buildInput({supportDomain}));

    expect(routing.catalogueRouting.shouldRun).toBe(true);
    expect(routing.catalogueRouting.mode).toBe("domain_clarification");
    expect(routing.similarTopicSearchRouting.shouldSearch).toBe(false);
  });

  it("skips search and runs focused qualification when material fields are missing", function () {
    const routing = deriveSupportRouting(buildInput({
      topicReadinessAssessment: buildReadiness({hasMaterialFields: false})
    }));

    expect(routing.similarTopicSearchRouting.shouldSearch).toBe(false);
    expect(routing.catalogueRouting.shouldRun).toBe(true);
    expect(routing.catalogueRouting.mode).toBe("focused_qualification");
  });

  it.each([false, null])("searches when details are searchable and previous knowledge useful is %s", function (previousKnowledgeLooksUseful) {
    const routing = deriveSupportRouting(buildInput({
      topicReadinessAssessment: buildReadiness({
        hasSearchableDetails: true,
        previousKnowledgeLooksUseful
      })
    }));

    expect(routing.similarTopicSearchRouting.shouldSearch).toBe(true);
  });

  it("does not search when previous knowledge already looks useful", function () {
    const routing = deriveSupportRouting(buildInput({
      topicReadinessAssessment: buildReadiness({
        hasSearchableDetails: true,
        previousKnowledgeLooksUseful: true
      })
    }));

    expect(routing.similarTopicSearchRouting.shouldSearch).toBe(false);
  });

  it("searches for knowledge answers with material searchable details and no useful previous knowledge", function () {
    const routing = deriveSupportRouting(buildInput({
      supportNeedAssessment: {
        supportNeed: "knowledge_answer",
        unclearReason: null,
        reason: "The topic asks for support knowledge."
      },
      topicReadinessAssessment: buildReadiness({
        hasSearchableDetails: true,
        previousKnowledgeLooksUseful: null
      })
    }));

    expect(routing.similarTopicSearchRouting.shouldSearch).toBe(true);
  });

  it("skips search by default for feature requests", function () {
    const routing = deriveSupportRouting(buildInput({
      supportNeedAssessment: {
        supportNeed: "feature_request",
        unclearReason: null,
        reason: "The topic is not a resolution search case."
      }
    }));

    expect(routing.similarTopicSearchRouting.shouldSearch).toBe(false);
    expect(routing.catalogueRouting.shouldRun).toBe(false);
    expect(routing.catalogueRouting.mode).toBe("skip");
  });
});

function buildInput(overrides: Partial<DeriveSupportRoutingInput> = {}): DeriveSupportRoutingInput {
  return {
    supportNeedAssessment: {
      supportNeed: "issue_resolution",
      unclearReason: null,
      reason: "The topic is a concrete issue to resolve."
    },
    topicReadinessAssessment: buildReadiness(),
    supportDomain: "access_security",
    ...overrides
  };
}

function buildReadiness(overrides = {}) {
  return {
    hasMaterialFields: true,
    hasSearchableDetails: false,
    hasAttemptedActions: false,
    hasPreviousKnowledge: false,
    previousKnowledgeLooksUseful: null,
    previousKnowledgeLooksEmpty: null,
    reasonCodes: [],
    ...overrides
  };
}
