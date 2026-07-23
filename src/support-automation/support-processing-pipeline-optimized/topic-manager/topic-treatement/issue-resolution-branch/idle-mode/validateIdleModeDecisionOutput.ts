import type {LiveMemoryTopicOptimized} from "../../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";

type ResolutionStatus = LiveMemoryTopicOptimized["sourceTopicManager"]["resolutionStatus"];
type Handover = LiveMemoryTopicOptimized["sourceTopicManager"]["handover"];

type IdleModeDecisionOutput = {
  resolutionStatus: ResolutionStatus;
  handover: Handover;
  say: string | null;
};

function validateIdleModeDecisionOutput(
  value: unknown
): IdleModeDecisionOutput | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const resolutionStatus = validateResolutionStatus(raw.resolutionStatus);
  const handover = validateHandover(raw.handover);

  if (!resolutionStatus || !handover) {
    return null;
  }

  if (raw.say !== null && typeof raw.say !== "string") {
    return null;
  }

  return {
    resolutionStatus,
    handover,
    say: typeof raw.say === "string" && raw.say.trim() !== ""
      ? raw.say.trim()
      : null
  };
}

function validateResolutionStatus(value: unknown): ResolutionStatus | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;

  if (
    raw.value !== "in_progress" &&
    raw.value !== "solved_by_bot" &&
    raw.value !== "solved_by_human"
  ) {
    return null;
  }

  if (raw.reason !== null && typeof raw.reason !== "string") {
    return null;
  }

  return {
    value: raw.value,
    reason: typeof raw.reason === "string" && raw.reason.trim() !== ""
      ? raw.reason.trim()
      : null
  } as ResolutionStatus;
}

function validateHandover(value: unknown): Handover | null {
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
  } as Handover;
}

export {validateIdleModeDecisionOutput};

export type {IdleModeDecisionOutput};
