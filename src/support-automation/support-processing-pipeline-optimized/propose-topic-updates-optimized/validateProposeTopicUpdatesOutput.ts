import {formatCatalogSelection} from "./catalogSelection";

import type {
  AnalyzeSupportTextAttemptedAction,
  AnalyzeSupportTextCaseDetail,
  AnalyzeSupportTextOther
} from "../analyze-support-text-optimized/runAnalyzeSupportText";
import type {LiveMemoryTopicOptimized} from "../../../infrastructure/live-memory/liveMemoryContextOptimized.template";

type TopicUpdatePlan = {
  topicId: number | null;
  sourceCaseDetailIds: string[];
  sourceAttemptedActionIds: string[];
  sourceOtherIds: string[];
  title: string | null;
  summaryTopic: string | null;
  supportDomain: {
    value: string | null;
    reason: string | null;
  };
};

type ValidateProposeTopicUpdatesParams = {
  existingTopics: LiveMemoryTopicOptimized[];
  caseDetailsExtracted: AnalyzeSupportTextCaseDetail[];
  attemptedActionsExtracted: AnalyzeSupportTextAttemptedAction[];
  otherExtracted: AnalyzeSupportTextOther[];
};

// Validation policy:
// - malformed top-level JSON returns null;
// - malformed or useless plans are ignored;
// - unknown fact ids are ignored;
// - duplicate ids are deduplicated;
// - the same fact id may be routed to several topics;
// - invalid existing topic ids make only that plan invalid;
// - invalid supportDomain is normalized to null, not a global fallback.
function validateProposeTopicUpdatesOutput(
  parsedResponse: unknown,
  params: ValidateProposeTopicUpdatesParams
): TopicUpdatePlan[] | null {
  if (!isRecord(parsedResponse)) return null;

  const rawPlans = Array.isArray(parsedResponse.topicUpdatePlans)
    ? parsedResponse.topicUpdatePlans
    : [];

  const existingTopicById = new Map(
    params.existingTopics.map((topic) => [
      topic.sourceProposeTopicUpdates.topicId,
      topic
    ])
  );

  const validCaseDetailIds = new Set(
    params.caseDetailsExtracted.map((fact) => fact.caseDetailId)
  );

  const validAttemptedActionIds = new Set(
    params.attemptedActionsExtracted.map((fact) => fact.attemptedActionId)
  );

  const validOtherIds = new Set(
    params.otherExtracted.map((fact) => fact.otherId)
  );

  const existingTopicPlans = new Map<number, TopicUpdatePlan>();
  const newTopicPlans: TopicUpdatePlan[] = [];

  for (const rawPlan of rawPlans) {
    const plan = validatePlan({
      rawPlan,
      existingTopicById,
      validCaseDetailIds,
      validAttemptedActionIds,
      validOtherIds
    });

    if (!plan) continue;

    if (typeof plan.topicId === "number") {
      const existing = existingTopicPlans.get(plan.topicId);

      if (existing) {
        existingTopicPlans.set(plan.topicId, mergePlans(existing, plan));
      } else {
        existingTopicPlans.set(plan.topicId, plan);
      }

      continue;
    }

    newTopicPlans.push(plan);
  }

  return [
    ...existingTopicPlans.values(),
    ...newTopicPlans
  ];
}

function validatePlan(params: {
  rawPlan: unknown;
  existingTopicById: Map<number, LiveMemoryTopicOptimized>;
  validCaseDetailIds: Set<string>;
  validAttemptedActionIds: Set<string>;
  validOtherIds: Set<string>;
}): TopicUpdatePlan | null {
  if (!isRecord(params.rawPlan)) return null;

  const topicId = validateTopicId(
    params.rawPlan.topicId,
    params.existingTopicById
  );

  if (topicId === undefined) return null;

  const sourceCaseDetailIds = validateSourceIds(
    params.rawPlan.sourceCaseDetailIds,
    params.validCaseDetailIds
  );

  const sourceAttemptedActionIds = validateSourceIds(
    params.rawPlan.sourceAttemptedActionIds,
    params.validAttemptedActionIds
  );

  const sourceOtherIds = validateSourceIds(
    params.rawPlan.sourceOtherIds,
    params.validOtherIds
  );

  if (
    sourceCaseDetailIds.length === 0 &&
    sourceAttemptedActionIds.length === 0 &&
    sourceOtherIds.length === 0
  ) {
    return null;
  }

  const existingTopic = typeof topicId === "number"
    ? params.existingTopicById.get(topicId) ?? null
    : null;

  const title = validateNullableText(params.rawPlan.title)
    ?? existingTopic?.sourceProposeTopicUpdates.title
    ?? null;

  const summaryTopic = validateNullableText(params.rawPlan.summaryTopic)
    ?? existingTopic?.sourceProposeTopicUpdates.summaryTopic
    ?? null;

  const supportDomain = validateSupportDomain(params.rawPlan.supportDomain)
    ?? existingTopic?.sourceProposeTopicUpdates.supportDomain
    ?? {value: null, reason: null};

  return {
    topicId,
    sourceCaseDetailIds,
    sourceAttemptedActionIds,
    sourceOtherIds,
    title,
    summaryTopic,
    supportDomain
  };
}

function validateSourceIds(
  value: unknown,
  validIds: Set<string>
): string[] {
  if (!Array.isArray(value)) return [];

  const sourceIds: string[] = [];
  const seen = new Set<string>();

  for (const rawId of value) {
    if (typeof rawId !== "string") continue;

    const id = rawId.trim();

    if (id === "") continue;
    if (!validIds.has(id)) continue;
    if (seen.has(id)) continue;

    seen.add(id);
    sourceIds.push(id);
  }

  return sourceIds;
}

function validateTopicId(
  value: unknown,
  existingTopicById: Map<number, LiveMemoryTopicOptimized>
): number | null | undefined {
  if (value === null) return null;
  if (!isPositiveInteger(value)) return undefined;

  return existingTopicById.has(value) ? value : undefined;
}

function validateSupportDomain(
  value: unknown
): TopicUpdatePlan["supportDomain"] | null {
  if (!isRecord(value)) return null;

  const domainValue = validateNullableEnumValue(
    value.value,
    formatCatalogSelection.supportDomains
  );

  return {
    value: domainValue,
    reason: validateNullableText(value.reason)
  };
}

function mergePlans(
  left: TopicUpdatePlan,
  right: TopicUpdatePlan
): TopicUpdatePlan {
  return {
    topicId: left.topicId,
    sourceCaseDetailIds: mergeIds(left.sourceCaseDetailIds, right.sourceCaseDetailIds),
    sourceAttemptedActionIds: mergeIds(left.sourceAttemptedActionIds, right.sourceAttemptedActionIds),
    sourceOtherIds: mergeIds(left.sourceOtherIds, right.sourceOtherIds),
    title: right.title ?? left.title,
    summaryTopic: right.summaryTopic ?? left.summaryTopic,
    supportDomain: right.supportDomain.value ? right.supportDomain : left.supportDomain
  };
}

function mergeIds(left: readonly string[], right: readonly string[]): string[] {
  return [...new Set([...left, ...right])];
}

function validateNullableText(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();

  return trimmed === "" ? null : trimmed;
}

function validateNullableEnumValue(
  value: unknown,
  allowedValues: readonly string[]
): string | null {
  if (value === null) return null;
  if (typeof value !== "string") return null;

  return allowedValues.includes(value) ? value : null;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export {
  validateProposeTopicUpdatesOutput
};

export type {
  TopicUpdatePlan,
  ValidateProposeTopicUpdatesParams
};