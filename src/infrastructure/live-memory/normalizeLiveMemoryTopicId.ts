/**
 * Strict parser for persisted topic ids.
 *
 * New V2 code stores numeric ids only. The string support below is only a
 * read-side migration helper for old clean ids such as "1" or "topic_1".
 * Temporary ids such as "new_topic_1" are intentionally rejected.
 */
function parseLiveMemoryTopicId(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 1) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  if (normalized === "") {
    return null;
  }

  const directNumber = normalized.match(/^\d+$/u);

  if (directNumber) {
    return Number(directNumber[0]);
  }

  const topicNumber = normalized.match(/^topic_(\d+)$/iu);

  if (topicNumber) {
    return Number(topicNumber[1]);
  }

  return null;
}

// Kept for compatibility with older imports. It now returns a number, not a string.
const normalizeLiveMemoryTopicId = parseLiveMemoryTopicId;

export {
  normalizeLiveMemoryTopicId,
  parseLiveMemoryTopicId
};
