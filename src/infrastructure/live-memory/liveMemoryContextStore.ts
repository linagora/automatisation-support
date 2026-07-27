import * as fs from "fs/promises";
import * as path from "path";
import {randomUUID} from "crypto";

import {
  createEmptyLiveMemoryContextOptimized,
  createEmptySourceTopicManager
} from "./liveMemoryDefaults";
import {parseLiveMemoryTopicId} from "./normalizeLiveMemoryTopicId";

import type {
  LiveMemoryContextOptimized,
  LiveMemoryTopicOptimized
} from "./liveMemoryContextOptimized.template";

const DEFAULT_LIVE_MEMORY_CONTEXT_DIR = path.resolve("data/live-memory-context");

type JsonRecord = Record<string, unknown>;

function getLiveMemoryContextDirectory(): string {
  return process.env.LIVE_MEMORY_CONTEXT_DIR ?? DEFAULT_LIVE_MEMORY_CONTEXT_DIR;
}

function buildLiveMemoryContextPath(conversationKey: string): string {
  return path.join(getLiveMemoryContextDirectory(), `${conversationKey}.json`);
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const output: string[] = [];

  for (const item of value) {
    const normalized = nullableString(item);

    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    output.push(normalized);
  }

  return output;
}

function normalizeHandover(value: unknown): LiveMemoryContextOptimized["handover"] {
  if (!isRecord(value)) {
    return createEmptyLiveMemoryContextOptimized().handover;
  }

  const handoverReason = value.handoverReason === "asked_by_user" ||
    value.handoverReason === "detected_by_system"
    ? value.handoverReason
    : null;

  return {
    isHandover: value.isHandover === true,
    handoverReason
  };
}

function normalizePreviousConversationTurn(
  value: unknown
): LiveMemoryContextOptimized["previousConversationTurn"] {
  if (!isRecord(value)) {
    return createEmptyLiveMemoryContextOptimized().previousConversationTurn;
  }

  return {
    previousUserMessage: nullableString(value.previousUserMessage),
    previousBotMessage: nullableString(value.previousBotMessage)
  };
}

function normalizeUserState(value: unknown): LiveMemoryContextOptimized["userState"] {
  if (!isRecord(value)) {
    return createEmptyLiveMemoryContextOptimized().userState;
  }

  return {
    status: typeof value.status === "string" && value.status.trim() !== ""
      ? value.status.trim()
      : "normal",
    flags: stringArray(value.flags)
  };
}

function normalizeFailedPipelineMessages(
  value: unknown
): LiveMemoryContextOptimized["failedPipelineMessages"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    return [{
      concernedUserMessage: stringArray(item.concernedUserMessage),
      concernedAttachment: item.concernedAttachment ?? null,
      fallbackReason: item.fallbackReason ?? null
    }];
  });
}

function normalizeSecurityAlerts(
  value: unknown
): LiveMemoryContextOptimized["securityAlerts"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    return [{
      concernedUserMessage: stringArray(item.concernedUserMessage),
      concernedAttachment: Array.isArray(item.concernedAttachment)
        ? item.concernedAttachment
        : [],
      flags: stringArray(item.flags)
    }];
  });
}

function normalizeTopicStatus(value: unknown): LiveMemoryTopicOptimized["status"] {
  if (
    value === "in_progress" ||
    value === "solved_by_bot" ||
    value === "unsolved"
  ) {
    return value;
  }

  return "in_progress";
}

function normalizeExtractedStatus(
  value: unknown
): "obtained" | "user_declared_unavailable" | null {
  return value === "obtained" || value === "user_declared_unavailable"
    ? value
    : null;
}

function normalizeCaseDetailsExtracted(
  value: unknown
): LiveMemoryTopicOptimized["sourceAnalyzeSupportText"]["caseDetailsExtracted"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.key !== "string") {
      return [];
    }

    const status = normalizeExtractedStatus(item.status);

    if (!status) {
      return [];
    }

    const primitiveValue =
      typeof item.value === "string" ||
      typeof item.value === "number" ||
      typeof item.value === "boolean" ||
      item.value === null
        ? item.value
        : null;

    return [{
      key: item.key,
      value: primitiveValue,
      evidence: nullableString(item.evidence),
      status
    }];
  });
}

