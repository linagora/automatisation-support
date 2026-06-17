import type {
  BuildPlanSupportResponsePromptInput,
  PlanSupportResponsePrompt,
  ResponsePlanningPolicy
} from "./typesPlanSupportResponse.types";

const DEFAULT_RESPONSE_PLANNING_POLICY: ResponsePlanningPolicy = {
  supportStrictness: "standard",
  botAutonomy: "standard",
  userAutonomy: "unknown",
  customerToneProfile: "standard",
  maxQuestionsPerTopic: 2,
  maxTotalQuestions: 3
};

const QUESTION_SELECTION_HINTS = [
  "Use only field names from extractableFieldCatalog.",
  "Do not ask a field already present in the current turn, existing topics, topic update proposals, or latest user message.",
  "Do not ask the user to retry an action they already tested and reported as failed.",
  "Without support knowledge, do not provide solutions, diagnoses, procedures, refunds, references, status pages, timelines, investigation promises, resolution promises, escalation claims, or team actions.",
  "For duplicate invoice wording, clarify duplicate document/email versus duplicate payment/charge before asking amount or currency.",
  "For bugs already qualified with page/feature, error/result, environment, and a failed tested action, prefer acknowledgement only unless one missing field is clearly decisive.",
  "Prefer one useful question over several weak questions."
] as const;

type KnowledgeMode =
  | "knowledge_available"
  | "knowledge_missing"
  | "rag_not_enabled";

type PlannerKnowledge = {
  knowledgeMode: KnowledgeMode;
  retrievedKnowledge: unknown[];
  synthesizedKnowledge: unknown | null;
};

function toPrettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : null;
}

