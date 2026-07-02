import { describe, expect, it } from "vitest";

import {
  buildRenderSupportResponsePrompt
} from "../../../src/support-automation/support-processing-pipeline-v2/response-renderer/buildRenderSupportResponsePrompt";
import {
  formatRenderSupportResponseOutput
} from "../../../src/support-automation/support-processing-pipeline-v2/response-renderer/formatRenderSupportResponseOutput";

import type {
  ComposedSupportResponsePlan
} from "../../../src/support-automation/support-processing-pipeline-v2/typesSupportProcessingPipelineV2.types";
import type {
  RenderSupportResponseInput
} from "../../../src/support-automation/support-processing-pipeline-v2/response-renderer/typesRenderSupportResponse.types";

function composedPlan(): ComposedSupportResponsePlan {
  return {
    topicId: null,
    messageIntent: "support_reply",
    acknowledge: [],
    answer: [],
    ask: [],
    say: [
      "Acknowledge that the user cannot log in.",
      "Ask what exact error appears.",
      "Do not promise a fix."
    ],
    review: null
  };
}

function input(plan: ComposedSupportResponsePlan = composedPlan()): RenderSupportResponseInput {
  return {
    composedSupportResponsePlan: plan,
    targetLanguage: "fr",
    channel: "email"
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

    expect(prompt).toContain("targetLanguage, channel, and say[] instructions");
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

    expect(prompt).toContain(
      "You do not decide what to ask, answer, acknowledge, omit, merge, reorder, or emphasize."
    );
    expect(prompt).toContain("Do not add support content absent from say[].");
    expect(prompt).toContain(
      "Do not turn a reported user claim into a support-side confirmation."
    );
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
          finalResponseText:
            "Je comprends que vous ne pouvez pas vous connecter. Quel message d’erreur voyez-vous ?"
        }
      }
    });

    expect(output.validation.status).toBe("valid");
    expect(output.renderedResponse.finalResponseText).toContain(
      "Quel message d’erreur"
    );
  });

  it("falls back when rendered output exposes internal technical details", function () {
    const output = formatRenderSupportResponseOutput({
      input: input(),
      rawRenderSupportResponse: {
        status: "completed",
        parsedResponse: {
          finalResponseText:
            "Please send backend debug logs so the developer can inspect the feature flag configuration."
        }
      }
    });

    expect(output.validation).toEqual({
      status: "fallback",
      reason: "internal_or_technical_content_exposed"
    });
    expect(output.renderedResponse.finalResponseText).toBe(
      "Je n’ai pas assez d’informations pour répondre correctement. Pouvez-vous préciser votre demande ?"
    );
  });
});
