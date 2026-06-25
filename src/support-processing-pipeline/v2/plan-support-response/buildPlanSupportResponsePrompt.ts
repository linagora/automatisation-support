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
  "Use only field names from the selected catalog knowledge provided for this topic.",
  "Ask only fields whose askableByUser value is not false.",
  "Do not ask a field already present in the latest user message, related text understandings, related attachment understandings, or existing topic context.",
  "Do not ask a field the user already refused or said they cannot provide.",
  "Treat a contextual negative answer such as no/non as provided information for the field that was asked; do not ask that field again.",
  "Do not ask the user to retry an action they already tested and reported as failed.",
  "Without directly applicable support knowledge, do not plan solutions, diagnoses, procedures, refunds, references, status pages, timelines, investigation promises, resolution promises, escalation claims, or team actions.",
  "Before choosing acknowledgement only, actively check whether one selected catalog field is both missing and decisive.",
  "Ask all currently decisive fields in one response, within policy.maxQuestionsPerTopic. Prefer one question when one is sufficient, but do not create unnecessary extra turns when two fields are clearly needed now.",
  "Do not ask browser, platform, amount, currency, screenshot, video, or any other field mechanically."
] as const;

const MEDIA_EVIDENCE_HINTS = [
  "A screenshot, photo, or video is not a default request.",
  "Request visual evidence only when it would materially help support understand, reproduce, verify, or locate the problem.",
  "Do not request visual evidence for facts that are better provided as text, such as browser name, invoice amount, email address, account identifier, or reference number.",
  "If the user already provided an attachment, evaluate whether it is useful, sufficient, incomplete, irrelevant, unreadable, cropped, or too unclear for this topic.",
  "If an existing topic already contains usable visual evidence, do not ask again unless the current issue changed or the existing evidence is explicitly insufficient.",
  "If visual evidence is useful but the current attachment is unusable or incomplete, ask for a clearer or more complete screenshot/photo/video instead of asking as if no attachment was provided.",
  "When requesting visual evidence, explain briefly what it should show, without asking for sensitive data."
] as const;

type KnowledgeMode =
  | "knowledge_available"
  | "knowledge_missing"
  | "rag_not_enabled";

function toPrettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function looksLikeFrench(message: string): boolean {
  return /\b(bonjour|merci|facture|probl[eè]me|connexion|compte|aide|re[çc]u|fois|pouvez|svp|j['’]|je|mon|ma|mes|oui|non|normalement|semaine derni[eè]re|derni[eè]re fois|mot de passe|[çc]a marche|[çc]a ne marche pas)\b/i.test(
    message
  );
}

function getTargetLanguage(input: BuildPlanSupportResponsePromptInput): string {
  const explicitTargetLanguage = asString(getValue(input, "targetLanguage"));

  if (explicitTargetLanguage) {
    return explicitTargetLanguage;
  }

  const existingTopic = getValue(input, "existingTopic");
  const knownTopicLanguage = asString(
    getValue(existingTopic, "userLanguage") ??
    getValue(existingTopic, "user_language") ??
    getValue(existingTopic, "language") ??
    getValue(existingTopic, "locale")
  );

  if (knownTopicLanguage && knownTopicLanguage !== "Unknown") {
    return knownTopicLanguage;
  }

  const latestMessage = asString(getValue(input, "topicUserMessageContent")) ??
    "";

  if (looksLikeFrench(latestMessage)) {
    return "French";
  }

  return "same_language_as_user";
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
    sourceSegmentIds: understanding.sourceSegmentIds,
    sourceVerbatims: understanding.sourceVerbatims,
    summary: understanding.summary,
    primaryUserExpectation: understanding.primaryUserExpectation,
    explicitUserRequest: understanding.explicitUserRequest,
    supportNeeds: understanding.supportNeeds,
    broadCategoryHint: understanding.broadCategoryHint,
    contextDependency: understanding.contextDependency,
    contextualAnswer: understanding.contextualAnswer,
    facts: asArray(understanding.facts).map(compactFact),
    testedActions: asArray(understanding.testedActions).map(compactTestedAction),
    uncertainties: understanding.uncertainties
  };
}

