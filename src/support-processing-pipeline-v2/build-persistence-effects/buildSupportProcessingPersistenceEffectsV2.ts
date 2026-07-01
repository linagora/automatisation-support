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

function normalizeCaseDetails(value: unknown): LiveMemoryCaseDetail[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item): LiveMemoryCaseDetail[] => {
    if (!isRecord(item) || typeof item.key !== "string") {
      return [];
    }

    return [
      {
        key: item.key,
        value: readPrimitive(item.value),
        ...(item.evidence === undefined
          ? {}
          : { evidence: readNullableString(item.evidence) })
      }
    ];
  });
}

function normalizeAttemptedActions(value: unknown): LiveMemoryAttemptedAction[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item): LiveMemoryAttemptedAction[] => {
    if (!isRecord(item) || typeof item.action !== "string") {
      return [];
    }

    const outcome = typeof item.outcome === "string"
      ? item.outcome
      : undefined;

    return [
      {
        action: item.action,
        ...(outcome === "success" ||
        outcome === "failed" ||
        outcome === "partial" ||
        outcome === "unknown"
          ? { outcome }
          : {}),
        ...(item.evidence === undefined
          ? {}
          : { evidence: readNullableString(item.evidence) })
      }
    ];
  });
}

function snapshotToLiveMemoryTopic(
  snapshot: MergedTopicSnapshot,
  index: number
): LiveMemoryTopicUpdate {
  const record = snapshot as unknown as Record<string, unknown>;

  const topicId =
    readString(record.topicId) ??
    readString(record.temporaryTopicId) ??
    readString(record.snapshotId) ??
    `topic_${index + 1}`;

  return {
    topicId,
    title: readNullableString(record.title),
    broadCategoryHint: readNullableString(record.broadCategoryHint),
    summary: readNullableString(record.summary),
    caseDetails: normalizeCaseDetails(record.caseDetails),
    attemptedActions: normalizeAttemptedActions(record.attemptedActions)
  };
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
  };
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
  topicSnapshotsToLiveMemoryTopics
};
