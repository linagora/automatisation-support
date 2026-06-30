import { describe, expect, it } from "vitest";

import {
  buildComposeSupportResponsePlanPrompt
} from "../../../src/support-processing-pipeline-v2/compose-support-response-plan/buildComposeSupportResponsePlanPrompt";
import {
  formatComposeSupportResponsePlanOutput
} from "../../../src/support-processing-pipeline-v2/compose-support-response-plan/formatComposeSupportResponsePlanOutput";

import type {
  ComposeSupportResponsePlanInput,
  ResponsePlanV2,
  StandardResponseFragment
} from "../../../src/support-processing-pipeline-v2/typesSupportProcessingPipelineV2.types";

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
  const forbid = params.forbid ?? [];

  return {
    responsePlanId: params.id,
    topicId: params.id,
    acknowledge: [],
    answer: [],
    ask: fields.map((fieldName) => ({
      fieldName,
      goal: `Ask for ${fieldName}.`
    })),
    say: [
      params.prompt ??
        [
          "Acknowledge the topic.",
          ...(fields.length > 0
            ? [`Ask for ${fields.join(", ")}.`]
            : []),
          ...forbid
        ].join(" ")
    ],
    review: null
  };
}

function input(
  params: Partial<ComposeSupportResponsePlanInput> = {}
): ComposeSupportResponsePlanInput {
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

function expectNoLegacyComposerFields(composed: unknown): void {
  expect(composed).not.toHaveProperty("sections");
  expect(composed).not.toHaveProperty("globalTone");
  expect(composed).not.toHaveProperty("globalQuestions");
  expect(composed).not.toHaveProperty("globalForbid");
  expect(composed).not.toHaveProperty("rendererInstructions");
  expect(composed).not.toHaveProperty("targetLanguage");
  expect(composed).not.toHaveProperty("channel");
}

describe("composeSupportResponsePlan", function () {
  it("builds a prompt for the new global say-only contract", function () {
    const prompt = buildComposeSupportResponsePlanPrompt(input({
      standardResponseFragments: [greetingFragment],
      topicResponsePlans: [plan({ id: "plan_login" })]
    }));
    const content = prompt.messages.map((message) => message.content).join("\n");

    expect(content).toContain("global response plan synthesizer");
    expect(content).toContain("standardResponseFragments");
    expect(content).toContain("topicResponsePlans");
    expect(content).toContain("This is the only field consumed downstream by the renderer");
    expect(content).toContain("Do not output targetLanguage or channel");
  });

  it("sanitizes unusable topic response plans before prompt serialization", function () {
    const prompt = buildComposeSupportResponsePlanPrompt(input({
      topicResponsePlans: [
        undefined as unknown as ResponsePlanV2,
        {
          topicId: "empty_say",
          acknowledge: [],
          answer: [],
          ask: [],
          say: [],
          review: null
        } as ResponsePlanV2,
        plan({
          id: "usable_plan",
          prompt: "Use this usable topic instruction."
        })
      ]
    }));
    const content = prompt.messages.map((message) => message.content).join("\n");

    expect(content).toContain("Use this usable topic instruction.");
    expect(content).not.toContain("empty_say");
  });

  it("formats a valid new composed plan", function () {
    const output = formatComposeSupportResponsePlanOutput({
      input: input({
        standardResponseFragments: [greetingFragment],
        topicResponsePlans: [plan({ id: "plan_login" })]
      }),
      rawComposeSupportResponsePlan: {
        status: "completed",
        parsedResponse: {
          topicId: null,
          messageIntent: "mixed_reply",
          acknowledge: [
            "Acknowledge the greeting."
          ],
          answer: [
            {
              point: "Address the login topic.",
              support: "topic_plan"
            }
          ],
          ask: [
            {
              goal: "Ask what exact login error appears.",
              sourceTopicIds: ["plan_login"]
            }
          ],
          say: [
            "Start naturally, acknowledge the login issue, and ask what exact login error appears."
          ],
          review: null
        }
      }
    });
    const composed = output.composedSupportResponsePlan;

    expect(output.validation.status).toBe("valid");
    expect(composed).toMatchObject({
      topicId: null,
      messageIntent: "mixed_reply",
      acknowledge: ["Acknowledge the greeting."],
      answer: [
        {
          point: "Address the login topic.",
          support: "topic_plan"
        }
      ],
      ask: [
        {
          goal: "Ask what exact login error appears.",
          sourceTopicIds: ["plan_login"]
        }
      ],
      say: [
        "Start naturally, acknowledge the login issue, and ask what exact login error appears."
      ],
      review: null
    });
    expectNoLegacyComposerFields(composed);
  });

  it("falls back to a say-only standard reply", function () {
    const composed = fallbackPlan(input({
      standardResponseFragments: [greetingFragment]
    }));

    expect(composed.messageIntent).toBe("standard_reply");
    expect(composed.acknowledge).toEqual([
      "Standard interaction detected: greeting."
    ]);
    expect(composed.answer).toEqual([]);
    expect(composed.ask).toEqual([]);
    expect(composed.say[0]).toContain("Acknowledge the greeting naturally.");
    expect(composed.review).toBe("Composer fallback used: test_fallback");
    expectNoLegacyComposerFields(composed);
  });

  it("falls back to a say-only support reply with grouped ask metadata", function () {
    const composed = fallbackPlan(input({
      topicResponsePlans: [
        plan({ id: "plan_one", fields: ["platform"] }),
        plan({ id: "plan_two", fields: ["platform"] })
      ]
    }));

    expect(composed.messageIntent).toBe("support_reply");
    expect(composed.ask).toEqual([
      {
        goal: "Ask for platform.",
        sourceTopicIds: ["plan_one", "plan_two"]
      }
    ]);
    expect(composed.say[0]).toContain("Ask for platform.");
    expectNoLegacyComposerFields(composed);
  });

  it("keeps policy question limiting out of topic ask fields", function () {
    const composed = fallbackPlan(input({
      responsePlanningPolicy: {
        maxTotalQuestions: 1
      },
      topicResponsePlans: [
        plan({ id: "plan_one", fields: ["platform"] }),
        plan({ id: "plan_two", fields: ["error_message"] })
      ]
    }));

    expect(composed.ask).toEqual([
      {
        goal: "Ask for platform.",
        sourceTopicIds: ["plan_one"]
      },
      {
        goal: "Ask for error_message.",
        sourceTopicIds: ["plan_two"]
      }
    ]);
    expect(composed.say[0]).toContain("Ask for platform.");
    expect(composed.say[0]).toContain("Ask for error_message.");
    expectNoLegacyComposerFields(composed);
  });

  it("preserves safety limits inside say instead of global forbid", function () {
    const composed = fallbackPlan(input({
      topicResponsePlans: [
        plan({ id: "plan_one", forbid: ["No promise."] }),
        plan({ id: "plan_two", forbid: ["No promise.", "No refund."] })
      ]
    }));

    expect(composed.say[0]).toContain("No promise.");
    expect(composed.say[0]).toContain("No refund.");
    expectNoLegacyComposerFields(composed);
  });

  it("applies handover override without old sections", function () {
    const composed = fallbackPlan(input({
      standardResponseFragments: [handoverFragment],
      topicResponsePlans: [
        plan({ id: "plan_login", fields: ["error_message"] })
      ]
    }));

    expect(composed.messageIntent).toBe("handover_reply");
    expect(composed.say[0]).toContain(
      "Accept the request to speak with a human support person."
    );
    expectNoLegacyComposerFields(composed);
  });
});