function compactAttachmentUnderstanding(attachment: unknown): unknown {
  if (!isRecord(attachment)) {
    return attachment;
  }

  return {
    attachmentIndex: attachment.attachmentIndex,
    status: attachment.status,
    type: attachment.type ?? attachment.mimeType ?? attachment.kind,
    summary: attachment.summary,
    extractedFields: attachment.extractedFields,
    candidateFacts: attachment.candidateFacts,
    visibleElements: attachment.visibleElements,
    unreadableElements: attachment.unreadableElements,
    evidenceQuality: attachment.evidenceQuality,
    limitations: attachment.limitations,
    relatedUnderstandingIds: attachment.relatedUnderstandingIds
  };
}

function compactCue(cue: unknown): unknown {
  if (!isRecord(cue)) {
    return cue;
  }

  return {
    cueId: cue.cueId,
    verbatim: cue.verbatim,
    cueNote: cue.cueNote,
    relatedUnderstandingIds: cue.relatedUnderstandingIds
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
    relatedAttachmentIndexes: proposal.relatedAttachmentIndexes,
    selectedSourceVerbatims: proposal.selectedSourceVerbatims,
    selectedAttachmentEvidence: proposal.selectedAttachmentEvidence,
    updateIntent: proposal.updateIntent,
    newTopic: proposal.newTopic,
    reason: proposal.reason
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
    userGoal: topic.userGoal ?? topic.user_goal,
    blockingIssue: topic.blockingIssue ?? topic.blocking_issue,
    knownFacts: topic.knownFacts ?? topic.topic_details,
    linkedKnowledgeIds:
      topic.linkedKnowledgeIds ?? topic.linked_knowledge_ids,
    missingFields: topic.missingFields,
    previousMediaEvidence:
      topic.previousMediaEvidence ??
      topic.mediaEvidence ??
      topic.attachments ??
      topic.relatedAttachments,
    userLanguage:
      topic.userLanguage ??
      topic.user_language ??
      topic.language ??
      topic.locale,
    refusedFields:
      topic.refusedFields ??
      topic.refused_fields ??
      topic.declinedFields ??
      topic.declined_fields,
    unavailableFields:
      topic.unavailableFields ??
      topic.unavailable_fields ??
      topic.impossibleFields ??
      topic.impossible_fields,
    lastSupportState: topic.lastSupportState
  };
}

function fieldNameFrom(value: unknown): string | null {
  if (typeof value === "string") {
    return value.trim() !== "" ? value.trim() : null;
  }

  if (!isRecord(value)) {
    return null;
  }

  return asString(
    value.fieldName ??
      value.name ??
      value.key ??
      value.id ??
      value.field_id
  );
}

function compactSelectedField(field: unknown): unknown | null {
  const fieldName = fieldNameFrom(field);

  if (!fieldName) {
    return null;
  }

  if (!isRecord(field)) {
    return {
      fieldName
    };
  }

  return {
    fieldName,
    label: field.label ?? field.title,
    description: field.description,
    category:
      field.category ??
      field.broadCategoryHint ??
      field.supportCategory ??
      field.appliesTo,
    priority: field.priority,
    askableByUser: field.askableByUser,
    askWhen: field.askWhen,
    doNotAskWhen: field.doNotAskWhen,
    questionGoal: field.questionGoal,
    examplesOfEvidence: field.examplesOfEvidence,
    notes: field.notes
  };
}

