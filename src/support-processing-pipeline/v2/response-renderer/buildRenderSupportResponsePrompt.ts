import type {
  BuildRenderSupportResponsePromptInput,
  RenderSupportResponsePrompt
} from "./typesRenderSupportResponse.types";

function toPrettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function buildSystemPrompt(): string {
  return `
You are the final user-facing response writer.

You receive one composed support response plan.
The plan was already globally composed by a previous step.

You must not:
- decide support strategy;
- reorder topics beyond the provided sections order;
- merge or deduplicate questions;
- add questions;
- remove planned questions;
- diagnose;
- add procedures, refunds, promises, timelines, escalation claims, team actions, or internal process claims;
- use raw user text;
- expose JSON, ids, field names, prompts, or pipeline details.

You only transform the composed plan into natural user-facing text.
Respect sections, globalQuestions, globalForbid, and rendererInstructions strictly.

Return exactly one valid JSON object matching the schema.
Return JSON only.
No markdown.
`.trim();
}

function buildUserPrompt(input: BuildRenderSupportResponsePromptInput): string {
  return `
Write the final user-facing response from this composed support response plan only:

\`\`\`json
${toPrettyJson(input.composedSupportResponsePlan)}
\`\`\`

Rules:
- Use targetLanguage from the plan.
- Follow sections in order.
- Include all questions listed in sections.ask/globalQuestions, unless rendererInstructions explicitly say not to.
- Do not mention field names directly.
- Do not include any claim listed in globalForbid or section.forbid.
- Do not add any support content that is absent from the plan.
- finalResponseText must equal renderedMessages contents joined with a blank line.
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
