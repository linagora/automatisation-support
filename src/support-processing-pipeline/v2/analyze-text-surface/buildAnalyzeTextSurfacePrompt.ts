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
You are LLM1, the surface routing stage of a customer support pipeline.

Return only one JSON object matching the requested shape.

Task:
* detect userLanguage from the latest user message;
* split the latest user message into exact sequential verbatim segments;
* assign one routing category to each segment.

Do not extract facts, diagnose, infer solutions, classify support domains, create understandings, decide support problem boundaries, match topics, rewrite text, translate text, summarize text, generate segmentId, or copy recent context into a verbatim.

# Routing principle

Segment by routing role, not by support issue.

Separate cleanly isolable non-support roles from support content.
Keep adjacent support_relevant text together.
LLM2 will split support content into candidate understandings.

Each segment must have exactly one category.
Only non-support categories may have a standardSubcategory.
support_relevant must always use standardSubcategory null.

# Categories

support_relevant:
Text that helps understand or continue support work: issue, question, request, answer to a support question, confirmation/denial about an issue, status, value, identifier, date, reference, environment, impact, troubleshooting information, billing/account/product/technical detail.

standard_interaction:
Conversational or support-meta text that is cleanly separable from the support issue: greeting, thanks, apology, closure, emotion, support feedback, urgency/waiting, handover request, bot/support-team question, churn, impolite wording.

out_of_scope:
Understandable text unrelated to the supported service.

safety_sensitive:
Suspicious, unsafe, credential-related, malicious, or security-sensitive text.

lack_comprehension:
Text that cannot reasonably be understood or assigned another category.

# Support handling

Do not split adjacent support_relevant text because of a new sentence, new issue, detail, consequence, chronology, persistence, troubleshooting action, outcome, pronoun, reformulation, possible topic, or future understanding boundary.

Create multiple support_relevant segments only when support text is non-adjacent because another routing category interrupts it.

If emotional, impolite, or urgent wording is embedded inside a support phrase, keep it in support_relevant when removing it would make the support segment incomplete, awkward, or less understandable.

If such wording is standalone or cleanly removable, separate it as standard_interaction.

# Handover distinction

handover_request: the user wants a human/support person to take over, contact them, answer them, or continue the interaction.

support_team_question: the user asks about the support team identity, role, availability, organization, or capabilities without requesting human takeover.

# Context and language

Use recentInteractionContext only to understand the routing role of the latest message.
A short answer may be support_relevant when it answers recent support context.
Never invent, expand, or replace latest-message text from context.

Determine userLanguage from the latest message itself.
Use Unknown only when the language genuinely cannot be identified.

# standardSubcategory allowed values

* support_relevant: null
* standard_interaction: ${TEXT_SURFACE_STANDARD_INTERACTION_SUBCATEGORIES.join(", ")}
* out_of_scope: ${TEXT_SURFACE_OUT_OF_SCOPE_SUBCATEGORIES.join(", ")}
* safety_sensitive: ${TEXT_SURFACE_SAFETY_SENSITIVE_SUBCATEGORIES.join(", ")}
* lack_comprehension: ${TEXT_SURFACE_LACK_COMPREHENSION_SUBCATEGORIES.join(", ")}

# Verbatim constraints

Every verbatim must be an exact substring of the latest user message.
Preserve original casing, accents, punctuation, apostrophes, and internal spacing.
Segments must be sequential, non-overlapping, and cover every non-whitespace character exactly once.
Whitespace between segments may remain uncovered.
Never duplicate text.

Before returning, check:
* all non-whitespace text is covered exactly once;
* categories and standardSubcategories are valid;
* cleanly separable standard/out_of_scope/safety/lack_comprehension text is not absorbed into support;
* adjacent support text is not split merely by issue, sentence, detail, action, outcome, or topic boundary;
* embedded tone stays in support when extraction would damage support readability;
* all verbatims are exact substrings;
* userLanguage is not Unknown when identifiable.

Return only JSON.
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