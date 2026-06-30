function stableSafeTopicSuffix(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeLiveMemoryTopicId(
  topicId: string | null | undefined
): string | null {
  if (typeof topicId !== "string") {
    return null;
  }

  const trimmedTopicId = topicId.trim();

  if (trimmedTopicId === "") {
    return null;
  }

  const numericMatch = trimmedTopicId.match(/\d+/);

  if (numericMatch) {
    return `topic_${Number(numericMatch[0])}`;
  }

  const safeSuffix = stableSafeTopicSuffix(trimmedTopicId);

  return safeSuffix === "" ? null : `topic_${safeSuffix}`;
}

export {
  normalizeLiveMemoryTopicId
};
