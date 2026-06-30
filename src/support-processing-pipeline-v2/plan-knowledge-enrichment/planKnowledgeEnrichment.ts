import type {
  KnowledgeEnrichmentPlan,
  MergedTopicSnapshot,
  PlanKnowledgeEnrichmentInput,
  RetrievalRequest,
  SupportAttemptedAction,
  SupportCaseDetail,
  TextUnderstanding
} from "../typesSupportProcessingPipelineV2.types";
import {
  getKnowledgeRetrievalPolicyDecision
} from "./knowledgeRetrievalPolicy";

const DESIRED_KNOWLEDGE: RetrievalRequest["desiredKnowledge"] = [
  "customer_facing_information",
  "customer_answerable_questions",
  "internal_support_notes",
  "limitations",
  "do_not_expose"
];

function compactText(value: string | null | undefined): string | undefined {
  const compacted = value?.replace(/\s+/g, " ").trim();

  return compacted && compacted.length > 0 ? compacted : undefined;
}

function limitText(value: string, maxLength: number): string {
  return value.length > maxLength
    ? `${value.slice(0, maxLength - 1).trim()}...`
    : value;
}

function getTopicSnapshot(
  input: PlanKnowledgeEnrichmentInput
): MergedTopicSnapshot | undefined {
  return input.topicSnapshot ?? input.topicEvidence.topicSnapshot;
}

function getBroadCategoryHint(input: PlanKnowledgeEnrichmentInput): string | null {
  const snapshot = getTopicSnapshot(input);
  const relatedHint = input.topicEvidence.relatedTextUnderstandings
    .map((understanding) => {
      const value = understanding.broadCategoryHint;

      return typeof value === "string" ? value : undefined;
    })
    .find((value): value is string => Boolean(value));

  return snapshot?.broadCategoryHint ?? relatedHint ?? null;
}

function getTopicSummary(input: PlanKnowledgeEnrichmentInput): string {
  const snapshot = getTopicSnapshot(input);
  const summary = compactText(snapshot?.summary) ??
    input.topicEvidence.relatedTextUnderstandings
      .map((understanding) => compactText(understanding.summary))
      .find((value): value is string => Boolean(value)) ??
    input.topicEvidence.topicSourceVerbatims
      .map((verbatim) => compactText(verbatim))
      .find((value): value is string => Boolean(value));

  return summary ?? "Support topic needing qualification.";
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
  const details = snapshot?.caseDetails.length
    ? snapshot.caseDetails
    : understandings.flatMap((understanding) => understanding.caseDetails);
  const topicDetails = snapshot?.topic_details
    ? Object.entries(snapshot.topic_details).map(([key, value]) => ({
        key,
        value,
        evidence: key
      }))
    : [];

  return [...details, ...topicDetails];
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
    `Support issue: ${params.summary}`
  ];
  const title = compactText(params.title);
  const error = findDetailValue(params.details, [/error/i, /message/i]);
  const feature = findDetailValue(params.details, [
    /feature/i,
    /page/i,
    /screen/i,
    /function/i
  ]);
  const environment = findDetailValue(params.details, [
    /platform/i,
    /device/i,
    /operating.*system/i,
    /\bos\b/i,
    /android/i,
    /ios/i
  ]);

  if (title && title !== params.summary) {
    parts.push(`Topic title: ${title}.`);
  }
  if (feature) {
    parts.push(`Affected feature or page: ${feature}.`);
  }
  if (environment) {
    parts.push(`Environment: ${environment}.`);
  }
  if (error) {
    parts.push(`Reported error: ${error}.`);
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
    "We need knowledge separated into customer-facing information, customer-answerable questions, internal support/dev notes, limitations, and content that must not be exposed to the customer."
  );

  return limitText(parts.join(" "), 900);
}

async function planKnowledgeEnrichment(
  input: PlanKnowledgeEnrichmentInput
): Promise<KnowledgeEnrichmentPlan> {
  const broadCategoryHint = getBroadCategoryHint(input);
  const policyDecision =
    getKnowledgeRetrievalPolicyDecision(broadCategoryHint);

  if (!policyDecision.enabled) {
    return {
      route: "no_retrieval",
      retrievalRequests: [],
      reason: policyDecision.reason
    };
  }

  const snapshot = getTopicSnapshot(input);
  const understandings = input.topicEvidence.relatedTextUnderstandings;
  const details = normalizeCaseDetails(snapshot, understandings);
  const attemptedActions = normalizeAttemptedActions(snapshot, understandings);
  const topicSummary = getTopicSummary(input);
  const latestUserUpdate = getLatestUserUpdate(understandings, snapshot);
  const request: RetrievalRequest = {
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

  return {
    route: "retrieve_knowledge",
    retrievalRequests: [request],
    reason: policyDecision.reason
  };
}

export {
  planKnowledgeEnrichment
};
