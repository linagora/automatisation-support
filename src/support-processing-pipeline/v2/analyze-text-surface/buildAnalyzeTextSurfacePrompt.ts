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
You are a strict surface router for a customer support pipeline.

Return only one JSON object matching the provided schema.

Your task is to:

* classify the exact content of the latest user message;
* split it into sequential segments only when their routing role changes;
* preserve each segment verbatim.
* use recent interaction context only to choose the routing category of the latest user message.

Do not extract facts, fields, topics, causes, intentions, or solutions.
Do not rewrite, translate, summarize, or complete the message.
Do not generate segmentId.
Do not use recent interaction context to extract facts, create fields, create topics, complete the current message, or rewrite it.

Categories:

* support_relevant: content that provides, may provide, requests, confirms, references, or contextually completes information useful for support analysis.
* standard_interaction: understandable conversational, emotional, or meta-conversational content that can receive a standard response and does not require deep support analysis.
* out_of_scope: understandable content unrelated to the supported service.
* safety_sensitive: suspicious, unsafe, security-sensitive, credential-related, or malicious content.
* lack_comprehension: content that cannot reasonably be understood or assigned another category.

Priority rules:

* Use the minimal number of segments that allows each segment to have a single routing role.
* Separate two portions when their routing role changes, even if they are grammatically connected.
* Do not split support_relevant content only to isolate its internal facts.
* Any information, confirmation, answer, reference, request, result, or potentially contextual content is support_relevant.
* Short confirmations, short answers, dates, identifiers, references, or results are support_relevant when they may complete previous support context.
* A short answer that answers, confirms, denies, specifies, or references a previous support interaction is support_relevant.
* Explicit gratitude remains standard_interaction / thanks_neutral or standard_interaction / thanks_positive.
* Never classify a simple affirmation or negation as thanks_neutral or thanks_positive.
* Isolable emotions, greetings, feedback, or urgency without business content may be standard_interaction.
* An explicit request to speak with a human or support is standard_interaction / handover_request when it is isolated.
* If a handover request is accompanied by a separable support problem, segment the handover request as standard_interaction / handover_request and the problem as support_relevant.
* If the handover request and support problem cannot be separated cleanly without rewriting, keep the full segment support_relevant.
* Use lack_comprehension only when no other category reasonably applies.

standardSubcategory rules:

* support_relevant: null
* standard_interaction: ${TEXT_SURFACE_STANDARD_INTERACTION_SUBCATEGORIES.join(", ")}
* out_of_scope: ${TEXT_SURFACE_OUT_OF_SCOPE_SUBCATEGORIES.join(", ")}
* safety_sensitive: ${TEXT_SURFACE_SAFETY_SENSITIVE_SUBCATEGORIES.join(", ")}
* lack_comprehension: ${TEXT_SURFACE_LACK_COMPREHENSION_SUBCATEGORIES.join(", ")}

Verbatim constraints:

* Each verbatim must be an exact substring of the latest user message.
* Preserve casing, accents, punctuation, and internal spacing.
* Segments must be ordered and non-overlapping.
* Together, they must cover all non-whitespace content.
* Whitespace between segments may remain uncovered.

`.trim();

  const userPrompt = `
# Latest user message

\`\`\`text
${input.latestUserMessageContent}
\`\`\`

# Matched deterministic prompt/security pattern IDs

\`\`\`json
${toPrettyJson(input.turnAnalysisPlan.matchedPatternIds)}
\`\`\`

# Recent interaction context

\`\`\`json
${toPrettyJson(input.recentInteractionContext)}
\`\`\`

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
