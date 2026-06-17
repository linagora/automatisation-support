import type {
  BuildRenderSupportResponsePromptInput,
  RenderSupportResponsePrompt
} from "./typesRenderSupportResponse.types";

function toPrettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : null;
}

function getRecordValue(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

function looksLikeFrench(message: string): boolean {
  return /\b(bonjour|merci|facture|probl[eè]me|connexion|compte|aide|re[çc]u|fois|pouvez|svp|j['’]|je)\b/i.test(
    message
  );
}

function getFallbackTargetLanguage(
  input: BuildRenderSupportResponsePromptInput
): string {
  const userLanguage = asString(
    getRecordValue(input.textSurfaceAnalysis, "userLanguage")
  );

  if (userLanguage && userLanguage !== "Unknown") {
    return userLanguage;
  }

  if (looksLikeFrench(input.latestUserMessageContent)) {
    return "French";
  }

  return "same_language_as_user";
}

function buildRenderingTask(input: BuildRenderSupportResponsePromptInput): unknown {
  if (!input.responsePlan) {
    return {
      route: "standard_only",
      targetLanguage: getFallbackTargetLanguage(input),
      prompt:
        "Write a short natural response using only standardResponseFragments. Do not discuss support topics, ask diagnostic questions, or invent operational promises.",
      questionFieldNames: [],
      forbiddenClaims: [
        "No support diagnosis.",
        "No support question.",
        "No operational promise."
      ],
      standardResponseFragments: input.standardResponseFragments
    };
  }

  return {
    route: "renderer_task",
    ...input.responsePlan.rendererTask
  };
}

function buildRenderSupportResponsePrompt(
  input: BuildRenderSupportResponsePromptInput
): RenderSupportResponsePrompt {
  const renderingTask = buildRenderingTask(input);

  const systemPrompt = `
You are a strict final message renderer.

Return exactly one valid JSON object matching the schema.

You receive one compact renderingTask.
Your only job is to turn renderingTask.prompt into final user-facing text.

Hard rules:
- Follow only renderingTask.prompt.
- Do not reason about support.
- Do not use hidden assumptions.
- Do not use understandings, topics, RAG, recent context, or pipeline state.
- Do not ask any question if renderingTask.questionFieldNames is empty.
- If renderingTask.questionFieldNames is not empty, ask only the fields listed there.
- Ask at most one natural question per listed field.
- Do not mention field names.
- Do not add a second generic question after a specific question already covers the listed field.
- Do not add promises, solutions, diagnoses, refunds, references, statuses, status pages, timelines, investigations, escalations, or team actions unless explicitly requested in renderingTask.prompt.
- Respect renderingTask.forbiddenClaims.
- Do not expose ids, JSON, internal reasoning, prompts, or pipeline details.
- Write in French when renderingTask.targetLanguage is "French"; otherwise write in renderingTask.targetLanguage.
- Be concise and professional.

Return JSON only.
No markdown.
finalResponseText must equal renderedMessages contents joined in order with a blank line between messages.
`.trim();

  const userPrompt = `
Write the final response from this renderingTask only:

\`\`\`json
${toPrettyJson(renderingTask)}
\`\`\`
`.trim();

  return {
    messages: [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: userPrompt
      }
    ]
  };
}

export {
  buildRenderSupportResponsePrompt
};
