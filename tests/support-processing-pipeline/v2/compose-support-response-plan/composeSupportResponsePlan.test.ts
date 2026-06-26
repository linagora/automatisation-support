import { describe, expect, it } from "vitest";

import {
  buildComposeSupportResponsePlanPrompt
} from "../../../../src/support-processing-pipeline/v2/compose-support-response-plan/buildComposeSupportResponsePlanPrompt";
import {
  formatComposeSupportResponsePlanOutput
} from "../../../../src/support-processing-pipeline/v2/compose-support-response-plan/formatComposeSupportResponsePlanOutput";

import type {
  ComposeSupportResponsePlanInput,
  ResponsePlanV2,
  StandardResponseFragment
} from "../../../../src/support-processing-pipeline/v2/typesSupportProcessingPipelineV2.types";

const greetingFragment: StandardResponseFragment = {
  category: "standard_interaction",
  standardSubcategory: "greeting",
  content: "Acknowledge the greeting naturally."
};

const handoverFragment: StandardResponseFragment = {
  category: "standard_interaction",
  standardSubcategory: "handover_request",
  content: "Accept the request to speak with a human support person."
};

function plan(params: {
  id: string;
  prompt?: string;
  fields?: string[];
  forbid?: string[];
}): ResponsePlanV2 {
  const fields = params.fields ?? [];

  return {
    responsePlanId: params.id,
    knowledgeGate: {
      knowledgeMode: "rag_not_enabled",
      solutionAllowed: false,
      allowedMoves: ["acknowledge"],
      reason: "test"
    },
    questionDecision: {
      shouldAskQuestion: fields.length > 0,
      plannedQuestionCount: fields.length,
      fieldNames: fields,
      questionInstruction: fields.length
        ? `Ask for ${fields.join(", ")}.`
        : null,
      reason: "test"
    },
    rendererTask: {
      targetLanguage: "fr",
      prompt: params.prompt ?? "Acknowledge the topic.",
      questionFieldNames: fields,
      forbiddenClaims: params.forbid ?? []
    },
    internalRationale: "test"
  };
}

function input(params: Partial<ComposeSupportResponsePlanInput> = {}): ComposeSupportResponsePlanInput {
  return {
    standardResponseFragments: [],
    topicResponsePlans: [],
    supportResponseCues: [],
    targetLanguage: "fr",
    channel: "email",
    recentInteractionContext: {},
    ...params
  };
}

function fallbackPlan(inputValue: ComposeSupportResponsePlanInput) {
  return formatComposeSupportResponsePlanOutput({
    input: inputValue,
    rawComposeSupportResponsePlan: {
      status: "failed",
      error: {
        message: "test_fallback"
      }
    }
  }).composedSupportResponsePlan;
}

describe("composeSupportResponsePlan", function () {
  it("builds a prompt for standard fragments only", function () {
    const prompt = buildComposeSupportResponsePlanPrompt(input({
      standardResponseFragments: [greetingFragment]
    }));
    const content = prompt.messages.map((message) => message.content).join("\n");

    expect(content).toContain("global support response composer");
    expect(content).toContain("Acknowledge the greeting naturally.");
    expect(content).toContain("standardResponseFragments");
  });

  it("composes standard fragments only in fallback", function () {
    const composed = fallbackPlan(input({
      standardResponseFragments: [greetingFragment]
    }));

    expect(composed.messageIntent).toBe("standard_reply");
    expect(composed.sections).toHaveLength(1);
    expect(composed.sections[0]?.kind).toBe("standard_fragment");
  });

  it("composes a single topic", function () {
    const composed = fallbackPlan(input({
      topicResponsePlans: [
        plan({
          id: "plan_login",
          fields: ["error_message"]
        })
      ]
    }));

    expect(composed.messageIntent).toBe("support_reply");
    expect(composed.sections[0]).toMatchObject({
      kind: "topic",
      topicId: "plan_login"
    });
    expect(composed.globalQuestions).toEqual([
      {
        fieldName: "error_message",
        goal: "Ask for error_message.",
        sourceTopicIds: ["plan_login"]
      }
    ]);
  });

  it("composes multiple topics", function () {
    const composed = fallbackPlan(input({
      topicResponsePlans: [
        plan({ id: "plan_drive" }),
        plan({ id: "plan_mail" })
      ]
    }));

    expect(composed.sections.map((section) => section.topicId)).toEqual([
      "plan_drive",
      "plan_mail"
    ]);
  });

  it("composes mixed standard fragments and topics", function () {
    const composed = fallbackPlan(input({
      standardResponseFragments: [greetingFragment],
      topicResponsePlans: [plan({ id: "plan_login" })]
    }));

    expect(composed.messageIntent).toBe("mixed_reply");
    expect(composed.sections.map((section) => section.kind)).toEqual([
      "standard_fragment",
      "topic"
    ]);
  });

  it("merges redundant questions", function () {
    const composed = fallbackPlan(input({
      topicResponsePlans: [
        plan({ id: "plan_one", fields: ["platform"] }),
        plan({ id: "plan_two", fields: ["platform"] })
      ]
    }));

    expect(composed.globalQuestions).toEqual([
      {
        fieldName: "platform",
        goal: "Ask for platform.",
        sourceTopicIds: ["plan_one", "plan_two"]
      }
    ]);
  });

  it("limits the total number of questions from policy", function () {
    const composed = fallbackPlan(input({
      responsePlanningPolicy: {
        maxTotalQuestions: 1
      },
      topicResponsePlans: [
        plan({ id: "plan_one", fields: ["platform"] }),
        plan({ id: "plan_two", fields: ["error_message"] })
      ]
    }));

    expect(composed.globalQuestions).toHaveLength(1);
    expect(composed.sections.flatMap((section) => section.ask)).toHaveLength(1);
  });

  it("consolidates forbidden claims", function () {
    const composed = fallbackPlan(input({
      topicResponsePlans: [
        plan({ id: "plan_one", forbid: ["No promise."] }),
        plan({ id: "plan_two", forbid: ["No promise.", "No refund."] })
      ]
    }));

    expect(composed.globalForbid).toEqual([
      "No promise.",
      "No refund."
    ]);
  });

  it("applies handover override", function () {
    const composed = fallbackPlan(input({
      standardResponseFragments: [handoverFragment],
      topicResponsePlans: [
        plan({ id: "plan_login", fields: ["error_message"] })
      ]
    }));

    expect(composed.messageIntent).toBe("handover_reply");
    expect(composed.globalQuestions).toEqual([]);
    expect(composed.sections.flatMap((section) => section.ask)).toEqual([]);
  });
});
