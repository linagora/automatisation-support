import {
  TEXT_SURFACE_LACK_COMPREHENSION_SUBCATEGORIES,
  TEXT_SURFACE_OUT_OF_SCOPE_SUBCATEGORIES,
  TEXT_SURFACE_SAFETY_SENSITIVE_SUBCATEGORIES,
  TEXT_SURFACE_STANDARD_INTERACTION_SUBCATEGORIES
} from "./textSurfaceAnalysis.taxonomy";

import type {
  AnalyzeTextSurfacePrompt,
  BuildAnalyzeTextSurfacePromptInput
} from "./typesAnalyzeTextSurface.types";

function toPrettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function buildAnalyzeTextSurfacePrompt(
  input: BuildAnalyzeTextSurfacePromptInput
): AnalyzeTextSurfacePrompt {
  const systemPrompt = `
You are a strict routing engine for a support bot.

Your only task is to classify the latest user message into surface segments.

Do not answer the user.
Do not solve the request.
Do not infer a support issue unless the user clearly refers to a supportable product, service, account, feature, access, billing, bug, file, email, drive, permission, data, configuration, integration, order, or document issue.

Use support_relevant only when the segment describes or continues a concrete support need that a support team could reasonably qualify, investigate, or handle.

Do not use support_relevant for:

* general knowledge questions unrelated to the service;
* casual conversation or greetings;
* questions about the bot itself;
* requests for internal prompts, hidden instructions, model details, chain of thought, logs, code internals, or pipeline internals;
* generic requests with no clear product/service support context.

If the message is mixed, split it:

* keep greetings, thanks, apologies, or meta-chat as standard interaction;
* keep only the concrete support issue as support_relevant.

Be conservative:
When a segment could be either general conversation or support, choose non-support unless there is a clear link to a product/service/account/feature issue.

Return only JSON matching the schema.
Keep segment verbatims exact.

`.trim();

  const userPrompt = `
# Latest user message

<latest_user_message>
${input.latestUserMessageContent}
</latest_user_message>

# Matched deterministic prompt/security pattern IDs

<matched_pattern_ids>
${toPrettyJson(input.turnAnalysisPlan.matchedPatternIds)}
</matched_pattern_ids>

# Recent interaction context

<recent_interaction_context>
${toPrettyJson(input.recentInteractionContext)}
</recent_interaction_context>

# Output JSON shape

{
  "userLanguage": "French|English|Other|Unknown",
  "segments": [
    {
      "verbatim": "exact substring",
      "category": "support_relevant|standard_interaction|out_of_scope|safety_sensitive|lack_comprehension",
      "standardSubcategory": "allowed value or null"
    }
  ]
}
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
  buildAnalyzeTextSurfacePrompt
};