function normalizeAttemptedActionsExtracted(
  value: unknown
): LiveMemoryTopicOptimized["sourceAnalyzeSupportText"]["attemptedActionsExtracted"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const status = normalizeExtractedStatus(item.status);

    if (!status) {
      return [];
    }

    return [{
      action: nullableString(item.action),
      outcome: nullableString(item.outcome),
      evidence: nullableString(item.evidence),
      status
    }];
  });
}

function normalizeSourceAnalyzeSupportText(
  value: unknown
): LiveMemoryTopicOptimized["sourceAnalyzeSupportText"] {
  if (!isRecord(value)) {
    return {
      caseDetailsExtracted: [],
      attemptedActionsExtracted: []
    };
  }

  return {
    caseDetailsExtracted: normalizeCaseDetailsExtracted(value.caseDetailsExtracted),
    attemptedActionsExtracted: normalizeAttemptedActionsExtracted(value.attemptedActionsExtracted)
  };
}

function normalizeSourceProposeTopicUpdates(
  value: unknown
): LiveMemoryTopicOptimized["sourceProposeTopicUpdates"] | null {
  if (!isRecord(value)) {
    return null;
  }

  const topicId = parseLiveMemoryTopicId(value.topicId);

  if (topicId === null) {
    return null;
  }

  const supportDomain = isRecord(value.supportDomain)
    ? value.supportDomain
    : {};

  return {
    topicId,
    title: nullableString(value.title),
    summaryTopic: nullableString(value.summaryTopic),
    supportDomain: {
      value: nullableString(supportDomain.value),
      reason: nullableString(supportDomain.reason)
    }
  };
}

function normalizeCurrentStep(
  value: unknown
): LiveMemoryTopicOptimized["sourceTopicManager"]["currentStep"] {
  if (
    value === "support_need_resolution" ||
    value === "basic_qualification" ||
    value === "retrieve_knowledge" ||
    value === "deep_qualification" ||
    value === "solution" ||
    value === "idle" ||
    value === null
  ) {
    return value;
  }

  return null;
}

function normalizeResolutionStatus(
  value: unknown
): LiveMemoryTopicOptimized["sourceTopicManager"]["resolutionStatus"] {
  if (!isRecord(value)) {
    return createEmptySourceTopicManager().resolutionStatus;
  }

  const statusValue = value.value === "solved_by_bot" || value.value === "unsolved"
    ? value.value
    : "in_progress";

  return {
    value: statusValue,
    reason: nullableString(value.reason)
  };
}

function normalizeTopicHandover(
  value: unknown
): LiveMemoryTopicOptimized["sourceTopicManager"]["handover"] {
  if (!isRecord(value)) {
    return createEmptySourceTopicManager().handover;
  }

  return {
    isRequested: value.isRequested === true,
    reason: nullableString(value.reason)
  };
}

function normalizeSupportNeed(
  value: unknown
): LiveMemoryTopicOptimized["sourceTopicManager"]["supportNeedResolution"] {
  if (!isRecord(value)) {
    return createEmptySourceTopicManager().supportNeedResolution;
  }

  const rawSupportNeed = isRecord(value.supportNeed)
    ? value.supportNeed
    : {};

  const supportNeedValue =
    rawSupportNeed.value === "issue_resolution" ||
    rawSupportNeed.value === "feature_request" ||
    rawSupportNeed.value === "knowledge_answer" ||
    rawSupportNeed.value === "support_action" ||
    rawSupportNeed.value === "unclear"
      ? rawSupportNeed.value
      : "unclear";

  return {
    supportNeed: {
      value: supportNeedValue,
      reason: nullableString(rawSupportNeed.reason)
    }
  };
}

function normalizeQualificationStatus(
  value: unknown
): "asking" | "obtained" | "user_declared_unavailable" | null {
  return value === "asking" ||
    value === "obtained" ||
    value === "user_declared_unavailable"
    ? value
    : null;
}

function normalizeQualificationItems(
  value: unknown
): Array<{
  key: string | null;
  reason: string | null;
  status: "asking" | "obtained" | "user_declared_unavailable";
}> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const status = normalizeQualificationStatus(item.status);

    if (!status) {
      return [];
    }

    return [{
      key: nullableString(item.key),
      reason: nullableString(item.reason),
      status
    }];
  });
}