function compactSelectedCatalogKnowledge(value: unknown): unknown {
  if (!isRecord(value)) {
    return {
      selectedFields: [],
      selectedGenericKnowledge: [],
      raw: value
    };
  }

  const rawSelectedFields =
    getValue(value, "selectedFields") ??
    getValue(value, "selectedFieldNames") ??
    getValue(value, "fields");

  const selectedFields = asArray(rawSelectedFields)
    .map(compactSelectedField)
    .filter((field): field is NonNullable<typeof field> => field !== null);

  return {
    selectedFields,
    selectedGenericKnowledge:
      getValue(value, "selectedGenericKnowledge") ??
      getValue(value, "selectedGenericKnowledgeItems") ??
      getValue(value, "selectedGenericKnowledgeIds") ??
      [],
    possibleQuestionFields: getValue(value, "possibleQuestionFields") ?? [],
    limitations: getValue(value, "limitations") ?? [],
    scopeReason: getValue(value, "scopeReason") ?? getValue(value, "reason")
  };
}

function hasUsableGenericCatalogKnowledge(
  selectedCatalogKnowledge: unknown
): boolean {
  if (!isRecord(selectedCatalogKnowledge)) {
    return false;
  }

  return asArray(getValue(selectedCatalogKnowledge, "selectedGenericKnowledge"))
    .length > 0 ||
    asArray(getValue(selectedCatalogKnowledge, "selectedGenericKnowledgeItems"))
      .length > 0;
}

function hasUsableRetrievedKnowledge(
  topicRetrievedKnowledgeSynthesis: unknown
): boolean {
  if (!isRecord(topicRetrievedKnowledgeSynthesis)) {
    return false;
  }

  return asArray(getValue(topicRetrievedKnowledgeSynthesis, "relevantFacts"))
    .length > 0 ||
    asArray(getValue(topicRetrievedKnowledgeSynthesis, "applicableInstructions"))
      .length > 0;
}

function getKnowledgeMode(input: BuildPlanSupportResponsePromptInput): KnowledgeMode {
  const selectedCatalogKnowledge = getValue(input, "selectedCatalogKnowledge");
  const topicRetrievedKnowledgeSynthesis = getValue(
    input,
    "topicRetrievedKnowledgeSynthesis"
  );
  const topicKnowledgeEnrichmentPlan = getValue(
    input,
    "topicKnowledgeEnrichmentPlan"
  );
  const route = getValue(topicKnowledgeEnrichmentPlan, "route");

  if (
    hasUsableGenericCatalogKnowledge(selectedCatalogKnowledge) ||
    hasUsableRetrievedKnowledge(topicRetrievedKnowledgeSynthesis)
  ) {
    return "knowledge_available";
  }

  if (route === "retrieve_knowledge") {
    return "knowledge_missing";
  }

  return "rag_not_enabled";
}

function compactTopicRetrievedKnowledgeSynthesis(value: unknown): unknown | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    relevantFacts: getValue(value, "relevantFacts") ?? [],
    applicableInstructions: getValue(value, "applicableInstructions") ?? [],
    possibleFields: getValue(value, "possibleFields") ?? [],
    unresolvedPoints: getValue(value, "unresolvedPoints") ?? [],
    sourceReferences: getValue(value, "sourceReferences") ?? [],
    limitations: getValue(value, "limitations") ?? [],
    recommendedFirstAnswer:
      getValue(value, "recommendedFirstAnswer") ?? null,
    ifUserConfirmsNotificationsEnabled:
      getValue(value, "ifUserConfirmsNotificationsEnabled") ?? null,
    doNotClaim: getValue(value, "doNotClaim") ?? []
  };
}

function compactTopicKnowledgeEnrichmentPlan(value: unknown): unknown {
  if (!isRecord(value)) {
    return {
      route: "no_retrieval",
      reason: "no_topic_knowledge_enrichment_plan_provided"
    };
  }

  return {
    route: value.route,
    retrievalRequests: value.retrievalRequests,
    reason: value.reason
  };
}

