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
  LiveMemoryIssueBasicQualification,
  LiveMemoryIssueDeepQualification,
  LiveMemoryIssueIdle,
  LiveMemoryIssueRetrieveKnowledge,
  LiveMemoryIssueSolution,
  LiveMemoryTopicOptimized
} from "./liveMemoryContextOptimized.template";
import type {KnowledgeMemoryRetrieval} from "./knowledgeMemory.template";
import type {RawRagKnowledge} from "../../support-automation/support-processing-pipeline-optimized/topic-manager/topic-treatement/issue-resolution-branch/retrieve-knowledge/ranked-search/runRankedSearch--oneShotStep";

const DEFAULT_LIVE_MEMORY_CONTEXT_DIR = path.resolve("data/live-memory-context");

type JsonRecord = Record<string, unknown>;
type NormalizeRetrieveKnowledgeResult = {
  retrieveKnowledge: LiveMemoryIssueRetrieveKnowledge;
  legacyRetrieval: KnowledgeMemoryRetrieval | null;
};

const legacyKnowledgeRetrievalsByContext =
  new WeakMap<LiveMemoryContextOptimized, KnowledgeMemoryRetrieval[]>();

function getLiveMemoryContextDirectory(): string {
  return process.env.LIVE_MEMORY_CONTEXT_DIR ?? DEFAULT_LIVE_MEMORY_CONTEXT_DIR;
}

function getLegacyLiveMemoryFilePath(conversationKey: string): string {
  return path.join(getLiveMemoryContextDirectory(), `${conversationKey}.json`);
}

function getConversationMemoryDirectoryPath(conversationKey: string): string {
  return path.join(getLiveMemoryContextDirectory(), conversationKey);
}

function getStateMemoryFilePath(conversationKey: string): string {
  return path.join(
    getConversationMemoryDirectoryPath(conversationKey),
    "state-memory.json"
  );
}

function getConversationMemoryFilePath(conversationKey: string): string {
  return path.join(
    getConversationMemoryDirectoryPath(conversationKey),
    "conversation-memory.json"
  );
}

function getKnowledgeMemoryFilePath(conversationKey: string): string {
  return path.join(
    getConversationMemoryDirectoryPath(conversationKey),
    "knowledge-memory.json"
  );
}

