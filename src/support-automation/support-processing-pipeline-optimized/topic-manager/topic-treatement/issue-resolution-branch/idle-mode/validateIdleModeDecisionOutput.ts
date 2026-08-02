import type {LiveMemoryTopicOptimized} from "../../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";

type TopicHandoverRequest = {
  isRequested: boolean;
  reason: string | null;
};

type IdleModeDecisionOutput = {
  topicStatus: Extract<LiveMemoryTopicOptimized["status"], "solved_by_bot" | "unsolved">;
  topicHandoverRequest: TopicHandoverRequest;
  say: string | null;
};

function validateIdleModeDecisionOutput(
  value: unknown
): IdleModeDecisionOutput | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const topicStatus = validateTopicStatus(raw.topicStatus);
  const topicHandoverRequest = validateTopicHandoverRequest(raw.topicHandoverRequest);

  if (!topicStatus || !topicHandoverRequest) {
    return null;
  }

  if (raw.say !== null && typeof raw.say !== "string") {
    return null;
  }

  return {
    topicStatus,
    topicHandoverRequest,
    say: typeof raw.say === "string" && raw.say.trim() !== ""
      ? raw.say.trim()
      : null
  };
}

function validateTopicStatus(
  value: unknown
): IdleModeDecisionOutput["topicStatus"] | null {
  return value === "solved_by_bot" || value === "unsolved"
    ? value
    : null;
}

function validateTopicHandoverRequest(value: unknown): TopicHandoverRequest | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;

  if (typeof raw.isRequested !== "boolean") {
    return null;
  }

  if (raw.reason !== null && typeof raw.reason !== "string") {
    return null;
  }

  return {
    isRequested: raw.isRequested,
    reason: typeof raw.reason === "string" && raw.reason.trim() !== ""
      ? raw.reason.trim()
      : null
  };
}

export {validateIdleModeDecisionOutput};

export type {IdleModeDecisionOutput};