function normalizeBasicQualification(
  value: unknown
): LiveMemoryTopicOptimized["sourceTopicManager"]["basicQualification"] {
  if (!isRecord(value)) {
    return createEmptySourceTopicManager().basicQualification;
  }

  return {
    isBuilt: value.isBuilt === true,
    isCompleted: value.isCompleted === true,
    caseDetailsToAskBecauseOfBasicQualification: normalizeQualificationItems(
      value.caseDetailsToAskBecauseOfBasicQualification
    )
  };
}

function normalizeDeepQualification(
  value: unknown
): LiveMemoryTopicOptimized["sourceTopicManager"]["deepQualification"] {
  if (!isRecord(value)) {
    return createEmptySourceTopicManager().deepQualification;
  }

  return {
    isBuilt: value.isBuilt === true,
    isCompleted: value.isCompleted === true,
    caseDetailsToAskBecauseOfDeepQualification: normalizeQualificationItems(
      value.caseDetailsToAskBecauseOfDeepQualification
    )
  };
}

function normalizeRetrieveKnowledge(
  value: unknown
): LiveMemoryTopicOptimized["sourceTopicManager"]["retrieveKnowledge"] {
  const fallback = createEmptySourceTopicManager().retrieveKnowledge;

  if (!isRecord(value)) {
    return fallback;
  }

  const rankedSearch = isRecord(value.rankedSearch) ? value.rankedSearch : {};
  const filter = isRecord(value.filter) ? value.filter : {};
  const selection = isRecord(value.selection) ? value.selection : {};
  const segmentationKnowledge = isRecord(value.segmentationKnowledge)
    ? value.segmentationKnowledge
    : {};

  return {
    isCompleted: normalizeRetrieveKnowledgeCompletionStatus(value.isCompleted),

    rankedSearch: {
      isSearched: rankedSearch.isSearched === true,
      rawRagKnowledge: rankedSearch.rawRagKnowledge ?? null
    },

    filter: {
      isFiltered: filter.isFiltered === true,
      filteredRagKnowledge: filter.filteredRagKnowledge ?? null,
      filterExplanation: nullableString(filter.filterExplanation)
    },

    selection: {
      isClearSelected: selection.isClearSelected === true,
      clarificationQuestion: nullableString(selection.clarificationQuestion),
      selectedfilteredRagKnowledge: selection.selectedfilteredRagKnowledge ?? null,
      selectionExplanation: nullableString(selection.selectionExplanation)
    },

    segmentationKnowledge: {
      isSegmented: segmentationKnowledge.isSegmented === true,
      userFacingInformation: nullableString(segmentationKnowledge.userFacingInformation),
      supportFacingInformation: nullableString(segmentationKnowledge.supportFacingInformation)
    }
  };
}

function normalizeRetrieveKnowledgeCompletionStatus(
  value: unknown
): boolean | "failed" {
  if (value === "failed") {
    return "failed";
  }

  return value === true;
}

function normalizeSolutionActionStatus(
  value: unknown
): "asking" | "succeeded" | "failed" | "user_declared_unavailable" | null {
  return value === "asking" ||
    value === "succeeded" ||
    value === "failed" ||
    value === "user_declared_unavailable"
    ? value
    : null;
}

function normalizeSolutionActions(
  value: unknown
): LiveMemoryTopicOptimized["sourceTopicManager"]["solution"]["attemptedActionsToAskBecauseOfSolutionFound"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const status = normalizeSolutionActionStatus(item.status);

    if (!status) {
      return [];
    }

    return [{
      action: nullableString(item.action),
      reason: nullableString(item.reason),
      status
    }];
  });
}

function normalizeSolution(
  value: unknown
): LiveMemoryTopicOptimized["sourceTopicManager"]["solution"] {
  if (!isRecord(value)) {
    return createEmptySourceTopicManager().solution;
  }

  return {
    isActionForUserBuilt: value.isActionForUserBuilt === true,
    isActionForSupportBuilt: value.isActionForSupportBuilt === true,
    isCompleted: value.isCompleted === true,
    attemptedActionsToAskBecauseOfSolutionFound: normalizeSolutionActions(
      value.attemptedActionsToAskBecauseOfSolutionFound
    ),
    actionToTakeForSupport: nullableString(value.actionToTakeForSupport)
  };
}