function buildAttachmentEvidenceContext(
  input: BuildPlanSupportResponsePromptInput
): unknown {
  const topicEvidence = getValue(input, "topicEvidence");
  const relatedAttachmentUnderstandings = asArray(
    getValue(topicEvidence, "relatedAttachmentUnderstandings")
  ).map(compactAttachmentUnderstanding);

  const existingTopic =
    getValue(topicEvidence, "existingTopic");

  const previousMediaEvidence = isRecord(existingTopic)
    ? getValue(compactExistingTopic(existingTopic), "previousMediaEvidence")
    : getValue(input, "previousMediaEvidence");

  return {
    hasCurrentAttachments: relatedAttachmentUnderstandings.length > 0,
    relatedAttachmentUnderstandings,
    previousMediaEvidence: previousMediaEvidence ?? null,
    instruction:
      relatedAttachmentUnderstandings.length > 0 ||
      previousMediaEvidence !== undefined
        ? "Evaluate whether the current or previous visual evidence is useful and sufficient for this topic before asking for another screenshot, photo, or video."
        : "No attachment is currently linked to this topic. Request visual evidence only if it would be materially useful and the selected catalog allows such a request."
  };
}

function buildPlanningTask(input: BuildPlanSupportResponsePromptInput): unknown {
  const policy = resolvePolicy(input.responsePlanningPolicy);
  const targetLanguage = getTargetLanguage(input);
  const knowledgeMode = getKnowledgeMode(input);
  const topicEvidence = getValue(input, "topicEvidence");
  const existingTopic = getValue(topicEvidence, "existingTopic");

  return {
    route: "topic_support_response",
    targetLanguage,
    policy: compactPolicy(policy),
    topicUserMessageContent: input.topicUserMessageContent,
    topicContext: {
      proposalId: getValue(topicEvidence, "proposalId"),
      topicId: getValue(topicEvidence, "topicId"),
      topicSourceVerbatims: getValue(topicEvidence, "topicSourceVerbatims"),
      existingTopic: existingTopic ? compactExistingTopic(existingTopic) : null
    },
    topicEvidence: {
      relatedTextUnderstandings: asArray(
        getValue(topicEvidence, "relatedTextUnderstandings")
      ).map(compactUnderstanding),
      relatedAttachmentEvidence: buildAttachmentEvidenceContext(input),
      supportResponseCues: asArray(
        getValue(topicEvidence, "relatedSupportResponseCues")
      ).map(compactCue)
    },
    supportKnowledge: {
      knowledgeMode,
      selectedCatalogKnowledge: compactSelectedCatalogKnowledge(
        getValue(input, "selectedCatalogKnowledge")
      ),
      topicKnowledgeEnrichmentPlan: compactTopicKnowledgeEnrichmentPlan(
        getValue(input, "topicKnowledgeEnrichmentPlan")
      ),
      topicRetrievedKnowledgeSynthesis: compactTopicRetrievedKnowledgeSynthesis(
        getValue(input, "topicRetrievedKnowledgeSynthesis")
      ),
      questionSelectionHints: QUESTION_SELECTION_HINTS,
      mediaEvidenceHints: MEDIA_EVIDENCE_HINTS
    },
    plannerMission: [
      "Plan the response for this one topic only.",
      "Determine whether a directly supported answer is allowed.",
      "Determine which decisive missing fields should be asked together now, within policy.maxQuestionsPerTopic.",
      "Determine whether a screenshot, photo, or video should be requested, avoided, or requested again because existing visual evidence is insufficient.",
      "Produce one strict rendererTask for this topic."
    ]
  };
}

