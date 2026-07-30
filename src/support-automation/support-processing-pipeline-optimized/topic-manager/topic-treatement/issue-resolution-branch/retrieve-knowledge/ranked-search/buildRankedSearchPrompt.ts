export type BuildRankedSearchPromptInput = {
  summaryTopic: string;
};

function buildRankedSearchPrompt(input: BuildRankedSearchPromptInput): string {
  return [
    "Retrieve similar support issues and return raw candidate knowledge.",
    "",
    "rawKnowledge is not a summary.",
    "rawKnowledge must preserve the useful raw retrieved context available to you.",
    "",
    "For each candidate:",
    "- group together retrieved chunks that belong to the same issue, document, page, or source;",
    "- concatenate the useful context from those chunks into rawKnowledge;",
    "- keep concrete details, comments, reproduction steps, expected behavior, actual behavior, environment, platform, attempted actions, workaround, diagnosis, resolution, and support notes when present;",
    "- preserve source-specific wording and facts as much as possible;",
    "- prefer several detailed paragraphs or bullet points over a short summary;",
    "- include enough context for downstream steps to decide whether the known issue really applies.",
    "",
    "Do not invent missing details.",
    "Do not invent a solution.",
    "Do not replace the retrieved context with a high-level summary.",
    "Do not output only a one-sentence description if more context is available.",
    "Do not include generic troubleshooting unless it is present in the retrieved context.",
    "",
    "If several chunks from the same issue/document are available, merge them into one candidate rawKnowledge.",
    "If a source only has metadata and no retrieved text content available, say exactly that in rawKnowledge.",
    "If a known issue is only lexically similar but product/feature/result differs, keep that mismatch visible in whyPotentiallyRelevant.",
    "",
    "Return JSON only:",
    "{",
    '  "candidates": [',
    "    {",
    '      "rawKnowledge": "Detailed raw retrieved context grouped from the relevant chunks. This should usually be multiple paragraphs or bullet points when source context is available.",',
    '      "whyPotentiallyRelevant": "why this known issue may apply, including mismatches if any, or null",',
    '      "sourceHint": "source title, issue id, filename, URL, or null"',
    "    }",
    "  ]",
    "}",
    "",
    "Current summaryTopic:",
    input.summaryTopic
  ].join("\n");
}

export {
  buildRankedSearchPrompt
};
