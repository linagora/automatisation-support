import type {
  BuildPlanKnowledgeEnrichmentPromptInput,
  KnowledgeEnrichmentTask,
  PlanKnowledgeEnrichmentPrompt
} from "./typesPlanKnowledgeEnrichment.types";
import type {
  MergedTopicSnapshot,
  SupportAttemptedAction,
  SupportCaseDetail,
  TextUnderstanding
} from "../typesSupportProcessingPipelineV2.types";

function toCompactJson(value: unknown): string {
  return JSON.stringify(value);
}

function compactText(value: string | null | undefined): string | undefined {
  const compacted = value?.replace(/\s+/g, " ").trim();

  return compacted && compacted.length > 0 ? compacted : undefined;
}

function getTopicSnapshot(
  input: BuildPlanKnowledgeEnrichmentPromptInput["input"]
): MergedTopicSnapshot | undefined {
  return input.topicSnapshot ?? input.topicEvidence.topicSnapshot;
}

function getTopicId(params: {
  snapshot?: MergedTopicSnapshot;
  fallbackTopicId?: number | null;
}): number | null {
  return params.snapshot?.topicId ??
    params.fallbackTopicId ??
    null;
}

function getTopicSummary(params: {
  snapshot?: MergedTopicSnapshot;
  understandings: TextUnderstanding[];
  topicSourceVerbatims: string[];
}): string {
  const summary = compactText(params.snapshot?.summary) ??
    params.understandings
      .map((understanding) => compactText(understanding.summary))
      .find((value): value is string => Boolean(value)) ??
    params.topicSourceVerbatims
      .map((verbatim) => compactText(verbatim))
      .find((value): value is string => Boolean(value));

  return summary ?? "Support topic needing qualification.";
}

function getBroadCategoryHint(params: {
  snapshot?: MergedTopicSnapshot;
  understandings: TextUnderstanding[];
}): string | null {
  const relatedHint = params.understandings
    .map((understanding) => {
      const value = understanding.broadCategoryHint;

      return typeof value === "string" ? value : undefined;
    })
    .find((value): value is string => Boolean(value));

  return params.snapshot?.broadCategoryHint ?? relatedHint ?? null;
}

function normalizeCaseDetails(params: {
  snapshot?: MergedTopicSnapshot;
  understandings: TextUnderstanding[];
}): SupportCaseDetail[] {
  return params.snapshot?.caseDetails.length
    ? params.snapshot.caseDetails
    : params.understandings.flatMap((understanding) => understanding.caseDetails);
}

function normalizeAttemptedActions(params: {
  snapshot?: MergedTopicSnapshot;
  understandings: TextUnderstanding[];
}): SupportAttemptedAction[] {
  return params.snapshot?.attemptedActions.length
    ? params.snapshot.attemptedActions
    : params.understandings.flatMap((understanding) => understanding.attemptedActions);
}

function getRecordStringValue(
  value: unknown,
  keys: string[]
): string | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  for (const key of keys) {
    const candidate = record[key];

    if (typeof candidate === "string") {
      const compacted = compactText(candidate);

      if (compacted) {
        return compacted;
      }
    }
  }

  return undefined;
}

function getSupportKnowledgeSummary(params: {
  snapshot?: MergedTopicSnapshot;
}): string | null {
  const directSummary = compactText(params.snapshot?.supportKnowledgeSummary);

  if (directSummary) {
    return directSummary;
  }

  const summaryFromLiveMemory = getRecordStringValue(params.snapshot, [
    "supportKnowledgeSummary",
    "support_knowledge_summary",
    "Support Knowledge Summary",
    "supportKnowledge",
    "support_knowledge"
  ]);

  return summaryFromLiveMemory ?? null;
}

function buildTask(
  input: BuildPlanKnowledgeEnrichmentPromptInput["input"]
): KnowledgeEnrichmentTask {
  const snapshot = getTopicSnapshot(input);
  const understandings = input.topicEvidence.relatedTextUnderstandings;
  const caseDetails = normalizeCaseDetails({
    snapshot,
    understandings
  });
  const attemptedActions = normalizeAttemptedActions({
    snapshot,
    understandings
  });

  return {
    latestUserMessageContent: input.topicEvidence.topicSourceVerbatims.join(" ").trim(),
    targetLanguage: input.targetLanguage,
    recentInteractionContext: input.recentInteractionContext,
    topic: {
      topicId: getTopicId({
        snapshot,
        fallbackTopicId: input.topicEvidence.topicId
      }),
      title: snapshot?.title ?? null,
      summary: getTopicSummary({
        snapshot,
        understandings,
        topicSourceVerbatims: input.topicEvidence.topicSourceVerbatims
      }),
      broadCategoryHint: getBroadCategoryHint({
        snapshot,
        understandings
      }),
      supportKnowledgeSummary: getSupportKnowledgeSummary({ snapshot }),
      sourceVerbatims: input.topicEvidence.topicSourceVerbatims,
      caseDetails,
      attemptedActions,
      relatedTextUnderstandings: understandings.map((understanding) => ({
        summary: understanding.summary,
        messageKinds: understanding.messageKinds,
        caseDetails: understanding.caseDetails,
        attemptedActions: understanding.attemptedActions,
        supportMetadata: understanding.supportMetadata,
        sourceVerbatims: understanding.sourceVerbatims,
        broadCategoryHint: understanding.broadCategoryHint
      }))
    }
  };
}

