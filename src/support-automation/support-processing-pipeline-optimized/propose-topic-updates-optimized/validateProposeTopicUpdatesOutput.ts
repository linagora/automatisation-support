import {formatCatalogSelection} from "./catalogSelection";

import type {AnalyzeSupportTextUnderstanding} from "../../support-processing-pipeline-optimized/analyze-support-text-optimized/runAnalyzeSupportText";

type ExistingSupportTopic = {
  topicId: number;
  title?: string;
  summary?: string;
  supportDomain?: string | null;
  extractedFields?: unknown[];
  attemptedActions?: unknown[];
};

type ProposedTopicIdentity = {
  title: string | null;
  supportDomain: string | null;
  summary: string | null;
};

type TopicUpdatePlan = {
  operation: "update" | "create";
  sourceUnderstandingIds: string[];
  targetTopicId: number | null;
  topicIdentity: ProposedTopicIdentity;
};

// LLM output validation:
// Validates the parsed JSON returned by the optimized topic update proposal LLM.
// This file does not call the LLM, build prompts, repair output, or decide fallbacks.
function validateProposeTopicUpdatesOutput(
  parsedResponse: unknown,
  params: {
    existingTopics: ExistingSupportTopic[];
    understandings: AnalyzeSupportTextUnderstanding[];
  }
): TopicUpdatePlan[] | null {
  if (!isRecord(parsedResponse)) return null;
  if (!hasOnlyKeys(parsedResponse, ["topicUpdatePlans"])) return null;
  if (!Array.isArray(parsedResponse.topicUpdatePlans)) return null;

  const understandingById = new Map(
    params.understandings.map((understanding) => [understanding.understandingId, understanding])
  );
  const existingTopicIds = new Set(params.existingTopics.map((topic) => topic.topicId));
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
    "operation",
    "sourceUnderstandingIds",
    "targetTopicId",
    "topicIdentity"
  ])) return null;
  if (!isTopicOperation(params.rawPlan.operation)) return null;

  const sourceUnderstandingIds = validateSourceUnderstandingIds({
    value: params.rawPlan.sourceUnderstandingIds,
    understandingById: params.understandingById,
    coveredUnderstandingIds: params.coveredUnderstandingIds
  });

  if (!sourceUnderstandingIds) return null;

  return params.rawPlan.operation === "update"
    ? validateUpdatePlan({
        rawPlan: params.rawPlan,
        sourceUnderstandingIds,
        existingTopicIds: params.existingTopicIds
      })
    : validateCreatePlan({
        rawPlan: params.rawPlan,
        sourceUnderstandingIds
      });
}

function validateUpdatePlan(params: {
  rawPlan: Record<string, unknown>;
  sourceUnderstandingIds: string[];
  existingTopicIds: Set<number>;
}): TopicUpdatePlan | null {
  if (!isPositiveInteger(params.rawPlan.targetTopicId)) return null;
  if (!params.existingTopicIds.has(params.rawPlan.targetTopicId)) return null;

  const identity = validateTopicIdentityForUpdate(params.rawPlan.topicIdentity);
  if (!identity) return null;

  return {
    operation: "update",
    sourceUnderstandingIds: params.sourceUnderstandingIds,
    targetTopicId: params.rawPlan.targetTopicId,
    topicIdentity: identity
  };
}

function validateCreatePlan(params: {
  rawPlan: Record<string, unknown>;
  sourceUnderstandingIds: string[];
}): TopicUpdatePlan | null {
  if (params.rawPlan.targetTopicId !== null) return null;

  const identity = validateTopicIdentityForCreate(params.rawPlan.topicIdentity);
  if (!identity) return null;

  return {
    operation: "create",
    sourceUnderstandingIds: params.sourceUnderstandingIds,
    targetTopicId: null,
    topicIdentity: identity
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

function validateTopicIdentityForUpdate(value: unknown): ProposedTopicIdentity | null {
  const identity = validateTopicIdentityObject(value);
  if (!identity) return null;

  const title = validateNullableText(identity.title);
  const supportDomain = validateNullableEnumValue(identity.supportDomain, formatCatalogSelection.supportDomains);
  const summary = validateNullableText(identity.summary);

  if (title === undefined || supportDomain === undefined || summary === undefined) return null;

  return {title, supportDomain, summary};
}

function validateTopicIdentityForCreate(value: unknown): ProposedTopicIdentity | null {
  const identity = validateTopicIdentityObject(value);
  if (!identity) return null;

  const title = validateRequiredText(identity.title);
  const supportDomain = validateEnumValue(identity.supportDomain, formatCatalogSelection.supportDomains);
  const summary = validateRequiredText(identity.summary);

  if (!title || !supportDomain || !summary) return null;

  return {title, supportDomain, summary};
}

function validateTopicIdentityObject(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  if (!hasOnlyKeys(value, ["title", "supportDomain", "summary"])) return null;
  return value;
}

function validateNullableText(value: unknown): string | null | undefined {
  if (value === null) return null;
  return validateRequiredText(value) ?? undefined;
}

function validateRequiredText(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function validateNullableEnumValue(value: unknown, allowedValues: readonly string[]): string | null | undefined {
  if (value === null) return null;
  return validateEnumValue(value, allowedValues) ?? undefined;
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
  return understanding.extractedFields.length > 0 ||
    understanding.attemptedActions.length > 0 ||
    understanding.other.length > 0 ||
    understanding.summary.trim().length > 0;
}

function isTopicOperation(value: unknown): value is TopicUpdatePlan["operation"] {
  return validateEnumValue(value, formatCatalogSelection.topicOperations) !== null;
}

function validateEnumValue(value: unknown, allowedValues: readonly string[]): string | null {
  return typeof value === "string" && allowedValues.includes(value) ? value : null;
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
  ExistingSupportTopic,
  ProposedTopicIdentity,
  TopicUpdatePlan
};
