import type {
  BuildSupportPersistenceEffectsInput,
  LiveMemoryAttemptedAction,
  LiveMemoryCaseDetail,
  LiveMemoryContextUpdate,
  LiveMemoryPrimitive,
  LiveMemoryTopicUpdate,
  LiveMemoryUserStateUpdate,
  MergedTopicSnapshot,
  MockedOpenTelemetryPayload,
  OtherSupportPipelineInformation,
  SupportProcessingPersistenceEffectsV2
} from "../typesSupportProcessingPipelineV2.types";

type BuildSupportProcessingPersistenceEffectsInput =
  BuildSupportPersistenceEffectsInput & {
    latestUserMessage?: {
      content?: unknown;
    };
    latestUserMessageContent?: unknown;
  };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function readPositiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 1
    ? value
    : null;
}

function readPrimitive(value: unknown): LiveMemoryPrimitive {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return value;
  }

  if (value === undefined) {
    return null;
  }

  return String(value);
}

function cleanEvidence(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "" || value === "existing_topic") {
    return null;
  }

  return value;
}

function normalizeCaseDetails(value: unknown): LiveMemoryCaseDetail[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item): LiveMemoryCaseDetail[] => {
    if (!isRecord(item) || typeof item.key !== "string" || item.key.trim() === "") {
      return [];
    }

    return [
      {
        key: item.key.trim(),
        value: readPrimitive(item.value),
        ...(cleanEvidence(item.evidence) === null
          ? {}
          : { evidence: cleanEvidence(item.evidence) })
      }
    ];
  });
}

function normalizeAttemptedActions(value: unknown): LiveMemoryAttemptedAction[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item): LiveMemoryAttemptedAction[] => {
    if (!isRecord(item) || typeof item.action !== "string" || item.action.trim() === "") {
      return [];
    }

    const outcome = typeof item.outcome === "string"
      ? item.outcome
      : undefined;

    return [
      {
        action: item.action.trim(),
        ...(outcome === "success" ||
        outcome === "failed" ||
        outcome === "partial" ||
        outcome === "unknown"
          ? { outcome }
          : {}),
        ...(cleanEvidence(item.evidence) === null
          ? {}
          : { evidence: cleanEvidence(item.evidence) })
      }
    ];
  });
}

function snapshotToLiveMemoryTopic(
  snapshot: MergedTopicSnapshot
): LiveMemoryTopicUpdate {
  const record = snapshot as unknown as Record<string, unknown>;
  const topicId = readPositiveInteger(record.topicId);

  if (topicId === null) {
    throw new Error(
      "Invalid V2 persistence input: merged topic snapshot must contain a numeric topicId before persistence."
    );
  }

  return {
    topicId,
    title: readNullableString(record.title),
    broadCategoryHint: readNullableString(record.broadCategoryHint),
    summary: readNullableString(record.summary),
    caseDetails: normalizeCaseDetails(record.caseDetails),
    attemptedActions: normalizeAttemptedActions(record.attemptedActions),
    ...(readString(record.supportKnowledgeSummary)
      ? {
          supportKnowledgeSummary: readString(record.supportKnowledgeSummary)
        }
      : {})
  } as unknown as LiveMemoryTopicUpdate;
}

function topicSnapshotsToLiveMemoryTopics(
  snapshots: MergedTopicSnapshot[] | undefined
): LiveMemoryTopicUpdate[] {
  return (snapshots ?? []).map(snapshotToLiveMemoryTopic);
}

function extractTextFromUnknown(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(extractTextFromUnknown).filter(Boolean).join("\n").trim();
  }

  if (!isRecord(value)) {
    return "";
  }

  const directCandidates = [
    value.content,
    value.text,
    value.message,
    value.body,
    value.plainText,
    value.markdown
  ];

  for (const candidate of directCandidates) {
    if (typeof candidate === "string" && candidate.trim() !== "") {
      return candidate;
    }
  }

  const nestedCandidates = [
    value.messages,
    value.deliveryMessages,
    value.parts,
    value.items
  ];

  for (const candidate of nestedCandidates) {
    const extracted = extractTextFromUnknown(candidate);

    if (extracted.trim() !== "") {
      return extracted;
    }
  }

  return "";
}

function getLastUserVerbatim(
  input: BuildSupportProcessingPersistenceEffectsInput
): string {
  return (
    readString(input.latestUserMessageContent) ??
    readString(input.latestUserMessage?.content) ??
    ""
  );
}

function getLastBotVerbatim(
  input: BuildSupportProcessingPersistenceEffectsInput
): string {
  return extractTextFromUnknown(input.userResponse);
}

function buildUserState(
  input: BuildSupportProcessingPersistenceEffectsInput
): LiveMemoryUserStateUpdate {
  const matchedPatternIds =
    input.promptSecuritySignals.matchedPatternIds ?? [];

  const flags = matchedPatternIds.map((patternId) => {
    return `matched_prompt_pattern:${patternId}`;
  });

  if (flags.length > 0) {
    return {
      status: "watch",
      flags
    };
  }

  return {
    status: "normal",
    flags: []
  };
}

function buildLiveMemoryUpdate(
  input: BuildSupportProcessingPersistenceEffectsInput
): LiveMemoryContextUpdate {
  return {
    mode: "merge",
    topics: topicSnapshotsToLiveMemoryTopics(input.mergedTopicSnapshots),
    lastUserVerbatim: getLastUserVerbatim(input),
    lastBotVerbatim: getLastBotVerbatim(input),
    userState: buildUserState(input)
  } as unknown as LiveMemoryContextUpdate;
}

function buildMockedOpenTelemetryPayload(): MockedOpenTelemetryPayload {
  return {
    status: "mocked_empty",
    spans: [],
    metrics: [],
    events: [],
    resourceAttributes: {}
  };
}

function buildOtherSupportPipelineInformation(): OtherSupportPipelineInformation {
  return {};
}

function buildSupportProcessingPersistenceEffectsV2(
  input: BuildSupportProcessingPersistenceEffectsInput
): SupportProcessingPersistenceEffectsV2 {
  return {
    liveMemoryUpdate: buildLiveMemoryUpdate(input),
    openTelemetry: buildMockedOpenTelemetryPayload(),
    otherSupportPipelineInformation: buildOtherSupportPipelineInformation()
  };
}

export type {
  LiveMemoryAttemptedAction,
  LiveMemoryCaseDetail,
  LiveMemoryContextUpdate,
  LiveMemoryTopicUpdate,
  LiveMemoryUserStateUpdate,
  MockedOpenTelemetryPayload,
  OtherSupportPipelineInformation,
  SupportProcessingPersistenceEffectsV2
};

export {
  buildLiveMemoryUpdate,
  buildMockedOpenTelemetryPayload,
  buildOtherSupportPipelineInformation,
  buildSupportProcessingPersistenceEffectsV2,
  snapshotToLiveMemoryTopic,
  topicSnapshotsToLiveMemoryTopics
};