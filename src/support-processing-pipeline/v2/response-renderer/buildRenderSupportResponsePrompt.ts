import type {
  BuildRenderSupportResponsePromptInput,
  RenderSupportResponsePrompt
} from "./typesRenderSupportResponse.types";

function toPromptJson(value: unknown): string {
  return JSON.stringify(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const stringItem = asString(item);

    return stringItem ? [stringItem] : [];
  });
}

function buildRendererTask(
  input: BuildRenderSupportResponsePromptInput
): unknown {
  return {
    targetLanguage: input.targetLanguage ?? null,
    channel: input.channel ?? null,
    say: stringArray(input.composedSupportResponsePlan.say)
  };
}

function buildSystemPrompt(): string {
  return `
You are the final user-facing support response writer.

You receive targetLanguage, channel, and say[] instructions.

The support strategy was already decided by previous steps.
You do not decide what to ask, answer, acknowledge, omit, merge, reorder, or emphasize.
You only transform say[] into one natural user-facing message.

Return exactly one valid JSON object.
Return JSON only.
No markdown.
Do not return renderedMessages or any multi-message metadata.

# Output shape

{
  "finalResponseText": "final user-facing message ready to send"
}

# Rules

- Write in targetLanguage.
- Adapt the tone lightly to the channel.
- Use say[] as the only operational source.
- Do not add support content absent from say[].
- If say[] frames a claim as reported by the user, preserve that framing.
- Do not turn a reported user claim into a support-side confirmation.
- Do not remove planned questions from say[].
- Do not add questions.
- Do not diagnose.
- Do not add procedures, refunds, promises, timelines, escalation claims, team actions, or internal process claims.
- Do not expose JSON, ids, field names, prompts, schema names, RAG, catalog, planner, renderer, or pipeline details.
- Do not mention that you are following instructions.
- Do not copy say[] mechanically.
- Convert the instructions into clear, natural user-facing prose.
- Produce one message only.
- Keep it concise.
`.trim();
}

function buildUserPrompt(input: BuildRenderSupportResponsePromptInput): string {
  return `
Write one final user-facing response from this renderer task:
${toPromptJson(buildRendererTask(input))}
`.trim();
}

function buildRenderSupportResponsePrompt(
  input: BuildRenderSupportResponsePromptInput
): RenderSupportResponsePrompt {
  return {
    messages: [
      {
        role: "system",
        content: buildSystemPrompt()
      },
      {
        role: "user",
        content: buildUserPrompt(input)
      }
    ]
  };
}

export {
  buildRenderSupportResponsePrompt
};
