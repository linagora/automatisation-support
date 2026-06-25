import { describe, expect, it } from "vitest";

import {
  buildRenderSupportResponsePrompt
} from "../../../../src/support-processing-pipeline/v2/response-renderer/buildRenderSupportResponsePrompt";
import {
  formatRenderSupportResponseOutput
} from "../../../../src/support-processing-pipeline/v2/response-renderer/formatRenderSupportResponseOutput";

import type {
  SupportResponsePlan
} from "../../../../src/support-processing-pipeline/v2/plan-support-response/typesPlanSupportResponse.types";
import type {
  RenderSupportResponseInput
} from "../../../../src/support-processing-pipeline/v2/response-renderer/typesRenderSupportResponse.types";

const rawGreetingInstruction =
  "Acknowledge the greeting naturally. Briefly introduce the assistant as the support assistant. Invite the user to explain what they need help with.";

const greetingFragment = {
  category: "standard_interaction",
  standardSubcategory: "greeting",
  sourceSegmentId: "text_segment_1",
  sourceVerbatim: "Bonjour",
  content: rawGreetingInstruction
};

function buildPlan(params: {
  id: string;
  prompt: string;
  fieldNames?: string[];
}): SupportResponsePlan {
  const fieldNames = params.fieldNames ?? [];

  return {
    responsePlanId: params.id,
    knowledgeGate: {
      knowledgeMode: "rag_not_enabled",
      solutionAllowed: false,
      allowedMoves: ["acknowledge"],
      reason: "No support knowledge."
    },
    questionDecision: {
      shouldAskQuestion: fieldNames.length > 0,
      plannedQuestionCount: fieldNames.length,
      fieldNames,
      questionInstruction: fieldNames.length > 0
        ? `Ask for ${fieldNames.join(", ")}.`
        : null,
      reason: "Test plan."
    },
    rendererTask: {
      targetLanguage: "French",
      prompt: params.prompt,
      questionFieldNames: fieldNames,
      forbiddenClaims: ["No unsupported promise."]
    },
    internalRationale: "Test."
  };
}

function buildInput(params: {
  standard?: boolean;
  plans?: SupportResponsePlan[];
} = {}): RenderSupportResponseInput {
  return {
    latestUserMessageContent: "Bonjour, j’ai deux problèmes.",
    standardResponseFragments: params.standard ? [greetingFragment] : [],
    topicResponsePlans: params.plans ?? [],
    channel: "matrix"
  };
}

function serializePrompt(input: RenderSupportResponseInput): string {
  return buildRenderSupportResponsePrompt(input).messages
    .map((message) => message.content)
    .join("\n");
}