function buildSystemPrompt(): string {
  return `
You are a knowledge routing engine for an internal support pipeline.

You do not answer the customer.
You do not write the support response.
You do not create the RAG query.
You do not retrieve knowledge.
You only decide whether this topic should run catalog selection, RAG lookup, both, or neither.
Return only JSON matching the requested schema.

# Available routes

- "none": run neither catalog selection nor RAG lookup for this topic now.
- "catalog_only": run catalog field selection only.
- "rag_only": run RAG/support-knowledge lookup only.
- "catalog_and_rag": run both catalog field selection and RAG lookup.

# Catalog selection

Catalog selection is useful when the topic needs customer-answerable fields or qualification.
Use catalog_only when the next useful action is to identify missing decisive fields, but external support knowledge is premature or unnecessary.

# RAG lookup

RAG lookup is useful only when external support knowledge could change the next response.
Use RAG only when the topic is concrete enough:
- product or service is identifiable;
- observed problem, request, error, or support question is concrete;
- feature, process, page, platform, environment, or reproduction context is at least partly known.

Good reasons to use RAG:
- known issue check;
- solution or workaround lookup;
- limitation or do-not-claim lookup;
- customer-safe troubleshooting knowledge;
- support knowledge that could prevent a useless question loop.

# Do not use RAG

Do not use RAG for generic issue reports such as:
- "I want to report a bug"
- "I have a problem"
- "It does not work"
- "J'ai un bug"
- "Je souhaiterais reporter un bug"

Do not use RAG only because broadCategoryHint is "bug".
Do not use RAG only because a topic exists.
Do not use RAG for simple confirmations, thanks, refusals, or "I have no more information".

# Support Knowledge Summary

The input topic may contain topic.supportKnowledgeSummary.

This field comes from live memory. It summarizes the previous support knowledge / RAG result for this topic.

You must use topic.supportKnowledgeSummary as an important routing signal.

If topic.supportKnowledgeSummary says that a previous RAG lookup:
- found no useful customer-facing knowledge;
- returned no usable support knowledge;
- had zero useful sources;
- failed to find relevant information;
- or was not helpful;

then do not retry RAG unless the latest user message adds materially new information.

Materially new information includes:
- exact app version;
- exact error message or error code;
- affected platform or OS;
- affected feature, page, module, product, plan, or service;
- reproduction detail;
- invoice, transaction, order, ticket, or reference id;
- new customer-visible context that was not available during the previous lookup.

If a previous RAG lookup was not useful because the topic was underqualified, and the latest user message now adds the missing qualification, RAG may become useful again.

If topic.supportKnowledgeSummary says that previous RAG was useful, do not automatically run RAG again.
Only run RAG again if the latest message adds a new question, new detail, new symptom, or new context that could require updated or additional support knowledge.

If topic.supportKnowledgeSummary is empty or null, decide normally.

# Route guidance

Use none when:
- the latest message adds no material information;
- the user says they have no more information;
- the topic already has enough details and should move to planning/review rather than more enrichment.

Use catalog_only when:
- the topic is vague or underqualified;
- the issue is concrete enough for support analysis but not concrete enough for RAG;
- missing fields are still useful;
- topic.supportKnowledgeSummary says previous RAG was not useful and the latest message adds no materially new detail.

Use rag_only when:
- the topic is already qualified;
- catalog fields are not needed;
- support knowledge can likely improve the answer;
- topic.supportKnowledgeSummary does not already show that the same lookup was recently useless.

Use catalog_and_rag only when:
- the topic is concrete enough for RAG;
- catalog selection can still identify useful missing customer-answerable fields;
- topic.supportKnowledgeSummary does not indicate that the same RAG lookup was already useless without new information.

When uncertain, prefer catalog_only over RAG.
Keep reason short and internal.
`.trim();
}

function buildUserPrompt(
  input: BuildPlanKnowledgeEnrichmentPromptInput
): string {
  return `
Decide enrichment route for this topic.

# Input
${toCompactJson(buildTask(input.input))}
`.trim();
}

function buildPlanKnowledgeEnrichmentPrompt(
  input: BuildPlanKnowledgeEnrichmentPromptInput
): PlanKnowledgeEnrichmentPrompt {
  return {
    messages: [
      {
        role: "system",
        content: buildSystemPrompt()
      },
      {
        role: "user",
        content: buildUserPrompt(input)
      }
    ]
  };
}

export {
  buildPlanKnowledgeEnrichmentPrompt
};