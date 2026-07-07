import type {
  BuildPlanKnowledgeEnrichmentPromptInput,
  KnowledgeEnrichmentTask,
  PlanKnowledgeEnrichmentPrompt
} from "./typesPlanKnowledgeEnrichment.types";
import type {
  MergedTopicSnapshot,
  SupportKnowledgeSummary,
  SupportAttemptedAction,
  SupportCaseDetail,
  TextUnderstanding
} from "../typesSupportProcessingPipelineV2.types";
import {
  normalizeSupportKnowledgeSummary
} from "../supportKnowledgeSummary";
import {
  BROAD_INTENT_MODES,
  renderBroadIntentDefinitionsForPrompt
} from "../../support-catalog";

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
}): SupportKnowledgeSummary | null {
  const directSummary = normalizeSupportKnowledgeSummary(
    params.snapshot?.supportKnowledgeSummary
  );

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

  return normalizeSupportKnowledgeSummary(summaryFromLiveMemory);
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
You are the knowledge enrichment routing stage of an internal customer support pipeline.

You do not answer the customer.
You do not write the support response.
You do not select catalog fields.
You do not decide that the topic is finished.
You do not decide human fallback.
You do not create the RAG query.
You do not retrieve knowledge.

You only decide:
1. the broadIntent of the current topic;
2. whether RAG/support-knowledge retrieval should run now.

The catalog qualification branch is handled separately and should generally run for every support topic. Do not decide catalog fields here.
Return only JSON matching the requested schema.

# Important distinction

broadCategoryHint is an existing topic/category hint from support memory, such as bug, access_security, billing, configuration, question_faq, feature_request, support_action, or similar.
Treat broadCategoryHint as a hint about the topic domain or previous classification, not as the operational intent.

You must choose broadIntent independently:

${renderBroadIntentDefinitionsForPrompt()}

Do not confuse broadCategoryHint with broadIntent.
Examples:
- A billing topic can be an issue, faq, or request.
- An access_security topic can be an issue, faq, or request.
- question_faq usually maps to faq, but may hide an issue.
- feature_request usually maps to request, but may hide an issue.
- bug usually maps to issue, but a vague user message may still be unclear.

# RAG decision

RAG should run only if both conditions are true:
1. The topic is specific enough to produce a useful retrieval query.
2. There is a reasonable chance that support knowledge can provide an answer, solution, useful explanation, known behavior, policy, limitation, or specific useful follow-up question.

Set rag.shouldRetrieve = false when:
- broadIntent is unclear;
- the topic is too underqualified to produce a useful retrieval query;
- the user only says something generic like "I have a problem", "it does not work", "I want to report a bug", or similar;
- the topic mainly needs qualification first rather than documentation or support knowledge;
- a previous retrieval found no useful knowledge and no materially new detail was added;
- the latest message is only a clarification request about a previous bot question;
- the latest message adds no material information that could change retrieval.

Set rag.shouldRetrieve = true when:
- the user asks a clear FAQ/how-to/support question that support knowledge could answer;
- the user reports a concrete issue with enough details to search for known behavior, procedure, limitation, workaround, or support guidance;
- the user makes a request that could be answered by product documentation, policy, availability, or support knowledge;
- a new material detail was added after a previous weak, empty, or irrelevant retrieval and could improve retrieval.

Materially new information includes:
- exact app version;
- exact error message or error code;
- affected platform, OS, browser, app, product, feature, page, module, plan, or service;
- reproduction detail;
- failed attempted action;
- invoice, transaction, order, ticket, or reference id;
- account, workspace, organization, permission, shared-item, or server context;
- any customer-visible detail not available during the previous lookup.

# Previous supportKnowledgeSummary

The input topic may contain topic.supportKnowledgeSummary.
This field comes from live memory and summarizes previous RAG/support-knowledge state.

Use it as an important routing signal.

If previous retrieval found no useful customer-facing knowledge, returned no usable support knowledge, had zero useful sources, or was not helpful, do not retry RAG unless the latest user evidence adds materially new information.

If previous retrieval was useful, do not automatically run RAG again. Run RAG again only if the latest user evidence adds a new question, new symptom, new context, or new detail that could require additional support knowledge.

If supportKnowledgeSummary is empty or null, decide normally.

# RAG mode

Use mode "answer" when RAG should seek a direct answer, solution, known behavior, policy, limitation, procedure, or support knowledge.

Use mode "answer_and_soft_probe" only when the user asks a clear FAQ but the question may hide an issue.
Examples:
- "How do I change my password?" may hide a login problem.
- "How do I rename a folder?" may hide a Drive issue.
- "How do I download an invoice?" may hide a billing access or missing invoice issue.

In that case, RAG can answer the question, and the response planner may gently invite the user to mention any blockage if that is why they asked.

If rag.shouldRetrieve is false, mode must be null.
If broadIntent is unclear, rag.shouldRetrieve must be false and mode must be null.

# Output shape

Return exactly one JSON object:

{
	  "broadIntent": {
	    "mode": "${BROAD_INTENT_MODES.join(" | ")}",
    "reason": "short internal reason"
  },
  "rag": {
    "shouldRetrieve": true,
    "mode": "answer | answer_and_soft_probe | null",
    "reason": "short internal reason"
  }
}

Keep reasons short and internal.
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
