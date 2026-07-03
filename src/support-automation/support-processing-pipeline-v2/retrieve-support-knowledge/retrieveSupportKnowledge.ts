import {
  JsonFileSupportKnowledgeRetriever
} from "../../../infrastructure/rag/jsonFileSupportKnowledgeRetriever";
import {
  HttpSupportKnowledgeRetriever
} from "../../../infrastructure/rag/httpSupportKnowledgeRetriever";

import type {
  KnowledgeChunk,
  KnowledgeEnrichmentPlan,
  MergedTopicSnapshot,
  RetrievalRequest,
  RetrieveSupportKnowledgeInput,
  SupportAttemptedAction,
  SupportCaseDetail,
  SupportKnowledgeRetriever,
  TextUnderstanding
} from "../typesSupportProcessingPipelineV2.types";

const DESIRED_KNOWLEDGE: RetrievalRequest["desiredKnowledge"] = [
  "customerFacing",
  "supportFacing"
];

function createDefaultSupportKnowledgeRetriever(): SupportKnowledgeRetriever {
  const baseUrl = process.env.SUPPORT_RAG_API_URL;
  const apiKey = process.env.SUPPORT_RAG_API_KEY;
  const model = process.env.SUPPORT_RAG_MODEL;

  if (baseUrl && apiKey && model) {
    return new HttpSupportKnowledgeRetriever({
      baseUrl,
      apiKey,
      model
    });
  }

  return new JsonFileSupportKnowledgeRetriever();
}

function compactText(value: string | null | undefined): string | undefined {
  const compacted = value?.replace(/\s+/g, " ").trim();

  return compacted && compacted.length > 0 ? compacted : undefined;
}

function limitText(value: string, maxLength: number): string {
  return value.length > maxLength
    ? `${value.slice(0, maxLength - 1).trim()}...`
    : value;
}

type KnowledgeEnrichmentRoute =
  | "none"
  | "catalog_only"
  | "rag_only"
  | "catalog_and_rag";

function getKnowledgeEnrichmentRoute(
  plan: KnowledgeEnrichmentPlan
): KnowledgeEnrichmentRoute {
  const route = (plan as { route?: unknown }).route;

  if (
    route === "none" ||
    route === "catalog_only" ||
    route === "rag_only" ||
    route === "catalog_and_rag"
  ) {
    return route;
  }

  return "none";
}

function shouldRetrieveKnowledge(
  plan: KnowledgeEnrichmentPlan
): boolean {
  const route = getKnowledgeEnrichmentRoute(plan);

  return route === "rag_only" || route === "catalog_and_rag";
}

function hasUsableRetrievalRequest(
  plan: KnowledgeEnrichmentPlan
): boolean {
  return plan.retrievalRequests.some((request) => {
    return request.queryText.trim() !== "";
  });
}

function getTopicSnapshot(
  input: RetrieveSupportKnowledgeInput
): MergedTopicSnapshot | undefined {
  return input.topicSnapshot ?? input.topicEvidence.topicSnapshot;
}

function getBroadCategoryHint(input: RetrieveSupportKnowledgeInput): string | null {
  const snapshot = getTopicSnapshot(input);
  const relatedHint = input.topicEvidence.relatedTextUnderstandings
    .map((understanding) => {
      const value = understanding.broadCategoryHint;

      return typeof value === "string" ? value : undefined;
    })
    .find((value): value is string => Boolean(value));

  return snapshot?.broadCategoryHint ?? relatedHint ?? null;
}

function getTopicSummary(input: RetrieveSupportKnowledgeInput): string {
  const snapshot = getTopicSnapshot(input);
  const summary = compactText(snapshot?.summary) ??
    input.topicEvidence.relatedTextUnderstandings
      .map((understanding) => compactText(understanding.summary))
      .find((value): value is string => Boolean(value)) ??
    input.topicEvidence.topicSourceVerbatims
      .map((verbatim) => compactText(verbatim))
      .find((value): value is string => Boolean(value));

  return summary ?? "Support topic needing knowledge lookup.";
}

