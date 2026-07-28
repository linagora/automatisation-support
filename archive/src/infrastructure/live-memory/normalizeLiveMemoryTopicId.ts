function parseLiveMemoryTopicId(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 1) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  if (/^\d+$/u.test(normalized)) {
    return Number(normalized);
  }

  return null;
}

function getNextLiveMemoryTopicId(topics: Array<{sourceProposeTopicUpdates: {topicId: number}}> | null): number {
  if (!topics || topics.length === 0) {
    return 1;
  }

  return Math.max(
    ...topics.map((topic) => topic.sourceProposeTopicUpdates.topicId)
  ) + 1;
}

export {
  getNextLiveMemoryTopicId,
  parseLiveMemoryTopicId
};
