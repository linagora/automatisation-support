import { describe, expect, it } from "vitest";

import {
  buildRenderSupportResponsePrompt
} from "../../../../src/support-processing-pipeline/v2/response-renderer/buildRenderSupportResponsePrompt";
import {
  formatRenderSupportResponseOutput
} from "../../../../src/support-processing-pipeline/v2/response-renderer/formatRenderSupportResponseOutput";

import type {
  ComposedSupportResponsePlan
} from "../../../../src/support-processing-pipeline/v2/typesSupportProcessingPipelineV2.types";
import type {
  RenderSupportResponseInput
} from "../../../../src/support-processing-pipeline/v2/response-renderer/typesRenderSupportResponse.types";

function composedPlan(): ComposedSupportResponsePlan {
  return {
    targetLanguage: "fr",
    channel: "email",
    messageIntent: "support_reply",
    globalTone: {
      opening: "brief_acknowledgement",
      empathy: "light",
      formality: "standard"
    },
    sections: [
      {
        kind: "topic",
        topicId: "topic_login",
        purpose: "Acknowledge the login issue.",
        say: [
          "Acknowledge that the user cannot log in."
        ],
        ask: [
          {
            fieldName: "error_message",
            goal: "Ask what exact error appears."
          }
        ],
        forbid: [
          "Do not promise a fix."
        ]
      }
    ],
    globalQuestions: [
      {
        fieldName: "error_message",
        goal: "Ask what exact error appears.",
        sourceTopicIds: ["topic_login"]
      }
    ],
    globalForbid: [
      "Do not promise a fix."
    ],
    rendererInstructions: [
      "Write only from this composed plan."
    ]
  };
}

function input(plan: ComposedSupportResponsePlan = composedPlan()): RenderSupportResponseInput {
  return {
    composedSupportResponsePlan: plan
  };
}

function serializePrompt(renderInput: RenderSupportResponseInput): string {
  return buildRenderSupportResponsePrompt(renderInput).messages
    .map((message) => message.content)
    .join("\n");
}

describe("renderSupportResponse", function () {
  it("renders from a composed support response plan only", function () {
    const prompt = serializePrompt(input());

    expect(prompt).toContain("composed support response plan");
    expect(prompt).toContain("Acknowledge that the user cannot log in.");
    expect(prompt).toContain("Ask what exact error appears.");
    expect(prompt).toContain("Do not promise a fix.");
  });

  it("does not accept or mention raw user message inputs", function () {
    const prompt = serializePrompt(input());

    expect(prompt).not.toContain("Latest user message");
    expect(prompt).not.toContain("standardResponseFragments");
    expect(prompt).not.toContain("topicResponsePlans");
  });

  it("forbids renderer-side reasoning and content additions", function () {
    const prompt = serializePrompt(input());

    expect(prompt).toContain("You must not:");
    expect(prompt).toContain("merge or deduplicate questions");
    expect(prompt).toContain("Do not add any support content that is absent from the plan.");
  });

  it("falls back from the composed plan without old standard fragments", function () {
    const output = formatRenderSupportResponseOutput({
      input: input(),
      rawRenderSupportResponse: {
        status: "failed",
        error: {
          message: "llm unavailable"
        }
      }
    });

    expect(output.validation.status).toBe("fallback");
    expect(output.renderedResponse.finalResponseText).toBe(
      "Acknowledge that the user cannot log in."
    );
  });

  it("accepts a valid rendered response", function () {
    const output = formatRenderSupportResponseOutput({
      input: input(),
      rawRenderSupportResponse: {
        status: "completed",
        parsedResponse: {
          renderedMessages: [
            {
              messageId: "rendered_message_1",
              messageOrder: 1,
              purpose: "clarification_request",
              relatedPlannedMessageOrders: [],
              content:
                "Je comprends que vous ne pouvez pas vous connecter. Quel message d’erreur voyez-vous ?"
            }
          ],
          finalResponseText:
            "Je comprends que vous ne pouvez pas vous connecter. Quel message d’erreur voyez-vous ?",
          internalRenderingNotes: "Rendered from composed plan."
        }
      }
    });

    expect(output.validation.status).toBe("valid");
    expect(output.renderedResponse.finalResponseText).toContain(
      "Quel message d’erreur"
    );
  });
});
