import type {
  BuildPlanSupportResponsePromptInput,
  PlanSupportResponsePrompt,
  ResponsePlanningPolicy
} from "./typesPlanSupportResponse.types";
import {
  normalizeUserLanguageForResponse
} from "../response-language/normalizeUserLanguageForResponse";

const DEFAULT_RESPONSE_PLANNING_POLICY: ResponsePlanningPolicy = {
  supportStrictness: "standard",
  botAutonomy: "standard",
  userAutonomy: "unknown",
  customerToneProfile: "standard",
  maxQuestionsPerTopic: 2,
  maxTotalQuestions: 3
};

const TOPIC_RESPONSE_DECISIONS = [
  "answer",
  "ask",
  "answer_and_ask",
  "acknowledge",
  "review"
] as const;

function toPromptJson(value: unknown): string {
  return JSON.stringify(value);
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
    maxQuestionsPerTopic: policy.maxQuestionsPerTopic
  };
}

function getTargetLanguage(input: BuildPlanSupportResponsePromptInput): string {
  const explicitTargetLanguage = asString(getValue(input, "targetLanguage"));

  if (explicitTargetLanguage) {
    return normalizeUserLanguageForResponse(explicitTargetLanguage);
  }

  const topicEvidence = getValue(input, "topicEvidence");
  const existingTopic =
    getValue(input, "existingTopic") ?? getValue(topicEvidence, "existingTopic");

  const knownTopicLanguage = asString(
    getValue(existingTopic, "userLanguage") ??
      getValue(existingTopic, "user_language") ??
      getValue(existingTopic, "language") ??
      getValue(existingTopic, "locale")
  );

  if (knownTopicLanguage) {
    return normalizeUserLanguageForResponse(knownTopicLanguage);
  }

  return "en";
}