function getValue(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

function resolvePolicy(
  policy?: Partial<ResponsePlanningPolicy>
): ResponsePlanningPolicy {
  return {
    ...DEFAULT_RESPONSE_PLANNING_POLICY,
    ...(policy ?? {})
  };
}

function getKnowledgeMode(input: BuildPlanSupportResponsePromptInput): KnowledgeMode {
  const route = getValue(input.knowledgeEnrichmentPlan, "route");
  const hasRetrievedKnowledge = asArray(input.retrievedSupportKnowledge).length > 0;
  const hasSynthesizedKnowledge =
    input.synthesizedRetrievedKnowledge !== null &&
    input.synthesizedRetrievedKnowledge !== undefined;

  if (hasRetrievedKnowledge || hasSynthesizedKnowledge) {
    return "knowledge_available";
  }

  if (route === "retrieve_knowledge") {
    return "knowledge_missing";
  }

  return "rag_not_enabled";
}

function getTargetLanguage(input: BuildPlanSupportResponsePromptInput): string {
  const userLanguage = asString(getValue(input.textSurfaceAnalysis, "userLanguage"));

  if (userLanguage && userLanguage !== "Unknown") {
    return userLanguage;
  }

  const latestMessage = input.latestUserMessageContent.toLowerCase();

  if (
    latestMessage.includes("bonjour") ||
    latestMessage.includes("facture") ||
    latestMessage.includes("compte") ||
    latestMessage.includes("erreur") ||
    latestMessage.includes("je ") ||
    latestMessage.includes("j’") ||
    latestMessage.includes("j'")
  ) {
    return "French";
  }

  return "same_language_as_user";
}

function compactPolicy(policy: ResponsePlanningPolicy): unknown {
  return {
    supportStrictness: policy.supportStrictness,
    botAutonomy: policy.botAutonomy,
    userAutonomy: policy.userAutonomy,
    customerToneProfile: policy.customerToneProfile,
    maxQuestionsPerTopic: policy.maxQuestionsPerTopic,
    maxTotalQuestions: policy.maxTotalQuestions
  };
}

function compactFact(fact: unknown): unknown {
  if (!isRecord(fact)) {
    return fact;
  }

  return {
    type: fact.type,
    fieldName: fact.fieldName,
    kind: fact.kind,
    value: fact.value,
    evidence: fact.evidence,
    support: fact.support
  };
}

function compactTestedAction(action: unknown): unknown {
  if (!isRecord(action)) {
    return action;
  }

  return {
    label: action.label,
    outcome: action.outcome,
    evidence: action.evidence
  };
}

function compactUnderstanding(understanding: unknown): unknown {
  if (!isRecord(understanding)) {
    return understanding;
  }

  return {
    understandingId: understanding.understandingId,
    sourceVerbatims: understanding.sourceVerbatims,
    summary: understanding.summary,
    primaryUserExpectation: understanding.primaryUserExpectation,
    broadCategoryHint: understanding.broadCategoryHint,
    contextualAnswer: understanding.contextualAnswer,
    facts: asArray(understanding.facts).map(compactFact),
    testedActions: asArray(understanding.testedActions).map(compactTestedAction),
    uncertainties: understanding.uncertainties
  };
}

function compactExistingTopic(topic: unknown): unknown {
  if (!isRecord(topic)) {
    return topic;
  }

  return {
    topicId: topic.topicId ?? topic.id_topic ?? topic.id,
    title: topic.title ?? topic.topic_title,
    summary: topic.summary,
    status: topic.status,
    broadCategoryHint: topic.broadCategoryHint ?? topic.topic_category,
    userGoal: topic.userGoal,
    blockingIssue: topic.blockingIssue,
    knownFacts: topic.knownFacts,
    missingFields: topic.missingFields,
    lastSupportState: topic.lastSupportState
  };
}

function compactTopicUpdateProposal(proposal: unknown): unknown {
  if (!isRecord(proposal)) {
    return proposal;
  }

  return {
    proposalId: proposal.proposalId,
    action: proposal.action,
    topicId: proposal.topicId,
    fromUnderstandingIds: proposal.fromUnderstandingIds,
    selectedSourceVerbatims: proposal.selectedSourceVerbatims,
    updateIntent: proposal.updateIntent,
    newTopic: proposal.newTopic,
    reason: proposal.reason
  };
}

function compactStandardFragment(fragment: unknown): unknown {
  if (!isRecord(fragment)) {
    return fragment;
  }

  return {
    standardSubcategory: fragment.standardSubcategory,
    content: fragment.content
  };
}

function compactCue(cue: unknown): unknown {
  if (!isRecord(cue)) {
    return cue;
  }

  return {
    verbatim: cue.verbatim,
    cueNote: cue.cueNote,
    relatedUnderstandingIds: cue.relatedUnderstandingIds
  };
}

function compactExtractableField(field: unknown): unknown | null {
  if (!isRecord(field)) {
    return null;
  }

  const fieldName = asString(
    field.fieldName ?? field.name ?? field.key ?? field.id ?? field.field_id
  );

  if (!fieldName) {
    return null;
  }

  return {
    fieldName,
    description: field.description,
    label: field.label ?? field.title,
    category:
      field.category ??
      field.broadCategoryHint ??
      field.supportCategory ??
      field.appliesTo
  };
}

function compactExtractableFieldCatalog(catalog: unknown): unknown[] {
  return asArray(catalog)
    .map(compactExtractableField)
    .filter((field): field is NonNullable<typeof field> => field !== null);
}

function buildKnowledgeForPlanner(
  input: BuildPlanSupportResponsePromptInput,
  knowledgeMode: KnowledgeMode
): PlannerKnowledge {
  if (knowledgeMode !== "knowledge_available") {
    return {
      knowledgeMode,
      retrievedKnowledge: [],
      synthesizedKnowledge: null
    };
  }

  return {
    knowledgeMode,
    retrievedKnowledge: asArray(input.retrievedSupportKnowledge),
    synthesizedKnowledge: input.synthesizedRetrievedKnowledge ?? null
  };
}

function hasSupportWork(input: BuildPlanSupportResponsePromptInput): boolean {
  return (
    asArray(input.textUnderstandings).length > 0 ||
    asArray(input.topicUpdateProposals).length > 0
  );
}

function buildPlanningTask(input: BuildPlanSupportResponsePromptInput): unknown {
  const knowledgeMode = getKnowledgeMode(input);
  const policy = resolvePolicy(input.responsePlanningPolicy);
  const targetLanguage = getTargetLanguage(input);
  const standardFragments = asArray(input.standardResponseFragments).map(
    compactStandardFragment
  );

  if (!hasSupportWork(input)) {
    return {
      route: "standard_only",
      targetLanguage,
      latestUserMessageVerbatim: input.latestUserMessageContent,
      standardFragments,
      policy: compactPolicy(policy)
    };
  }

  return {
    route: "support_response",
    targetLanguage,
    policy: compactPolicy(policy),
    latestUserMessageVerbatim: input.latestUserMessageContent,
    currentTurnUnderstanding: {
      messageUnderstandings: asArray(input.textUnderstandings).map(
        compactUnderstanding
      ),
      supportResponseCues: asArray(input.supportResponseCues).map(compactCue),
      standardFragments
    },
    topicUnderstanding: {
      knownTopicsBeforeTurn: asArray(input.existingTopics).map(compactExistingTopic),
      proposedTopicUpdatesFromThisTurn: asArray(input.topicUpdateProposals).map(
        compactTopicUpdateProposal
      )
    },
    supportKnowledge: {
      extractableFieldCatalog: compactExtractableFieldCatalog(
        input.extractableFieldCatalog
      ),
      questionSelectionHints: QUESTION_SELECTION_HINTS,
      ...buildKnowledgeForPlanner(input, knowledgeMode)
    }
  };
}

function buildSupportSystemPrompt(): string {
  return `
You are the support response planner.

Return exactly one valid JSON object matching the schema.
Do not write the final customer-facing response.

You receive one compact planningTask.
Use only this planningTask.

Your job has three phases:

1. UNDERSTAND
Privately understand:
- what the user just said;
- what they probably expect;
- what is already known about the topic;
- what support knowledge is available.

2. DECIDE
Fill knowledgeGate and questionDecision.
Decide whether a solution is allowed.
Decide whether one useful missing-field question is needed.
If no useful question and no supported solution are available, choose acknowledgement only.

3. GENERATE
Generate one strict rendererTask.
rendererTask.prompt is the only instruction the renderer will follow.

Do not create parallel renderer instructions.
Do not duplicate the same decision in several fields.

# Output shape

You must output exactly:
- responsePlanId
- knowledgeGate
- questionDecision
- rendererTask
- internalRationale

# knowledgeGate

Set knowledgeGate.knowledgeMode from planningTask.supportKnowledge.knowledgeMode.

If knowledgeMode is not "knowledge_available":
- solutionAllowed must be false;
- allowedMoves must not include "answer_with_knowledge";
- rendererTask.prompt must not provide a solution, diagnosis, procedure, refund, reference number, status page, timeline, team action, investigation promise, resolution promise, or escalation claim.

If knowledgeMode is "knowledge_available":
- solutionAllowed may be true only when the answer is directly supported by retrievedKnowledge or synthesizedKnowledge.
- rendererTask.prompt may include an answer only when directly supported.

# questionDecision

Use only field names from planningTask.supportKnowledge.extractableFieldCatalog.

Ask a question only if:
- the field is missing;
- it is materially useful;
- it is not already present in the current turn, known topics, proposed topic updates, or latest user message.

Do not ask fields mechanically from the catalog.
Do not ask the user to retry an action they already tested and reported as failed.
Respect maxQuestionsPerTopic and maxTotalQuestions.
Prefer one useful question over several weak questions.

If shouldAskQuestion is false:
- plannedQuestionCount must be 0;
- fieldNames must be [];
- questionInstruction must be null;
- rendererTask.questionFieldNames must be [];
- rendererTask.prompt must explicitly instruct the renderer not to ask a question.

If shouldAskQuestion is true:
- plannedQuestionCount must equal fieldNames.length;
- questionInstruction must be in targetLanguage when possible;
- rendererTask.questionFieldNames must equal fieldNames;
- rendererTask.prompt must ask only that question.

# Billing guardrail

For duplicate invoice wording such as "I received my invoice twice":
- do not call it duplicate payment or duplicate charge;
- do not ask amount or currency first;
- if a question is needed, ask whether it is only a duplicate invoice/document/email or whether there is also a duplicate payment/charge;
- use the matching central catalog field for this clarification, for example "duplicate_billing_impact" if available.

# Bug guardrail

For bugs, if the user already gave:
- feature/page;
- observed result or error message;
- environment such as browser/platform;
- and a tested action that failed;
then prefer acknowledgement only unless one missing field is clearly decisive.

# rendererTask

rendererTask must contain:
- targetLanguage;
- prompt;
- questionFieldNames;
- forbiddenClaims.

rendererTask.prompt must be a direct instruction to the renderer.
It must say what to write and what not to add.
It must be concise but complete.
It must not expose internal ids or pipeline terms.
It must not ask the renderer to reason.
Use targetLanguage for user-facing wording instructions.

# Standard fragments and cues

Use standardFragments and supportResponseCues only to guide rendererTask tone.
Acknowledge urgency, disappointment, greeting or handover briefly if present.
Do not quote impolite wording back.

# Standard-only route

If planningTask.route is "standard_only":
- output a plan with solutionAllowed false;
- questionDecision.shouldAskQuestion must be false;
- rendererTask.prompt must ask the renderer to write a short standard response using only standardFragments;
- do not create a support answer;
- do not ask diagnostic questions.

Return JSON only.
No markdown.
No unsupported invention.
`.trim();
}

function buildStandardOnlySystemPrompt(): string {
  return `
You are the support response planner.

Return exactly one valid JSON object matching the schema.
Do not write the final customer-facing response.

You receive a standard-only planningTask.

Output exactly:
- responsePlanId
- knowledgeGate
- questionDecision
- rendererTask
- internalRationale

Rules:
- knowledgeGate.knowledgeMode should be "rag_not_enabled".
- knowledgeGate.solutionAllowed must be false.
- questionDecision.shouldAskQuestion must be false.
- questionDecision.plannedQuestionCount must be 0.
- questionDecision.fieldNames must be [].
- questionDecision.questionInstruction must be null.
- rendererTask.questionFieldNames must be [].
- rendererTask.prompt must ask for a short natural response using only standardFragments.
- Do not discuss support topics.
- Do not ask diagnostic questions.
- Do not invent operational promises.

Return JSON only.
`.trim();
}

function buildPlanSupportResponsePrompt(
  input: BuildPlanSupportResponsePromptInput
): PlanSupportResponsePrompt {
  const planningTask = buildPlanningTask(input);
  const route = isRecord(planningTask) ? planningTask.route : null;

  const systemPrompt =
    route === "standard_only"
      ? buildStandardOnlySystemPrompt()
      : buildSupportSystemPrompt();

  const userPrompt = `
Build the response plan from this planningTask only:

\`\`\`json
${toPrettyJson(planningTask)}
\`\`\`
`.trim();

  return {
    messages: [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: userPrompt
      }
    ]
  };
}

export {
  DEFAULT_RESPONSE_PLANNING_POLICY,
  QUESTION_SELECTION_HINTS,
  buildPlanSupportResponsePrompt
};
