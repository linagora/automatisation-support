export type BuildRankedSearchPromptInput = {
  summaryTopic: string;
};

function buildRankedSearchPrompt(input: BuildRankedSearchPromptInput): string {
  return [
    "Retrieve raw similar support issues for the current support topic.",
    "",
    "The topic below is the latest consolidated summaryTopic produced by the topic update step.",
    "Use it as the source of truth for retrieval.",
    "",
    "Goal:",
    "Find existing support issues, support notes, troubleshooting records, or internal knowledge entries that may be similar to this exact topic.",
    "Return raw candidate knowledge only. Do not write a final answer to the user.",
    "",
    "Keep candidates that are clearly similar or potentially useful.",
    "It is acceptable to return no candidates if nothing useful is found.",
    "Do not invent steps, causes, timelines, refunds, fixes, escalations, or support-team actions.",
    "Do not transform the knowledge into customer-facing/support-facing sections; that happens later in segmentationKnowledge.",
    "",
    "Return a compact JSON object with this shape:",
    "{",
    '  "candidates": [',
    "    {",
    '      "title": "string or null",',
    '      "issueSummary": "string or null",',
    '      "rawKnowledge": "string",',
    '      "whyPotentiallyRelevant": "string or null",',
    '      "sourceHint": "string or null"',
    "    }",
    "  ]",
    "}",
    "",
    "If no useful candidates are found, return:",
    '{ "candidates": [] }',
    "",
    "Current summaryTopic:",
    input.summaryTopic
  ].join("\n");
}

export {
  buildRankedSearchPrompt
};