function compactUnderstanding(understanding: unknown): unknown {
  if (!isRecord(understanding)) {
    return understanding;
  }

  return {
    understandingId: understanding.understandingId,
    sourceSegmentIds: understanding.sourceSegmentIds,
    messageKinds: understanding.messageKinds,
    caseDetails: understanding.caseDetails,
    attemptedActions: understanding.attemptedActions,
    summary: understanding.summary
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

function compactExistingTopic(topic: unknown): unknown {
  if (!isRecord(topic)) {
    return topic;
  }

  return {
    id: topic.id ?? topic.topicId ?? topic.id_topic,
    title: topic.title ?? topic.topic_title ?? topic.topic_label,
    broadCategoryHint: topic.broadCategoryHint ?? topic.topic_category ?? null,
    summary: topic.summary ?? null,
    caseDetails:
      topic.caseDetails ??
      topic.case_details ??
      topic.knownFacts ??
      topic.topic_details ??
      [],
    attemptedActions:
      topic.attemptedActions ??
      topic.attempted_actions ??
      topic.testedActions ??
      topic.tested_actions ??
      [],
    previousMediaEvidence:
      topic.previousMediaEvidence ??
      topic.mediaEvidence ??
      topic.attachments ??
      topic.relatedAttachments ??
      null,
    refusedFields:
      topic.refusedFields ??
      topic.refused_fields ??
      topic.declinedFields ??
      topic.declined_fields ??
      [],
    unavailableFields:
      topic.unavailableFields ??
      topic.unavailable_fields ??
      topic.impossibleFields ??
      topic.impossible_fields ??
      [],
    userLanguage:
      topic.userLanguage ??
      topic.user_language ??
      topic.language ??
      topic.locale ??
      null
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
    label: field.label ?? field.title ?? null,
    askableByUser: field.askableByUser,
    priority: field.priority,
    questionGoal: field.questionGoal ?? field.description ?? null
  };
}

function compactSelectedCatalogKnowledge(value: unknown): unknown {
  if (!isRecord(value)) {
    return {
      selectedFields: [],
      selectedGenericKnowledge: []
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

  return (
    asArray(getValue(selectedCatalogKnowledge, "selectedGenericKnowledge"))
      .length > 0 ||
    asArray(getValue(selectedCatalogKnowledge, "selectedGenericKnowledgeItems"))
      .length > 0
  );
}

function hasUsableRetrievedKnowledge(
  topicRetrievedKnowledgeSynthesis: unknown
): boolean {
  if (!isRecord(topicRetrievedKnowledgeSynthesis)) {
    return false;
  }

  return (
    asArray(getValue(topicRetrievedKnowledgeSynthesis, "relevantFacts"))
      .length > 0 ||
    asArray(getValue(topicRetrievedKnowledgeSynthesis, "applicableInstructions"))
      .length > 0 ||
    asArray(getValue(topicRetrievedKnowledgeSynthesis, "recommendedAnswerPoints"))
      .length > 0
  );
}

function getKnowledgeMode(input: BuildPlanSupportResponsePromptInput): string {
  const selectedCatalogKnowledge = getValue(input, "selectedCatalogKnowledge");
  const topicRetrievedKnowledgeSynthesis = getValue(
    input,
    "topicRetrievedKnowledgeSynthesis"
  );
  const topicKnowledgeEnrichmentPlan = getValue(
    input,
    "topicKnowledgeEnrichmentPlan"
  );

  if (
    hasUsableGenericCatalogKnowledge(selectedCatalogKnowledge) ||
    hasUsableRetrievedKnowledge(topicRetrievedKnowledgeSynthesis)
  ) {
    return "knowledge_available";
  }

  if (getValue(topicKnowledgeEnrichmentPlan, "route") === "retrieve_knowledge") {
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
    recommendedAnswerPoints: getValue(value, "recommendedAnswerPoints") ?? [],
    recommendedQuestions: getValue(value, "recommendedQuestions") ?? [],
    possibleFields: getValue(value, "possibleFields") ?? [],
    unresolvedPoints: getValue(value, "unresolvedPoints") ?? [],
    limitations: getValue(value, "limitations") ?? [],
    doNotClaim: getValue(value, "doNotClaim") ?? [],
    recommendedFirstAnswer: getValue(value, "recommendedFirstAnswer") ?? null
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
): unknown | null {
  const topicEvidence = getValue(input, "topicEvidence");
  const relatedAttachmentUnderstandings = asArray(
    getValue(topicEvidence, "relatedAttachmentUnderstandings")
  ).map(compactAttachmentUnderstanding);

  const existingTopic = getValue(topicEvidence, "existingTopic");
  const compactTopic = existingTopic ? compactExistingTopic(existingTopic) : null;
  const previousMediaEvidence = isRecord(compactTopic)
    ? getValue(compactTopic, "previousMediaEvidence")
    : null;

  if (relatedAttachmentUnderstandings.length === 0 && !previousMediaEvidence) {
    return null;
  }

  return {
    currentAttachments: relatedAttachmentUnderstandings,
    previousMediaEvidence: previousMediaEvidence ?? null
  };
}

function buildPlanningTask(input: BuildPlanSupportResponsePromptInput): unknown {
  const policy = resolvePolicy(input.responsePlanningPolicy);
  const targetLanguage = getTargetLanguage(input);
  const knowledgeMode = getKnowledgeMode(input);
  const topicEvidence = getValue(input, "topicEvidence");
  const existingTopic = getValue(topicEvidence, "existingTopic");

  return {
    targetLanguage,
    policy: compactPolicy(policy),
    topicUserMessageContent: input.topicUserMessageContent,
    topic: existingTopic ? compactExistingTopic(existingTopic) : null,
    relatedTextUnderstandings: asArray(
      getValue(topicEvidence, "relatedTextUnderstandings")
    ).map(compactUnderstanding),
    relatedAttachmentEvidence: buildAttachmentEvidenceContext(input),
    supportResponseCues: asArray(
      getValue(topicEvidence, "relatedSupportResponseCues")
    ).map(compactCue),
    knowledge: {
      knowledgeMode,
      selectedCatalogKnowledge: compactSelectedCatalogKnowledge(
        getValue(input, "selectedCatalogKnowledge")
      ),
      topicKnowledgeEnrichmentPlan: compactTopicKnowledgeEnrichmentPlan(
        getValue(input, "topicKnowledgeEnrichmentPlan")
      ),
      retrievedKnowledge: compactTopicRetrievedKnowledgeSynthesis(
        getValue(input, "topicRetrievedKnowledgeSynthesis")
      )
    }
  };
}

function buildSystemPrompt(): string {
  return `
You are the support response planner for one topic only.

Return exactly one valid JSON object.
Do not write the final customer-facing response.

You receive one topic planning task.
Use only this topic.
Do not match topics, retrieve knowledge, analyze attachments, decide global ordering, add greetings, add global apologies, or render the final message.

Your job:
decide what the final renderer should say, ask, and avoid for this topic.

# Decisions

Use one decision:
${TOPIC_RESPONSE_DECISIONS.join(" | ")}

answer:
Use when directly supported knowledge allows a useful answer and no decisive user question is needed.

ask:
Use when a decisive missing field is needed before a supported answer can be given.

answer_and_ask:
Use when you can provide a directly supported partial answer and still need one or more decisive fields.

acknowledge:
Use when there is no directly supported answer and no decisive selected field to ask now.

review:
Use when the topic is too ambiguous or risky to plan safely.

# Knowledge rules

If knowledge.knowledgeMode is not "knowledge_available":
- do not provide a solution, diagnosis, procedure, refund, reference number, status page, timeline, investigation promise, resolution promise, escalation claim, or team action;
- choose ask if a decisive selected field is missing;
- otherwise choose acknowledge or review.

If knowledge.knowledgeMode is "knowledge_available":
- say may include only points directly supported by selectedGenericKnowledge or retrievedKnowledge;
- carry retrieved limitations and doNotClaim into forbid when relevant;
- do not copy recommendedFirstAnswer verbatim unless it is already suitable as an instruction.

# Question rules

ask must contain only fields from knowledge.selectedCatalogKnowledge.selectedFields.

Ask a field only when it is:
- missing from the latest topic message, related understandings, attachments, and existing topic;
- askableByUser is not false;
- decisive for this topic now;
- not already refused, unavailable, or answered;
- not asking the user to retry an action already attempted and reported as failed.

Do not ask browser, platform, amount, currency, screenshot, photo, or video mechanically.

Screenshots/photos/videos are not default requests.
Ask for visual evidence only if a selected field supports it and it would materially help understand, reproduce, verify, or locate the issue.
If current or previous visual evidence is already sufficient, do not ask again.

# Guardrails

Duplicate invoice/document/email does not mean duplicate payment or duplicate charge unless the user explicitly says they were charged or debited twice.

For bugs, if the user already gave the affected feature/page, observed result or error, relevant environment, and failed attempted action, prefer acknowledge unless one selected decisive field is still missing.

Do not expose internal ids, schema names, or pipeline terms to the user.

# Output shape

{
  "topicId": "topic id or null",
  "decision": "answer|ask|answer_and_ask|acknowledge|review",
  "say": [
    "short instruction for what the final renderer should say about this topic"
  ],
  "ask": [
    {
      "fieldName": "selected catalog field name",
      "goal": "why this field is needed now"
    }
  ],
  "forbid": [
    "topic-specific claim or action the renderer must avoid"
  ],
  "review": "short reason or null"
}

# Output rules

say is an instruction list, not the final answer.
ask is an instruction list, not the final wording.
forbid must include unsupported claims that are risky for this topic.
review must be non-null only when decision is review.
If decision is not review, review must be null.
If decision is answer or acknowledge, ask must be [].
If decision is ask, say may still include a brief acknowledgement instruction.
If decision is answer_and_ask, both say and ask must be non-empty.

Return JSON only.
No markdown.
No unsupported invention.
`.trim();
}

function buildUserPrompt(planningTask: unknown): string {
  return `
Build one topic response plan from this topic planning task only:
${toPromptJson(planningTask)}
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
  buildPlanSupportResponsePrompt
};