describe("renderSupportResponse", function () {
  it("builds a proactive standard_only task without copying raw instructions", function () {
    const serializedPrompt = serializePrompt(buildInput({
      standard: true
    }));

    expect(serializedPrompt).toContain("# Rendering route\nstandard_only");
    expect(serializedPrompt).toContain('"sourceVerbatim": "Bonjour"');
    expect(serializedPrompt).toContain(rawGreetingInstruction);
    expect(serializedPrompt).toContain(
      "Treat standardFragmentInstructions[].instruction as guidance, never as final text to copy."
    );
    expect(serializedPrompt).toContain(
      "If the instructions invite the user to explain their need, ask one simple open question."
    );
  });

  it("builds support_single and preserves its planned question", function () {
    const plan = buildPlan({
      id: "plan_billing",
      prompt: "Acknowledge the invoice issue and ask only for the invoice period.",
      fieldNames: ["billing_date_or_period"]
    });
    const serializedPrompt = serializePrompt(buildInput({
      plans: [plan]
    }));

    expect(serializedPrompt).toContain("# Rendering route\nsupport_single");
    expect(serializedPrompt).toContain('"responsePlanId": "plan_billing"');
    expect(serializedPrompt).toContain('"billing_date_or_period"');
    expect(serializedPrompt).toContain("Do not remove planned questions.");
    expect(serializedPrompt).toContain(
      "Do not add any question that is not explicitly planned"
    );
  });

  it("receives only safe plan instructions for Android notification knowledge", function () {
    const plan = buildPlan({
      id: "plan_android_notifications",
      prompt:
        "Explain the expected notification behavior and ask whether Android notification permission is enabled.",
      fieldNames: ["notification_permission_status"]
    });
    plan.knowledgeGate = {
      knowledgeMode: "knowledge_available",
      solutionAllowed: true,
      allowedMoves: ["answer_with_knowledge", "ask_missing_fields"],
      reason: "Mock knowledge supports this limited answer."
    };
    plan.rendererTask.forbiddenClaims = [
      "Do not say that the issue is fixed.",
      "Do not promise a resolution timeline.",
      "Do not claim that a support team is already investigating."
    ];
    const serializedPrompt = serializePrompt(buildInput({
      plans: [plan]
    }));

    expect(serializedPrompt).toContain(
      "ask whether Android notification permission is enabled"
    );
    expect(serializedPrompt).toContain(
      "Do not say that the issue is fixed."
    );
    expect(serializedPrompt).toContain(
      "Do not promise a resolution timeline."
    );
    expect(serializedPrompt).not.toContain(
      "Some Android users report that they do not receive push notifications"
    );
  });

  it("builds support_multi with every plan and deduplication guidance", function () {
    const serializedPrompt = serializePrompt(buildInput({
      plans: [
        buildPlan({
          id: "plan_drive",
          prompt: "Acknowledge the drive issue and ask for the affected platform.",
          fieldNames: ["environment"]
        }),
        buildPlan({
          id: "plan_mail",
          prompt: "Acknowledge the mail issue and ask for the exact error.",
          fieldNames: ["error_message"]
        })
      ]
    }));

    expect(serializedPrompt).toContain("# Rendering route\nsupport_multi");
    expect(serializedPrompt).toContain('"responsePlanId": "plan_drive"');
    expect(serializedPrompt).toContain('"responsePlanId": "plan_mail"');
    expect(serializedPrompt).toContain(
      "If two plans ask the same or nearly the same question, ask it once naturally."
    );
    expect(serializedPrompt).toContain(
      "If two plans ask for different information, keep both requests."
    );
  });

  it("builds mixed_single with a standard opening and strict support substance", function () {
    const serializedPrompt = serializePrompt(buildInput({
      standard: true,
      plans: [
        buildPlan({
          id: "plan_access",
          prompt: "Acknowledge the access issue without asking a question."
        })
      ]
    }));

    expect(serializedPrompt).toContain("# Rendering route\nmixed_single");
    expect(serializedPrompt).toContain("# Standard rendering instructions");
    expect(serializedPrompt).toContain('"responsePlanId": "plan_access"');
    expect(serializedPrompt).toContain(
      "The support plan controls the support substance."
    );
  });

  it("builds mixed_multi without exposing deep pipeline data", function () {
    const serializedPrompt = serializePrompt(buildInput({
      standard: true,
      plans: [
        buildPlan({
          id: "plan_one",
          prompt: "Render topic one."
        }),
        buildPlan({
          id: "plan_two",
          prompt: "Render topic two."
        })
      ]
    }));

    expect(serializedPrompt).toContain("# Rendering route\nmixed_multi");
    expect(serializedPrompt).toContain('"responsePlanId": "plan_one"');
    expect(serializedPrompt).toContain('"responsePlanId": "plan_two"');
    expect(serializedPrompt).not.toContain("Text surface analysis");
    expect(serializedPrompt).not.toContain("Support response cues");
    expect(serializedPrompt).not.toContain("retrievedSupportKnowledge");
    expect(serializedPrompt).not.toContain("recentInteractionContext");
  });

  it("does not expose raw standard instructions through formatter fallback", function () {
    const output = formatRenderSupportResponseOutput({
      input: buildInput({
        standard: true
      }),
      rawRenderSupportResponse: {
        status: "failed",
        error: {
          message: "llm unavailable"
        }
      }
    });

    expect(output.validation.status).toBe("fallback");
    expect(output.renderedResponse.finalResponseText).toBe(
      "Bonjour, je suis l’assistant du support. Comment puis-je vous aider ?"
    );
    expect(output.renderedResponse.finalResponseText).not.toContain(
      rawGreetingInstruction
    );
  });

  it.each([
    {
      standardSubcategory: "support_process_question",
      sourceVerbatim: "Quand est-ce qu’un humain va me répondre ?",
      instruction:
        "Answer the user's question about the support process or human handover at a generic level."
    },
    {
      standardSubcategory: "unsupported_standard_question",
      sourceVerbatim:
        "Tu peux me confirmer une information que tu ne peux pas vérifier ici ?",
      instruction:
        "Acknowledge that the user asked something the assistant cannot answer reliably."
    }
  ])(
    "treats $standardSubcategory instructions as guidance rather than final text",
    function (fragment) {
      const input: RenderSupportResponseInput = {
        latestUserMessageContent: fragment.sourceVerbatim,
        standardResponseFragments: [
          {
            category: "standard_interaction",
            standardSubcategory: fragment.standardSubcategory,
            sourceSegmentId: "text_segment_1",
            sourceVerbatim: fragment.sourceVerbatim,
            content: fragment.instruction
          }
        ],
        topicResponsePlans: [],
        channel: "matrix"
      };
      const serializedPrompt = serializePrompt(input);
      const output = formatRenderSupportResponseOutput({
        input,
        rawRenderSupportResponse: {
          status: "failed",
          error: {
            message: "llm unavailable"
          }
        }
      });

      expect(serializedPrompt).toContain(fragment.instruction);
      expect(serializedPrompt).toContain(
        "Treat standardFragmentInstructions[].instruction as guidance, never as final text to copy."
      );
      expect(output.renderedResponse.finalResponseText).not.toContain(
        fragment.instruction
      );
    }
  );

  it("accepts handover without asking the user to describe the problem", function () {
    const handoverInstruction = [
      "Acknowledge clearly that the user wants to speak with a human support person.",
      "Tell the user that the request will be passed on to the support team.",
      "Do not promise an immediate human response, a specific delay, or that someone is already actively handling it.",
      "Mention that the assistant remains available in the meantime if the user wants to share more context or get a faster first answer.",
      "If a support issue is also present in another segment or support plan, do not ask the user to describe it again."
    ].join(" ");
    const input: RenderSupportResponseInput = {
      latestUserMessageContent: "Passe-moi un humain",
      targetLanguage: "French",
      standardResponseFragments: [
        {
          category: "standard_interaction",
          standardSubcategory: "handover_request",
          sourceSegmentId: "text_segment_1",
          sourceVerbatim: "Passe-moi un humain",
          content: handoverInstruction
        }
      ],
      topicResponsePlans: [],
      channel: "matrix"
    };
    const serializedPrompt = serializePrompt(input);
    const output = formatRenderSupportResponseOutput({
      input,
      rawRenderSupportResponse: {
        status: "failed",
        error: {
          message: "llm unavailable"
        }
      }
    });

    expect(serializedPrompt).toContain("# Handover override");
    expect(serializedPrompt).toContain(
      "Do not ask the user to describe, repeat, or clarify the support problem."
    );
    expect(output.renderedResponse.finalResponseText).toContain(
      "transmise à l’équipe support"
    );
    expect(output.renderedResponse.finalResponseText).not.toContain(
      "décrire"
    );
  });

  it("suppresses existing support questions when handover is requested later", function () {
    const input: RenderSupportResponseInput = {
      latestUserMessageContent: "Je veux maintenant parler à un humain.",
      targetLanguage: "French",
      standardResponseFragments: [
        {
          category: "standard_interaction",
          standardSubcategory: "handover_request",
          sourceSegmentId: "text_segment_1",
          sourceVerbatim: "Je veux maintenant parler à un humain.",
          content:
            "Tell the user that the request will be passed on to the support team."
        }
      ],
      topicResponsePlans: [
        buildPlan({
          id: "plan_login",
          prompt: "Ask the user to describe the login error again.",
          fieldNames: ["error_message"]
        })
      ],
      channel: "matrix"
    };
    const serializedPrompt = serializePrompt(input);

    expect(serializedPrompt).toContain("Ignore support-plan questions for this turn.");
    expect(serializedPrompt).toContain(
      "Do not condition the handover on any additional information."
    );
  });

  it("keeps French for the short reply non when context language is provided", function () {
    const input: RenderSupportResponseInput = {
      latestUserMessageContent: "non",
      targetLanguage: "French",
      standardResponseFragments: [],
      topicResponsePlans: [],
      channel: "matrix"
    };
    const serializedPrompt = serializePrompt(input);
    const output = formatRenderSupportResponseOutput({
      input,
      rawRenderSupportResponse: {
        status: "failed",
        error: {
          message: "llm unavailable"
        }
      }
    });

    expect(serializedPrompt).toContain("# Target language\nFrench");
    expect(output.renderedResponse.finalResponseText).toBe(
      "Merci pour votre message."
    );
  });
});