function buildLiveMemoryContextPath(conversationKey: string): string {
  return getStateMemoryFilePath(conversationKey);
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

function normalizeIsBotActive(value: unknown): boolean {
  return typeof value === "boolean" ? value : true;
}

function normalizeHandover(value: unknown): LiveMemoryContextOptimized["handover"] {
  if (!isRecord(value)) {
    return createEmptyLiveMemoryContextOptimized().handover;
  }

  return {
    isHandover: value.isHandover === true,
    handoverReason: nullableString(value.handoverReason)
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
): LiveMemoryIssueBasicQualification {
  if (!isRecord(value)) {
    return createEmptySourceTopicManager().workflows.issueResolution.basicQualification;
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
): LiveMemoryIssueDeepQualification {
  if (!isRecord(value)) {
    return createEmptySourceTopicManager().workflows.issueResolution.deepQualification;
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
  value: unknown,
  topicId: number
): NormalizeRetrieveKnowledgeResult {
  const fallback = createEmptySourceTopicManager().workflows.issueResolution.retrieveKnowledge;

  if (!isRecord(value)) {
    return {
      retrieveKnowledge: fallback,
      legacyRetrieval: null
    };
  }

  const rankedSearch = isRecord(value.rankedSearch) ? value.rankedSearch : {};
  const filter = isRecord(value.filter) ? value.filter : {};
  const selection = isRecord(value.selection) ? value.selection : {};
  const segmentationKnowledge = isRecord(value.segmentationKnowledge)
    ? value.segmentationKnowledge
    : {};
  const legacyRawRagKnowledge = normalizeLegacyRawRagKnowledge(
    rankedSearch.rawRagKnowledge
  );
  const legacySegmentedKnowledge = normalizeSegmentedKnowledge(
    segmentationKnowledge.segmentedKnowledge
  );
  const hasLegacyKnowledge =
    legacyRawRagKnowledge !== null || legacySegmentedKnowledge.length > 0;
  const legacyRetrievalId = hasLegacyKnowledge
    ? `retrieval_${randomUUID()}`
    : null;

  return {
    retrieveKnowledge: {
    isCompleted: normalizeRetrieveKnowledgeCompletionStatus(value.isCompleted),
    activeRetrievalId: nullableString(value.activeRetrievalId) ?? legacyRetrievalId,
    retrievalIds: normalizeRetrievalIds(
      value.retrievalIds,
      legacyRetrievalId
    ),

    rankedSearch: {
      isSearched: rankedSearch.isSearched === true
    },

    filter: {
      isFiltered: filter.isFiltered === true,
      keptRawKnowledgeIds: stringArray(filter.keptRawKnowledgeIds),
      filterExplanation: nullableString(filter.filterExplanation)
    },

    selection: {
      isClearSelected: selection.isClearSelected === true,
      clarificationQuestion: nullableString(selection.clarificationQuestion),
      selectedRawKnowledgeIds: stringArray(selection.selectedRawKnowledgeIds),
      selectionExplanation: nullableString(selection.selectionExplanation)
    },

    segmentationKnowledge: {
      isSegmented: segmentationKnowledge.isSegmented === true
    }
    },
    legacyRetrieval: legacyRetrievalId === null
      ? null
      : {
        retrievalId: legacyRetrievalId,
        topicId,
        workflow: "issueResolution",
        rawRagKnowledge: legacyRawRagKnowledge,
        segmentedKnowledge: legacySegmentedKnowledge
      }
  };
}

function normalizeSegmentedKnowledge(
  value: unknown
): KnowledgeMemoryRetrieval["segmentedKnowledge"] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seenRawKnowledgeIds = new Set<string>();
  const segmentedKnowledge: KnowledgeMemoryRetrieval["segmentedKnowledge"] = [];

  for (const rawSource of value) {
    if (!isRecord(rawSource)) continue;

    const rawKnowledgeId = nullableString(rawSource.rawKnowledgeId);
    if (!rawKnowledgeId || seenRawKnowledgeIds.has(rawKnowledgeId)) continue;

    seenRawKnowledgeIds.add(rawKnowledgeId);
    segmentedKnowledge.push({
      rawKnowledgeId,
      userFacingKnowledge: normalizeSegmentedKnowledgePieces(rawSource.userFacingKnowledge),
      supportFacingKnowledge: normalizeSegmentedKnowledgePieces(rawSource.supportFacingKnowledge)
    });
  }

  return segmentedKnowledge;
}

function normalizeSegmentedKnowledgePieces(
  value: unknown
): KnowledgeMemoryRetrieval["segmentedKnowledge"][number]["userFacingKnowledge"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((rawPiece) => {
    if (!isRecord(rawPiece)) return [];

    const text = nullableString(rawPiece.text);
    if (!text) return [];

    return [
      {
        text,
        sourceHint: nullableString(rawPiece.sourceHint),
        sourceSpan: nullableString(rawPiece.sourceSpan)
      }
    ];
  });
}

function normalizeRetrievalIds(
  value: unknown,
  legacyRetrievalId: string | null
): string[] {
  const retrievalIds = stringArray(value);

  if (legacyRetrievalId && !retrievalIds.includes(legacyRetrievalId)) {
    return [...retrievalIds, legacyRetrievalId];
  }

  return retrievalIds;
}

function normalizeLegacyRawRagKnowledge(value: unknown): RawRagKnowledge | null {
  if (!isRecord(value)) {
    return null;
  }

  const query = nullableString(value.query);
  const content = nullableString(value.content);
  const metadata = isRecord(value.metadata) && value.metadata.retriever === "openrag"
    ? {retriever: "openrag" as const}
    : null;

  if (!query || !content || !metadata) {
    return null;
  }

  return {
    query,
    content,
    candidates: normalizeLegacyRawKnowledgeCandidates(value.candidates),
    sources: Array.isArray(value.sources) ? value.sources : [],
    metadata
  };
}

function normalizeLegacyRawKnowledgeCandidates(
  value: unknown
): RawRagKnowledge["candidates"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((candidate) => {
    if (!isRecord(candidate)) {
      return [];
    }

    const rawKnowledgeId = nullableString(candidate.rawKnowledgeId);
    const rawKnowledge = nullableString(candidate.rawKnowledge);

    if (!rawKnowledgeId || !rawKnowledge) {
      return [];
    }

    return [{
      rawKnowledgeId,
      rawKnowledge,
      whyPotentiallyRelevant: nullableString(candidate.whyPotentiallyRelevant),
      sourceHint: nullableString(candidate.sourceHint)
    }];
  });
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

function normalizeSolutionCaseDetailStatus(
  value: unknown
): "asking" | "obtained" | "user_declared_unavailable" | null {
  return value === "asking" ||
    value === "obtained" ||
    value === "user_declared_unavailable"
    ? value
    : null;
}

function normalizeSolutionActions(
  value: unknown
): LiveMemoryIssueSolution["attemptedActionsToAskBecauseOfSolutionFound"] {
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

function normalizeSolutionCaseDetails(
  value: unknown
): LiveMemoryIssueSolution["caseDetailsToAskBecauseOfSolutionFound"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const key = nullableString(item.key);
    const question = nullableString(item.question);
    const status = normalizeSolutionCaseDetailStatus(item.status);

    if (!key || !question || !status) {
      return [];
    }

    return [{
      key,
      question,
      reason: nullableString(item.reason),
      status
    }];
  });
}

function normalizeSolution(
  value: unknown
): LiveMemoryIssueSolution {
  if (!isRecord(value)) {
    return createEmptySourceTopicManager().workflows.issueResolution.solution;
  }

  return {
    isActionForUserBuilt: value.isActionForUserBuilt === true,
    isActionForSupportBuilt: value.isActionForSupportBuilt === true,
    isCaseDetailsForSolutionBuilt: value.isCaseDetailsForSolutionBuilt === true,
    isCompleted: value.isCompleted === true,
    attemptedActionsToAskBecauseOfSolutionFound: normalizeSolutionActions(
      value.attemptedActionsToAskBecauseOfSolutionFound
    ),
    caseDetailsToAskBecauseOfSolutionFound: normalizeSolutionCaseDetails(
      value.caseDetailsToAskBecauseOfSolutionFound
    ),
    actionToTakeForSupport: nullableString(value.actionToTakeForSupport)
  };
}

function normalizeIdle(
  value: unknown
): LiveMemoryIssueIdle {
  if (!isRecord(value)) {
    return createEmptySourceTopicManager().workflows.issueResolution.idle;
  }

  return {
    isActivated: value.isActivated === true
  };
}

function normalizeWorkflows(
  value: unknown,
  legacySourceTopicManager: JsonRecord,
  topicId: number
): {
  workflows: LiveMemoryTopicOptimized["sourceTopicManager"]["workflows"];
  legacyRetrievals: KnowledgeMemoryRetrieval[];
} {
  const workflows = isRecord(value) ? value : {};
  const issueResolution = isRecord(workflows.issueResolution)
    ? workflows.issueResolution
    : {};
  const knowledgeAnswer = isRecord(workflows.knowledgeAnswer)
    ? workflows.knowledgeAnswer
    : {};
  const supportAction = isRecord(workflows.supportAction)
    ? workflows.supportAction
    : {};
  const featureRequest = isRecord(workflows.featureRequest)
    ? workflows.featureRequest
    : {};
  const retrieveKnowledgeResult = normalizeRetrieveKnowledge(
    pickNewFieldOrLegacy(issueResolution.retrieveKnowledge, legacySourceTopicManager.retrieveKnowledge),
    topicId
  );

  return {
    workflows: {
    issueResolution: {
      basicQualification: normalizeBasicQualification(
        pickNewFieldOrLegacy(issueResolution.basicQualification, legacySourceTopicManager.basicQualification)
      ),
      retrieveKnowledge: retrieveKnowledgeResult.retrieveKnowledge,
      solution: normalizeSolution(
        pickNewFieldOrLegacy(issueResolution.solution, legacySourceTopicManager.solution)
      ),
      deepQualification: normalizeDeepQualification(
        pickNewFieldOrLegacy(issueResolution.deepQualification, legacySourceTopicManager.deepQualification)
      ),
      idle: normalizeIdle(
        pickNewFieldOrLegacy(issueResolution.idle, legacySourceTopicManager.idleMode)
      )
    },
    knowledgeAnswer: {
      idle: normalizeIdle(knowledgeAnswer.idle)
    },
    supportAction: {
      idle: normalizeIdle(supportAction.idle)
    },
    featureRequest: {
      idle: normalizeIdle(featureRequest.idle)
    }
    },
    legacyRetrievals: retrieveKnowledgeResult.legacyRetrieval
      ? [retrieveKnowledgeResult.legacyRetrieval]
      : []
  };
}

function pickNewFieldOrLegacy(newValue: unknown, legacyValue: unknown): unknown {
  return isRecord(newValue) ? newValue : legacyValue;
}

function normalizeSourceTopicManager(
  value: unknown,
  topicId: number
): {
  sourceTopicManager: LiveMemoryTopicOptimized["sourceTopicManager"];
  legacyRetrievals: KnowledgeMemoryRetrieval[];
} {
  if (!isRecord(value)) {
    return {
      sourceTopicManager: createEmptySourceTopicManager(),
      legacyRetrievals: []
    };
  }
  const workflowResult = normalizeWorkflows(value.workflows, value, topicId);

  return {
    sourceTopicManager: {
      supportNeedResolution: normalizeSupportNeed(value.supportNeedResolution),
      workflows: workflowResult.workflows
    },
    legacyRetrievals: workflowResult.legacyRetrievals
  };
}

function normalizeTopic(value: unknown): {
  topic: LiveMemoryTopicOptimized;
  legacyRetrievals: KnowledgeMemoryRetrieval[];
} | null {
  if (!isRecord(value)) {
    return null;
  }

  const sourceProposeTopicUpdates = normalizeSourceProposeTopicUpdates(
    value.sourceProposeTopicUpdates
  );

  if (!sourceProposeTopicUpdates) {
    return null;
  }
  const sourceTopicManagerResult = normalizeSourceTopicManager(
    value.sourceTopicManager,
    sourceProposeTopicUpdates.topicId
  );

  return {
    topic: {
      status: normalizeTopicStatus(value.status),
      sourceAnalyzeSupportText: normalizeSourceAnalyzeSupportText(
        value.sourceAnalyzeSupportText
      ),
      sourceProposeTopicUpdates,
      sourceTopicManager: sourceTopicManagerResult.sourceTopicManager
    } satisfies LiveMemoryTopicOptimized,
    legacyRetrievals: sourceTopicManagerResult.legacyRetrievals
  };
}

function normalizeTopics(value: unknown): {
  topics: LiveMemoryContextOptimized["topics"];
  legacyRetrievals: KnowledgeMemoryRetrieval[];
} {
  if (!Array.isArray(value)) {
    return {
      topics: null,
      legacyRetrievals: []
    };
  }

  const normalizedTopics = value.flatMap((item) => {
    const normalized = normalizeTopic(item);

    return normalized ? [normalized] : [];
  });
  const topics = normalizedTopics.map((normalized) => normalized.topic);

  return {
    topics: topics.length > 0 ? topics : null,
    legacyRetrievals: normalizedTopics.flatMap((normalized) => {
      return normalized.legacyRetrievals;
    })
  };
}

function buildTopicsSummary(
  topics: LiveMemoryTopicOptimized[] | null
): LiveMemoryContextOptimized["topicsSummary"] {
  const normalizedTopics = [...(topics ?? [])].sort((first, second) => {
    return first.sourceProposeTopicUpdates.topicId -
      second.sourceProposeTopicUpdates.topicId;
  });

  const byStatus = {
    in_progress: 0,
    solved_by_bot: 0,
    unsolved: 0
  };

  for (const topic of normalizedTopics) {
    byStatus[topic.status] += 1;
  }

  return {
    total: normalizedTopics.length,
    byStatus,
    topics: normalizedTopics.map((topic) => {
      const supportNeed = topic.sourceTopicManager.supportNeedResolution.supportNeed.value;

      return {
        topicId: topic.sourceProposeTopicUpdates.topicId,
        title: topic.sourceProposeTopicUpdates.title,
        status: topic.status,
        supportNeed: typeof supportNeed === "string" && supportNeed.trim() !== ""
          ? supportNeed
          : null
      };
    })
  };
}

function normalizeLiveMemoryContextOptimized(
  value: unknown
): LiveMemoryContextOptimized {
  if (!isRecord(value)) {
    return createEmptyLiveMemoryContextOptimized();
  }

  const topicsResult = normalizeTopics(value.topics);

  const context = {
    isBotActive: normalizeIsBotActive(value.isBotActive),
    topicsSummary: buildTopicsSummary(topicsResult.topics),
    handover: normalizeHandover(value.handover),
    previousConversationTurn: normalizePreviousConversationTurn(
      value.previousConversationTurn
    ),
    failedPipelineMessages: normalizeFailedPipelineMessages(
      value.failedPipelineMessages
    ),
    securityAlerts: normalizeSecurityAlerts(value.securityAlerts),
    userState: normalizeUserState(value.userState),
    topics: topicsResult.topics
  };

  if (topicsResult.legacyRetrievals.length > 0) {
    legacyKnowledgeRetrievalsByContext.set(
      context,
      topicsResult.legacyRetrievals
    );
  }

  return context;
}

async function readJsonFileIfExists(filePath: string): Promise<unknown | null> {
  try {
    const rawContent = await fs.readFile(filePath, "utf8");

    return JSON.parse(rawContent);
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

async function ensureJsonFile(filePath: string, value: unknown): Promise<void> {
  try {
    await fs.writeFile(
      filePath,
      `${JSON.stringify(value, null, 2)}\n`,
      {
        encoding: "utf8",
        flag: "wx"
      }
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      (error as {code?: unknown}).code === "EEXIST"
    ) {
      return;
    }

    throw error;
  }
}

async function ensureConversationMemoryFile(
  conversationKey: string
): Promise<void> {
  await ensureJsonFile(
    getConversationMemoryFilePath(conversationKey),
    {messages: []}
  );
}

async function ensureKnowledgeMemoryFile(
  conversationKey: string
): Promise<void> {
  await ensureJsonFile(
    getKnowledgeMemoryFilePath(conversationKey),
    {retrievals: []}
  );
}

async function readLiveMemoryContext(
  conversationKey: string
): Promise<LiveMemoryContextOptimized | null> {
  const stateMemory = await readJsonFileIfExists(
    getStateMemoryFilePath(conversationKey)
  );

  if (stateMemory !== null) {
    return normalizeLiveMemoryContextOptimized(stateMemory);
  }

  const legacyMemory = await readJsonFileIfExists(
    getLegacyLiveMemoryFilePath(conversationKey)
  );

  if (legacyMemory !== null) {
    return normalizeLiveMemoryContextOptimized(legacyMemory);
  }

  return null;
}

async function writeLiveMemoryContext(
  conversationKey: string,
  context: LiveMemoryContextOptimized
): Promise<void> {
  const conversationDirectory =
    getConversationMemoryDirectoryPath(conversationKey);
  const filePath = getStateMemoryFilePath(conversationKey);
  const temporaryFilePath = path.join(
    conversationDirectory,
    `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`
  );

  await fs.mkdir(conversationDirectory, {recursive: true});
  await ensureConversationMemoryFile(conversationKey);
  await ensureKnowledgeMemoryFile(conversationKey);
  await fs.writeFile(
    temporaryFilePath,
    `${JSON.stringify(normalizeLiveMemoryContextOptimized(context), null, 2)}\n`,
    "utf8"
  );
  await fs.rename(temporaryFilePath, filePath);
}

function consumeLegacyKnowledgeRetrievals(
  context: LiveMemoryContextOptimized
): KnowledgeMemoryRetrieval[] {
  const retrievals = legacyKnowledgeRetrievalsByContext.get(context) ?? [];
  legacyKnowledgeRetrievalsByContext.delete(context);

  return retrievals;
}

export {
  buildTopicsSummary,
  buildLiveMemoryContextPath,
  consumeLegacyKnowledgeRetrievals,
  getConversationMemoryDirectoryPath,
  getConversationMemoryFilePath,
  getLiveMemoryContextDirectory,
  getKnowledgeMemoryFilePath,
  getLegacyLiveMemoryFilePath,
  getStateMemoryFilePath,
  normalizeLiveMemoryContextOptimized,
  readLiveMemoryContext,
  writeLiveMemoryContext
};