function normalizeIdleMode(
  value: unknown
): LiveMemoryTopicOptimized["sourceTopicManager"]["idleMode"] {
  if (!isRecord(value)) {
    return createEmptySourceTopicManager().idleMode;
  }

  return {
    isActivated: value.isActivated === true
  };
}

function normalizeSourceTopicManager(
  value: unknown
): LiveMemoryTopicOptimized["sourceTopicManager"] {
  if (!isRecord(value)) {
    return createEmptySourceTopicManager();
  }

  return {
    currentStep: normalizeCurrentStep(value.currentStep),
    resolutionStatus: normalizeResolutionStatus(value.resolutionStatus),
    handover: normalizeTopicHandover(value.handover),
    supportNeedResolution: normalizeSupportNeed(value.supportNeedResolution),
    basicQualification: normalizeBasicQualification(value.basicQualification),
    retrieveKnowledge: normalizeRetrieveKnowledge(value.retrieveKnowledge),
    deepQualification: normalizeDeepQualification(value.deepQualification),
    solution: normalizeSolution(value.solution),
    idleMode: normalizeIdleMode(value.idleMode)
  };
}

function normalizeTopic(value: unknown): LiveMemoryTopicOptimized | null {
  if (!isRecord(value)) {
    return null;
  }

  const sourceProposeTopicUpdates = normalizeSourceProposeTopicUpdates(
    value.sourceProposeTopicUpdates
  );

  if (!sourceProposeTopicUpdates) {
    return null;
  }

  return {
    status: normalizeTopicStatus(value.status),
    sourceAnalyzeSupportText: normalizeSourceAnalyzeSupportText(
      value.sourceAnalyzeSupportText
    ),
    sourceProposeTopicUpdates,
    sourceTopicManager: normalizeSourceTopicManager(value.sourceTopicManager)
  } satisfies LiveMemoryTopicOptimized;
}

function normalizeTopics(value: unknown): LiveMemoryContextOptimized["topics"] {
  if (!Array.isArray(value)) {
    return null;
  }

  const topics = value.flatMap((item) => {
    const normalized = normalizeTopic(item);

    return normalized ? [normalized] : [];
  });

  return topics.length > 0 ? topics : null;
}

function normalizeLiveMemoryContextOptimized(
  value: unknown
): LiveMemoryContextOptimized {
  if (!isRecord(value)) {
    return createEmptyLiveMemoryContextOptimized();
  }

  return {
    handover: normalizeHandover(value.handover),
    previousConversationTurn: normalizePreviousConversationTurn(
      value.previousConversationTurn
    ),
    failedPipelineMessages: normalizeFailedPipelineMessages(
      value.failedPipelineMessages
    ),
    securityAlerts: normalizeSecurityAlerts(value.securityAlerts),
    userState: normalizeUserState(value.userState),
    topics: normalizeTopics(value.topics)
  };
}

async function readLiveMemoryContext(
  conversationKey: string
): Promise<LiveMemoryContextOptimized | null> {
  const filePath = buildLiveMemoryContextPath(conversationKey);

  try {
    const rawContent = await fs.readFile(filePath, "utf8");

    return normalizeLiveMemoryContextOptimized(JSON.parse(rawContent));
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      (error as {code?: unknown}).code === "ENOENT"
    ) {
      return null;
    }

    throw error;
  }
}

async function writeLiveMemoryContext(
  conversationKey: string,
  context: LiveMemoryContextOptimized
): Promise<void> {
  const filePath = buildLiveMemoryContextPath(conversationKey);
  const directory = path.dirname(filePath);
  const temporaryFilePath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`
  );

  await fs.mkdir(directory, {recursive: true});
  await fs.writeFile(
    temporaryFilePath,
    `${JSON.stringify(normalizeLiveMemoryContextOptimized(context), null, 2)}\n`,
    "utf8"
  );
  await fs.rename(temporaryFilePath, filePath);
}

export {
  buildLiveMemoryContextPath,
  getLiveMemoryContextDirectory,
  normalizeLiveMemoryContextOptimized,
  readLiveMemoryContext,
  writeLiveMemoryContext
};
