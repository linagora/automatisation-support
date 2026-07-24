import {formatCatalogSelection} from "./catalogSelection";

import type {AnalyzeSupportTextUnderstanding} from "../../support-processing-pipeline-optimized/analyze-support-text-optimized/runAnalyzeSupportText";
import type {LiveMemoryTopicOptimized} from "../../infrastructure/live-memory/liveMemoryContextOptimized.template";

type TopicUpdatePlan = {
  topicId: number | null;
  sourceUnderstandingIds: string[];
  title: string | null;
  summaryTopic: string | null;
  supportDomain: {
    value: string | null;
    reason: string | null;
  };
};

// LLM output validation:
// Validates the parsed JSON returned by the optimized topic update proposal LLM.
// This file does not call the LLM, build prompts, repair output, or decide fallbacks.
function validateProposeTopicUpdatesOutput(
  parsedResponse: unknown,
  params: {
    existingTopics: LiveMemoryTopicOptimized[];
    understandings: AnalyzeSupportTextUnderstanding[];
  }
): TopicUpdatePlan[] | null {
  if (!isRecord(parsedResponse)) return null;
  if (!hasOnlyKeys(parsedResponse, ["topicUpdatePlans"])) return null;
  if (!Array.isArray(parsedResponse.topicUpdatePlans)) return null;

  const understandingById = new Map(
    params.understandings.map((understanding) => [understanding.understandingId, understanding])
  );
  const existingTopicIds = new Set(
    params.existingTopics.map((topic) => topic.sourceProposeTopicUpdates.topicId)
  );
  const coveredUnderstandingIds = new Set<string>();
  const plans: TopicUpdatePlan[] = [];

  for (const rawPlan of parsedResponse.topicUpdatePlans) {
    const plan = validatePlan({
      rawPlan,
      understandingById,
      existingTopicIds,
      coveredUnderstandingIds
    });

    if (!plan) return null;

    plans.push(plan);
  }

  return hasPersistableUnderstandingCoverage({
    coveredUnderstandingIds,
    understandings: params.understandings
  })
    ? plans
    : null;
}

function validatePlan(params: {
  rawPlan: unknown;
  understandingById: Map<string, AnalyzeSupportTextUnderstanding>;
  existingTopicIds: Set<number>;
  coveredUnderstandingIds: Set<string>;
}): TopicUpdatePlan | null {
  if (!isRecord(params.rawPlan)) return null;
  if (!hasOnlyKeys(params.rawPlan, [
    "topicId",
    "sourceUnderstandingIds",
    "title",
    "summaryTopic",
    "supportDomain"
  ])) return null;

  const sourceUnderstandingIds = validateSourceUnderstandingIds({
    value: params.rawPlan.sourceUnderstandingIds,
    understandingById: params.understandingById,
    coveredUnderstandingIds: params.coveredUnderstandingIds
  });

  if (!sourceUnderstandingIds) return null;

  const topicId = validateTopicId(params.rawPlan.topicId, params.existingTopicIds);
  const title = validateNullableText(params.rawPlan.title);
  const summaryTopic = validateNullableText(params.rawPlan.summaryTopic);
  const supportDomain = validateSupportDomain(params.rawPlan.supportDomain);

  if (topicId === undefined || title === undefined || summaryTopic === undefined || !supportDomain) {
    return null;
  }

  return {
    topicId,
    sourceUnderstandingIds,
    title,
    summaryTopic,
    supportDomain
  };
}

function validateSourceUnderstandingIds(params: {
  value: unknown;
  understandingById: Map<string, AnalyzeSupportTextUnderstanding>;
  coveredUnderstandingIds: Set<string>;
}): string[] | null {
  if (!Array.isArray(params.value) || params.value.length === 0) return null;

  const planSeen = new Set<string>();
  const sourceUnderstandingIds: string[] = [];

  for (const rawId of params.value) {
    if (typeof rawId !== "string" || rawId.trim() === "") return null;
    if (!params.understandingById.has(rawId)) return null;
    if (planSeen.has(rawId)) return null;
    if (params.coveredUnderstandingIds.has(rawId)) return null;

    planSeen.add(rawId);
    params.coveredUnderstandingIds.add(rawId);
    sourceUnderstandingIds.push(rawId);
  }

  return sourceUnderstandingIds;
}

function validateTopicId(value: unknown, existingTopicIds: Set<number>): number | null | undefined {
  if (value === null) return null;
  if (!isPositiveInteger(value)) return undefined;
  return existingTopicIds.has(value) ? value : undefined;
}

function validateNullableText(value: unknown): string | null | undefined {
  if (value === null) return null;
  return validateRequiredText(value) ?? undefined;
}

function validateRequiredText(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function validateSupportDomain(value: unknown): TopicUpdatePlan["supportDomain"] | null {
  if (!isRecord(value)) return null;
  if (!hasOnlyKeys(value, ["value", "reason"])) return null;

  const domainValue = validateNullableEnumValue(value.value, formatCatalogSelection.supportDomains);
  const reason = validateNullableText(value.reason);

  if (domainValue === undefined || reason === undefined) return null;

  return {
    value: domainValue,
    reason
  };
}

function hasPersistableUnderstandingCoverage(params: {
  coveredUnderstandingIds: Set<string>;
  understandings: AnalyzeSupportTextUnderstanding[];
}): boolean {
  return params.understandings.every((understanding) => {
    if (!isPersistableUnderstanding(understanding)) return true;
    return params.coveredUnderstandingIds.has(understanding.understandingId);
  });
}

function isPersistableUnderstanding(understanding: AnalyzeSupportTextUnderstanding): boolean {
  const {attemptedActionsExtracted} = understanding;

  return understanding.caseDetailsExtracted.length > 0 ||
    attemptedActionsExtracted.length > 0 ||
    understanding.other.length > 0 ||
    understanding.summaryMessage.trim().length > 0;
}

function validateEnumValue(value: unknown, allowedValues: readonly string[]): string | null {
  return typeof value === "string" && allowedValues.includes(value) ? value : null;
}

function validateNullableEnumValue(value: unknown, allowedValues: readonly string[]): string | null | undefined {
  if (value === null) return null;
  return validateEnumValue(value, allowedValues) ?? undefined;
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: string[]): boolean {
  const allowedKeySet = new Set(allowedKeys);
  return Object.keys(value).every((key) => allowedKeySet.has(key));
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
  TopicUpdatePlan
};