function getLatestUserUpdate(
  understandings: TextUnderstanding[],
  snapshot?: MergedTopicSnapshot
): string | undefined {
  const latestUnderstanding = understandings[understandings.length - 1];
  const sourceVerbatims = Array.isArray(latestUnderstanding?.sourceVerbatims)
    ? latestUnderstanding.sourceVerbatims.filter((value): value is string => {
        return typeof value === "string";
      })
    : [];
  const latestVerbatim = sourceVerbatims[sourceVerbatims.length - 1];

  return compactText(latestVerbatim) ??
    compactText(latestUnderstanding?.summary) ??
    compactText(snapshot?.sourceVerbatims[snapshot.sourceVerbatims.length - 1]);
}

function normalizeCaseDetails(
  snapshot: MergedTopicSnapshot | undefined,
  understandings: TextUnderstanding[]
): SupportCaseDetail[] {
  return snapshot?.caseDetails.length
    ? snapshot.caseDetails
    : understandings.flatMap((understanding) => understanding.caseDetails);
}

function normalizeAttemptedActions(
  snapshot: MergedTopicSnapshot | undefined,
  understandings: TextUnderstanding[]
): SupportAttemptedAction[] {
  return snapshot?.attemptedActions.length
    ? snapshot.attemptedActions
    : understandings.flatMap((understanding) => understanding.attemptedActions);
}

function findDetailValue(
  details: SupportCaseDetail[],
  patterns: RegExp[]
): string | undefined {
  const detail = details.find((candidate) => {
    return patterns.some((pattern) => pattern.test(candidate.key));
  });

  return typeof detail?.value === "string"
    ? compactText(detail.value)
    : undefined;
}

function buildFilters(params: {
  broadCategoryHint: string | null;
  details: SupportCaseDetail[];
}): RetrievalRequest["filters"] {
  const filters: RetrievalRequest["filters"] = {};
  const productOrService = findDetailValue(params.details, [
    /product/i,
    /service/i,
    /app/i
  ]);
  const featureOrPage = findDetailValue(params.details, [
    /feature/i,
    /page/i,
    /screen/i,
    /function/i
  ]);
  const platform = findDetailValue(params.details, [
    /platform/i,
    /device/i
  ]);
  const operatingSystem = findDetailValue(params.details, [
    /operating.*system/i,
    /\bos\b/i,
    /android/i,
    /ios/i
  ]);

  if (params.broadCategoryHint) {
    filters.broadCategoryHint = params.broadCategoryHint;
  }
  if (productOrService) {
    filters.productOrService = productOrService;
  }
  if (featureOrPage) {
    filters.featureOrPage = featureOrPage;
  }
  if (platform) {
    filters.platform = platform;
  }
  if (operatingSystem) {
    filters.operatingSystem = operatingSystem;
  }

  return Object.keys(filters).length > 0 ? filters : undefined;
}

function buildQueryText(params: {
  summary: string;
  title?: string | null;
  latestUserUpdate?: string;
  details: SupportCaseDetail[];
  attemptedActions: SupportAttemptedAction[];
}): string {
  const parts = [
    "Find support knowledge for this concrete issue.",
    `Support issue: ${params.summary}`
  ];
  const title = compactText(params.title);
  const productOrService = findDetailValue(params.details, [/product/i, /service/i, /app/i]);
  const feature = findDetailValue(params.details, [/feature/i, /page/i, /screen/i, /function/i]);
  const platform = findDetailValue(params.details, [/platform/i, /device/i]);
  const operatingSystem = findDetailValue(params.details, [/operating.*system/i, /\bos\b/i, /android/i, /ios/i]);
  const observedResult = findDetailValue(params.details, [/observed/i]);
  const expectedResult = findDetailValue(params.details, [/expected/i]);
  const error = findDetailValue(params.details, [/error/i, /message/i]);
  const version = findDetailValue(params.details, [/version/i]);
  const frequency = findDetailValue(params.details, [/frequency/i]);

  if (title && title !== params.summary) {
    parts.push(`Topic title: ${title}.`);
  }
  if (productOrService) {
    parts.push(`Product/service: ${productOrService}.`);
  }
  if (feature) {
    parts.push(`Feature/process: ${feature}.`);
  }
  if (platform || operatingSystem) {
    parts.push(`Platform/environment: ${[platform, operatingSystem].filter(Boolean).join(" / ")}.`);
  }
  if (observedResult) {
    parts.push(`Observed result: ${observedResult}.`);
  }
  if (expectedResult) {
    parts.push(`Expected result: ${expectedResult}.`);
  }
  if (error) {
    parts.push(`Reported error: ${error}.`);
  }
  if (version) {
    parts.push(`Version: ${version}.`);
  }
  if (frequency) {
    parts.push(`Frequency: ${frequency}.`);
  }
  if (params.attemptedActions.length > 0) {
    const actions = params.attemptedActions.map((action) => {
      return `${action.action} (${action.outcome})`;
    }).join("; ");
    parts.push(`Already tried: ${actions}.`);
  }
  if (params.latestUserUpdate) {
    parts.push(`Latest user update: ${params.latestUserUpdate}.`);
  }

  parts.push(
    "Return only directly relevant customer-facing support knowledge, safe customer-side checks or questions, limitations, and do-not-claim notes. Do not return loosely related issues."
  );

  return limitText(parts.join(" "), 900);
}

