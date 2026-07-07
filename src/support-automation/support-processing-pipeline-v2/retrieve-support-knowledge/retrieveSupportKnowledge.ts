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

type SupportKnowledgeSummary = {
  summary?: string | null;
  customerFacing?: string | null;
  supportFacing?: string | null;
};

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

function getTopicTitle(input: RetrieveSupportKnowledgeInput): string | undefined {
  const snapshot = getTopicSnapshot(input);

  return compactText(snapshot?.title);
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

function getSupportKnowledgeSummary(
  snapshot: MergedTopicSnapshot | undefined
): SupportKnowledgeSummary | null {
  const value = (snapshot as {
    supportKnowledgeSummary?: unknown;
  } | undefined)?.supportKnowledgeSummary;

  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as SupportKnowledgeSummary;
  const summary = compactText(candidate.summary ?? null) ?? null;
  const customerFacing = compactText(candidate.customerFacing ?? null) ?? null;
  const supportFacing = compactText(candidate.supportFacing ?? null) ?? null;

  if (!summary && !customerFacing && !supportFacing) {
    return null;
  }

  return {
    summary,
    customerFacing,
    supportFacing
  };
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

function formatCaseDetails(details: SupportCaseDetail[]): string[] {
  return details
    .map((detail) => {
      const key = compactText(detail.key);
      const value = typeof detail.value === "string"
        ? compactText(detail.value)
        : undefined;

      return key && value ? `- ${key}: ${value}` : undefined;
    })
    .filter((value): value is string => Boolean(value));
}

function formatAttemptedActions(actions: SupportAttemptedAction[]): string[] {
  return actions
    .map((action) => {
      const actionText = compactText(action.action);
      const outcomeText = compactText(action.outcome);

      if (!actionText && !outcomeText) {
        return undefined;
      }

      if (!outcomeText) {
        return `- ${actionText}`;
      }

      if (!actionText) {
        return `- Outcome: ${outcomeText}`;
      }

      return `- ${actionText}: ${outcomeText}`;
    })
    .filter((value): value is string => Boolean(value));
}

function formatSupportKnowledgeSummary(
  summary: SupportKnowledgeSummary | null
): string[] {
  if (!summary) {
    return [];
  }

  const lines = ["Existing support knowledge summary:"];

  if (summary.summary) {
    lines.push(`- summary: ${summary.summary}`);
  }
  if (summary.customerFacing) {
    lines.push(`- customerFacing: ${summary.customerFacing}`);
  }
  if (summary.supportFacing) {
    lines.push(`- supportFacing: ${summary.supportFacing}`);
  }

  return lines;
}

function buildQueryText(params: {
  title?: string;
  broadCategoryHint: string | null;
  summary: string;
  details: SupportCaseDetail[];
  attemptedActions: SupportAttemptedAction[];
  supportKnowledgeSummary: SupportKnowledgeSummary | null;
}): string {
  const lines = [
    "We need retrieved support knowledge for this topic.",
    "",
    "Topic:"
  ];

  if (params.title && params.title !== params.summary) {
    lines.push(`Title: ${params.title}`);
  }

  if (params.broadCategoryHint) {
    lines.push(`Broad category: ${params.broadCategoryHint}`);
  }

  lines.push(`Summary: ${params.summary}`);

  const detailLines = formatCaseDetails(params.details);
  if (detailLines.length > 0) {
    lines.push("", "Case details:", ...detailLines);
  }

  const actionLines = formatAttemptedActions(params.attemptedActions);
  if (actionLines.length > 0) {
    lines.push("", "Attempted actions:", ...actionLines);
  }

  const supportKnowledgeLines = formatSupportKnowledgeSummary(
    params.supportKnowledgeSummary
  );
  if (supportKnowledgeLines.length > 0) {
    lines.push("", ...supportKnowledgeLines);
  }

  lines.push(
    "",
    "Search goal:",
    "Find directly relevant existing support knowledge for this exact topic.",
    "Prefer specific product/feature/platform knowledge over generic support advice.",
    "Do not look for a final answer if the documents do not contain one.",
    "It is acceptable to return no customer-facing knowledge."
  );

  return limitText(lines.join("\n"), 1_500);
}

function buildDefaultRetrievalRequest(
  input: RetrieveSupportKnowledgeInput
): RetrievalRequest {
  const snapshot = getTopicSnapshot(input);
  const understandings = input.topicEvidence.relatedTextUnderstandings;
  const details = normalizeCaseDetails(snapshot, understandings);
  const attemptedActions = normalizeAttemptedActions(snapshot, understandings);
  const topicSummary = getTopicSummary(input);
  const broadCategoryHint = getBroadCategoryHint(input);
  const supportKnowledgeSummary = getSupportKnowledgeSummary(snapshot);

  return {
    topicId:
      snapshot?.topicId ??
      snapshot?.temporaryTopicId ??
      input.topicEvidence.topicId ??
      null,
    searchPurpose: "support_answer_and_qualification",
    queryText: buildQueryText({
      title: getTopicTitle(input),
      broadCategoryHint,
      summary: topicSummary,
      details,
      attemptedActions,
      supportKnowledgeSummary
    }),
    desiredKnowledge: DESIRED_KNOWLEDGE,
    filters: buildFilters({
      broadCategoryHint,
      details
    }),
    context: {
      topicSummary,
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