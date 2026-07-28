import {describe, expect, it} from "vitest";

import {validateProposeTopicUpdatesOutput} from "../../../../src/support-automation/support-processing-pipeline-optimized/propose-topic-updates-optimized/validateProposeTopicUpdatesOutput";

import type {AnalyzeSupportTextUnderstanding} from "../../../../src/support-automation/support-processing-pipeline-optimized/analyze-support-text-optimized/runAnalyzeSupportText";

const understandings: AnalyzeSupportTextUnderstanding[] = [
  {
    understandingId: "text_understanding_1",
    sourceSegmentIds: ["text_segment_1"],
    caseDetailsExtracted: [],
    attemptedActionsExtracted: [],
    other: [],
    summary: "The user reports a login issue.",
    supportDomain: "access_security"
  }
];

describe("optimized topic-update proposal validation", function () {
  it("accepts create plans with topicIdentity.supportDomain", function () {
    const output = {
      topicUpdatePlans: [
        {
          operation: "create",
          sourceUnderstandingIds: ["text_understanding_1"],
          targetTopicId: null,
          topicIdentity: {
            title: "Login issue",
            supportDomain: "access_security",
            summary: "The user reports a login issue."
          }
        }
      ]
    };

    expect(validateProposeTopicUpdatesOutput(output, {
      existingTopics: [],
      understandings
    })).toEqual(output.topicUpdatePlans);
  });

  it("rejects create plans without a valid supportDomain", function () {
    const validPlan = {
      operation: "create",
      sourceUnderstandingIds: ["text_understanding_1"],
      targetTopicId: null,
      topicIdentity: {
        title: "Login issue",
        supportDomain: "access_security",
        summary: "The user reports a login issue."
      }
    };

    const cases = [
      {...validPlan, topicIdentity: {...validPlan.topicIdentity, supportDomain: null}},
      {...validPlan, topicIdentity: {...validPlan.topicIdentity, supportDomain: "unsupported_domain"}},
      {...validPlan, topicIdentity: {...validPlan.topicIdentity, broadCategory: "access_security"}},
      {...validPlan, topicIdentity: {title: "Login issue", summary: "The user reports a login issue."}}
    ];

    for (const plan of cases) {
      expect(validateProposeTopicUpdatesOutput({
        topicUpdatePlans: [plan]
      }, {
        existingTopics: [],
        understandings
      })).toBeNull();
    }
  });

  it("can create and update topics from summary and extracted fields without intent classification", function () {
    const sourceUnderstandings: AnalyzeSupportTextUnderstanding[] = [
      {
        understandingId: "text_understanding_1",
        sourceSegmentIds: ["text_segment_1"],
        caseDetailsExtracted: [
          {key: "feature_or_page", value: "login", evidence: "login"}
        ],
        attemptedActionsExtracted: [],
        other: [],
        summary: "The user reports a login issue.",
        supportDomain: "access_security"
      },
      {
        understandingId: "text_understanding_2",
        sourceSegmentIds: ["text_segment_2"],
        caseDetailsExtracted: [
          {key: "error_message", value: "SAML invalid audience", evidence: "SAML invalid audience"}
        ],
        attemptedActionsExtracted: [],
        other: [],
        summary: "The login issue shows a SAML invalid audience error.",
        supportDomain: "access_security"
      }
    ];

    const output = {
      topicUpdatePlans: [
        {
          operation: "update",
          sourceUnderstandingIds: ["text_understanding_1"],
          targetTopicId: 1,
          topicIdentity: {
            title: null,
            supportDomain: null,
            summary: "The user reports a login issue."
          }
        },
        {
          operation: "create",
          sourceUnderstandingIds: ["text_understanding_2"],
          targetTopicId: null,
          topicIdentity: {
            title: "SAML login error",
            supportDomain: "access_security",
            summary: "The login issue shows a SAML invalid audience error."
          }
        }
      ]
    };

    expect(validateProposeTopicUpdatesOutput(output, {
      existingTopics: [{topicId: 1, title: "Login issue"}],
      understandings: sourceUnderstandings
    })).toEqual(output.topicUpdatePlans);
  });
});