function buildSystemPrompt(): string {
  return `
You are the support response planner for one topic only.

Return exactly one valid JSON object matching the schema.
Do not write the final customer-facing response.

You receive one topic planning task.
Use only this task.

You do not:
- match topics;
- select catalog knowledge;
- retrieve knowledge;
- analyze raw attachments;
- render the final message;
- decide global ordering between multiple topics.

Your output is one strict topic response plan for the renderer.

# Required output

Return exactly:
- responsePlanId
- knowledgeGate
- questionDecision
- rendererTask
- internalRationale

# Decision method

Privately follow this order:

1. Understand the topic.
Identify what the user is asking, reporting, or expecting for this topic only.

2. List what is already known.
Use topicUserMessageContent, topicSourceVerbatims, relatedTextUnderstandings, relatedAttachmentEvidence, and existingTopic.
Use only the current topic evidence. Do not mention or ask about another issue
that may have appeared in the original user message.

3. Evaluate knowledge availability.
Use supportKnowledge.knowledgeMode, selectedCatalogKnowledge, and topicRetrievedKnowledgeSynthesis.

4. Decide whether a supported answer is allowed.
A solution or factual answer is allowed only if directly supported by selected generic catalog knowledge or synthesized retrieved knowledge.

5. Evaluate attachment and media evidence.
If attachments are linked, decide whether they are useful, sufficient, incomplete, irrelevant, unreadable, cropped, or too unclear for this topic.
If previous media evidence exists, account for it before asking again.
Do not request another screenshot, photo, or video if existing evidence is already sufficient.
Request visual evidence only if it would materially help support understand, reproduce, verify, or locate the problem.

6. Identify candidate missing fields.
Use only selected fields from supportKnowledge.selectedCatalogKnowledge.
Do not use fields outside the selected catalog.
Do not ask fields already known from text, attachments, or existing topic context.
Do not ask fields whose askableByUser value is false.
Do not ask fields the user already refused, declined, or said they cannot provide.
Treat a contextual negative answer such as "no" or "non" as an answer to the previously asked field, not as missing information.

For a persistent Android notification issue, when
notification_permission_status is already granted and the latest topic evidence
still reports missing notifications:
- do not ask again whether notifications are enabled or permission is granted;
- apply topicRetrievedKnowledgeSynthesis.ifUserConfirmsNotificationsEnabled
  when available;
- prioritize the next decisive technical fields such as operating_system
  version, device, app_version, and frequency, within the question limits.

7. Select decisive question(s).
Before choosing acknowledgement only, verify that no selected field is both missing and decisive.
Ask in one response all fields that are clearly decisive now, within policy.maxQuestionsPerTopic.
Prefer one question when one field is sufficient.
Do not create unnecessary extra turns when two fields are clearly required now.
Respect policy.maxQuestionsPerTopic and policy.maxTotalQuestions.

8. Generate rendererTask.
Give the renderer direct, strict instructions.
The renderer must not reason about support or add content beyond your plan.

# Knowledge gate rules

Set knowledgeGate.knowledgeMode from planningTask.supportKnowledge.knowledgeMode.

If knowledgeMode is not "knowledge_available":
- solutionAllowed must be false;
- allowedMoves must not include "answer_with_knowledge";
- rendererTask.prompt must not provide a solution, diagnosis, procedure, refund, reference number, status page, timeline, team action, investigation promise, resolution promise, escalation claim, or operational promise.

If knowledgeMode is "knowledge_available":
- solutionAllowed may be true only if the answer is directly supported by selectedGenericKnowledge or topicRetrievedKnowledgeSynthesis.
- rendererTask.prompt may include an answer only when directly supported.
- Treat recommendedFirstAnswer as supported response guidance, not as text that
  must be copied verbatim.
- Carry every doNotClaim and limitation into rendererTask.forbiddenClaims or
  equally strict renderer instructions.

# Question rules

questionDecision must describe all user questions planned for this topic.

Use only field names from supportKnowledge.selectedCatalogKnowledge.selectedFields.

Ask a question only if:
- the field is missing;
- the selected field has askableByUser !== false;
- it is materially useful for this topic;
- it is not already present in the latest user message, related text understandings, related attachment evidence, or existing topic context.
- the user has not already refused it or said they cannot provide it.

Do not ask mechanically from the catalog.
Do not ask the user to retry an action they already tested and reported as failed.
Do not ask browser/platform unless it plausibly matters.
Do not ask amount/currency unless billing impact requires it.
Do not ask for screenshots/photos/videos by default.

If a screenshot/photo/video is useful:
- use the selected catalog field that represents visual evidence if present;
- ask for visual evidence only once and specify what it should show;
- if the user already sent visual evidence but it is insufficient, ask for a clearer or more complete version;
- do not request sensitive data to be visible.

If no selected visual-evidence field exists, do not invent a field name.
Instead, choose another selected decisive field or acknowledgement only.

If shouldAskQuestion is false:
- plannedQuestionCount must be 0;
- fieldNames must be [];
- questionInstruction must be null;
- rendererTask.questionFieldNames must be [];
- rendererTask.prompt must explicitly instruct the renderer not to ask a question.

If shouldAskQuestion is true:
- plannedQuestionCount must equal fieldNames.length;
- fieldNames must contain only selected catalog field names;
- questionInstruction must be in targetLanguage when possible;
- rendererTask.questionFieldNames must equal fieldNames;
- rendererTask.prompt must instruct the renderer to ask only those planned question(s).

# Attachment / media evidence decision

You must account for attachments in the plan when relatedAttachmentEvidence.hasCurrentAttachments is true.

Use these possible internal decisions:
- no_attachment;
- useful_and_sufficient;
- useful_but_incomplete;
- irrelevant_to_topic;
- unusable_or_unreadable;
- previous_media_already_sufficient;
- media_request_useful;
- media_request_not_useful.

Do not add a new top-level output field for this decision unless the schema supports it.
Reflect the decision through:
- questionDecision;
- rendererTask.prompt;
- internalRationale.

# Billing guardrail

For duplicate invoice wording such as "I received my invoice twice":
- do not call it duplicate payment or duplicate charge;
- do not ask amount or currency first;
- if a question is needed, ask whether it is only a duplicate invoice/document/email or whether there is also a duplicate payment/charge;
- use the matching selected catalog field, for example "duplicate_billing_impact" if available.

# Bug guardrail

For bugs, if the user already gave:
- feature/page;
- observed result or error message;
- environment when relevant;
- and a tested action that failed;
then prefer acknowledgement only unless one missing field or visual evidence request is clearly decisive.

# Renderer task rules

rendererTask must contain:
- targetLanguage;
- prompt;
- questionFieldNames;
- forbiddenClaims.

rendererTask.prompt must:
- be a direct instruction to the renderer;
- tell the renderer what to write and what not to add;
- stay concise but complete;
- not expose internal ids, schema names, or pipeline terms to the user;
- not ask the renderer to reason;
- not ask the renderer to evaluate the plan;
- use targetLanguage for user-facing wording instructions.

# Forbidden claims

Unless directly supported and explicitly planned, forbid:
- solution or diagnosis;
- refund or billing correction;
- investigation promise;
- escalation claim;
- human notification claim;
- team action;
- timeline or SLA;
- resolution promise;
- status page or reference number.

Return JSON only.
No markdown.
No unsupported invention.
`.trim();
}

function buildUserPrompt(planningTask: unknown): string {
  return `
Build one topic response plan from this topic planning task only:

\`\`\`json
${toPrettyJson(planningTask)}
\`\`\`
`.trim();
}

function buildPlanSupportResponsePrompt(
  input: BuildPlanSupportResponsePromptInput
): PlanSupportResponsePrompt {
  const planningTask = buildPlanningTask(input);

  return {
    messages: [
      {
        role: "system",
        content: buildSystemPrompt()
      },
      {
        role: "user",
        content: buildUserPrompt(planningTask)
      }
    ]
  };
}

export {
  DEFAULT_RESPONSE_PLANNING_POLICY,
  QUESTION_SELECTION_HINTS,
  MEDIA_EVIDENCE_HINTS,
  buildPlanSupportResponsePrompt
};
