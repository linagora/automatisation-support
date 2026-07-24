type BuildMessageInput = {
  standardResponseFragments?: Array<{
    say: string;
  }>;

  topicMessages?: Array<{
    topicId: number | null;
    title: string | null;
    say: string;
  }>;
};

type BuildMessageOutput = {
  status: "processed";
  fallbackReason: null;
  message: string;
};

function buildMessage(input: BuildMessageInput): BuildMessageOutput {
  const messageParts: string[] = [];

  // 1. Standard fragments always come first.
  // They are already user-facing sentences written in English.
  //
  // Important:
  // - buildMessage only composes user-facing text;
  // - it removes exact duplicate fragments;
  // - it does NOT decide intent priority, such as identity > greeting.
  for (const say of buildUniqueStandardFragmentMessages(input.standardResponseFragments ?? [])) {
    messageParts.push(say);
  }

  // 2. Topic messages come after standard fragments.
  //
  // Important:
  // - single respondable topic: do NOT render the internal topic title;
  // - multiple respondable topics: render a visible heading per topic.
  const respondableTopics = (input.topicMessages ?? []).filter((topicMessage) =>
    cleanText(topicMessage.say) !== null
  );

  const shouldRenderTopicHeadings = respondableTopics.length >= 2;

  for (const topicMessage of respondableTopics) {
    const say = cleanText(topicMessage.say);

    if (!say) {
      continue;
    }

    if (!shouldRenderTopicHeadings) {
      messageParts.push(say);
      continue;
    }

    const heading = formatTopicHeading(topicMessage.title);

    messageParts.push(`${heading}\n${say}`);
  }

  return {
    status: "processed",
    fallbackReason: null,
    message: messageParts.join("\n\n").trim()
  };
}

function buildUniqueStandardFragmentMessages(
  fragments: readonly Array<{say: string}>
): string[] {
  const seen = new Set<string>();
  const messages: string[] = [];

  for (const fragment of fragments) {
    const say = cleanText(fragment.say);

    if (!say) {
      continue;
    }

    const dedupeKey = normalizeForDedupe(say);

    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    messages.push(say);
  }

  return messages;
}

function formatTopicHeading(title: string | null | undefined): string {
  return (cleanText(title) ?? "Sujet").toLocaleUpperCase("fr-FR");
}

function normalizeForDedupe(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en-US");
}

function cleanText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed === "" ? null : trimmed;
}

export {buildMessage};

export type {
  BuildMessageInput,
  BuildMessageOutput
};