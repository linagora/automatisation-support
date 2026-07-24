import {
  outputJsonShapeForPrompt,
  responseFormat
} from "./responseFormat";

import type {LLMMessage} from "../../../infrastructure/llm/llm-client";

type ComposedSupportResponsePlan = {
  messageIntent:
    | "support_reply"
    | "standard_reply"
    | "mixed_reply"
    | "handover_reply"
    | "review_reply";
  topicIds: Array<number | null>;
  say: string[];
  review: string | null;
};

type BuildRenderSupportResponsePromptInput = {
  composedSupportResponsePlan: ComposedSupportResponsePlan;
  targetLanguage?: string;
  channel?: string;
};

type RenderSupportResponseLlmRequest = {
  messages: LLMMessage[];
  responseFormat: typeof responseFormat;
};

function buildRenderSupportResponsePrompt(
  input: BuildRenderSupportResponsePromptInput
): RenderSupportResponseLlmRequest {
  const systemPrompt = `
You are the final customer-facing support response renderer.

You receive a composed support response plan.
Your job is to turn it into one natural, concise message for the user.
Return only JSON matching the requested schema.
`.trim();

  const userPrompt = `
# Input

<target_language>
${input.targetLanguage ?? "same language as the user"}
</target_language>

<channel>
${input.channel ?? "unknown"}
</channel>

<composed_support_response_plan>
${JSON.stringify(input.composedSupportResponsePlan)}
</composed_support_response_plan>

# Contract

Use composedSupportResponsePlan.say as the source of truth.
Write one final user-facing answer.
Do not add new diagnosis, troubleshooting steps, promises, refunds, escalation, timelines, or account status unless they are explicitly present in say[].
Do not expose topic ids, branch names, planner names, catalog names, RAG, pipeline, renderer, JSON, validation, debug details, or internal implementation details.
Do not mention that you are following a plan.
Do not wrap the answer in markdown unless the content naturally needs short bullets.

# Style

- Be clear, natural, and direct.
- Keep the language aligned with target_language.
- If target_language is French, use natural French with "vous".
- Merge duplicate asks.
- Preserve any question that the plan requires.
- If the plan asks for clarification, ask only what is needed.
- If the plan says no automatic solution is available, acknowledge that clearly without inventing an escalation promise.

# Output JSON shape

${outputJsonShapeForPrompt}

Return only JSON.
`.trim();

  return {
    messages: [
      {role: "system", content: systemPrompt},
      {role: "user", content: userPrompt}
    ],
    responseFormat
  };
}

export {buildRenderSupportResponsePrompt};

export type {
  BuildRenderSupportResponsePromptInput,
  ComposedSupportResponsePlan,
  RenderSupportResponseLlmRequest
};