function buildDefaultRetrievalRequest(
  input: RetrieveSupportKnowledgeInput
): RetrievalRequest {
  const snapshot = getTopicSnapshot(input);
  const understandings = input.topicEvidence.relatedTextUnderstandings;
  const details = normalizeCaseDetails(snapshot, understandings);
  const attemptedActions = normalizeAttemptedActions(snapshot, understandings);
  const topicSummary = getTopicSummary(input);
  const latestUserUpdate = getLatestUserUpdate(understandings, snapshot);
  const broadCategoryHint = getBroadCategoryHint(input);

  return {
    topicId:
      snapshot?.topicId ??
      snapshot?.temporaryTopicId ??
      input.topicEvidence.topicId ??
      null,
    searchPurpose: "support_answer_and_qualification",
    queryText: buildQueryText({
      summary: topicSummary,
      title: snapshot?.title,
      latestUserUpdate,
      details,
      attemptedActions
    }),
    desiredKnowledge: DESIRED_KNOWLEDGE,
    filters: buildFilters({
      broadCategoryHint,
      details
    }),
    context: {
      topicSummary,
      ...(latestUserUpdate ? { latestUserUpdate } : {}),
      knownDetails: details.map((detail) => ({
        key: detail.key,
        value: detail.value
      })),
      attemptedActions: attemptedActions.map((action) => ({
        action: action.action,
        outcome: action.outcome
      }))
    }
  };
}

function buildEffectiveKnowledgeRetrievalPlan(
  input: RetrieveSupportKnowledgeInput
): KnowledgeEnrichmentPlan {
  if (!shouldRetrieveKnowledge(input.knowledgeEnrichmentPlan)) {
    return input.knowledgeEnrichmentPlan;
  }

  if (hasUsableRetrievalRequest(input.knowledgeEnrichmentPlan)) {
    return input.knowledgeEnrichmentPlan;
  }

  return {
    ...input.knowledgeEnrichmentPlan,
    retrievalRequests: [buildDefaultRetrievalRequest(input)]
  } as KnowledgeEnrichmentPlan;
}

async function retrieveSupportKnowledge(
  input: RetrieveSupportKnowledgeInput,
  retriever: SupportKnowledgeRetriever = input.retriever ??
    createDefaultSupportKnowledgeRetriever()
): Promise<KnowledgeChunk[]> {
  const effectiveKnowledgeEnrichmentPlan = buildEffectiveKnowledgeRetrievalPlan(input);
  const effectiveInput = {
    ...input,
    knowledgeEnrichmentPlan: effectiveKnowledgeEnrichmentPlan,
    topicKnowledgeEnrichmentPlan: effectiveKnowledgeEnrichmentPlan
  };

  if (!shouldRetrieveKnowledge(effectiveKnowledgeEnrichmentPlan) ||
    !hasUsableRetrievalRequest(effectiveKnowledgeEnrichmentPlan)) {
    return [];
  }

  return retriever.retrieve(effectiveInput);
}

export {
  buildEffectiveKnowledgeRetrievalPlan,
  createDefaultSupportKnowledgeRetriever,
  retrieveSupportKnowledge
};
