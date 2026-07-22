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
  for (const fragment of input.standardResponseFragments ?? []) {
    const say = cleanText(fragment.say);

    if (say) {
      messageParts.push(say);
    }
  }

  // 2. Topic messages come after standard fragments.
  // Each topic keeps its title, then the branch planner answer.
  for (const topicMessage of input.topicMessages ?? []) {
    const say = cleanText(topicMessage.say);

    if (!say) {
      continue;
    }

    const title = cleanText(topicMessage.title);

    messageParts.push(
      title
        ? `${title}\n${say}`
        : say
    );
  }

  return {
    status: "processed",
    fallbackReason: null,
    message: messageParts.join("\n\n").trim()
  };
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