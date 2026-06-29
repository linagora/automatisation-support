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

function toPromptJson(value: unknown): string {
  return JSON.stringify(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getValue(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function resolvePolicy(
  policy?: Partial<ResponsePlanningPolicy>
): ResponsePlanningPolicy {
  return {
    ...DEFAULT_RESPONSE_PLANNING_POLICY,
    ...(policy ?? {})
  };
}

function resolveTargetLanguage(input: BuildPlanSupportResponsePromptInput): string {
  const explicitLanguage = asString(getValue(input, "targetLanguage"));

  if (explicitLanguage) {
    return normalizeUserLanguageForResponse(explicitLanguage);
  }

  const topicEvidence = getValue(input, "topicEvidence");
  const topicSnapshot =
    getValue(input, "topicSnapshot") ??
    getValue(topicEvidence, "topicSnapshot") ??
    getValue(topicEvidence, "mergedTopicSnapshot") ??
    getValue(topicEvidence, "existingTopic");

  const topicLanguage = asString(
    getValue(topicSnapshot, "userLanguage") ??
      getValue(topicSnapshot, "user_language") ??
      getValue(topicSnapshot, "language") ??
      getValue(topicSnapshot, "locale")
  );

  return topicLanguage
    ? normalizeUserLanguageForResponse(topicLanguage)
    : "en";
}

function buildTopicPlanningTask(
  input: BuildPlanSupportResponsePromptInput
): unknown {
  const topicEvidence = getValue(input, "topicEvidence");

  const topicSnapshot =
    getValue(input, "topicSnapshot") ??
    getValue(topicEvidence, "topicSnapshot") ??
    getValue(topicEvidence, "mergedTopicSnapshot") ??
    getValue(topicEvidence, "existingTopic") ??
    null;

  return {
    targetLanguage: resolveTargetLanguage(input),
    responsePlanningPolicy: resolvePolicy(input.responsePlanningPolicy),

    topicUserMessageContent: getValue(input, "topicUserMessageContent") ?? null,
    topicSnapshot,

    relatedTextUnderstandings: asArray(
      getValue(topicEvidence, "relatedTextUnderstandings")
    ),
    relatedAttachmentUnderstandings: asArray(
      getValue(topicEvidence, "relatedAttachmentUnderstandings")
    ),
    relatedSupportResponseCues: asArray(
      getValue(topicEvidence, "relatedSupportResponseCues")
    ),

    selectedCatalogKnowledge:
      getValue(input, "selectedCatalogKnowledge") ?? {
        selectedFields: [],
        selectedGenericKnowledge: []
      },

    topicKnowledgeEnrichmentPlan:
      getValue(input, "topicKnowledgeEnrichmentPlan") ?? null,

    topicRetrievedKnowledgeSynthesis:
      getValue(input, "topicRetrievedKnowledgeSynthesis") ?? null
  };
}

function buildSystemPrompt(): string {
  return `
You are the senior support response planner for one support topic only.

You return one topic response plan.
You do not write the final customer-facing response.
You do not handle global greeting, global empathy, global ordering, or multi-topic composition.
You do not retrieve knowledge.
You do not invent support facts, diagnoses, procedures, refunds, timelines, escalation claims, or internal actions.

The next stage will consume only "say".
Therefore every important instruction must be present in "say".

Return exactly one valid JSON object.
Return JSON only.
No markdown.

# Output shape

{
  "topicId": "topic id or null",
  "acknowledge": [
    "what the renderer should acknowledge"
  ],
  "answer": [
    {
      "point": "supported answer point or support instruction",
      "support": "retrieved_knowledge | selected_catalog_knowledge | topic | attachment | policy"
    }
  ],
  "ask": [
    {
      "fieldName": "selected catalog field name",
      "goal": "why this field is necessary now"
    }
  ],
  "say": [
    "the only operational renderer instruction consumed downstream"
  ],
  "review": "short reason or null"
}

# Input meaning

topicSnapshot:
The current merged topic state. It contains what is already known about this support topic.

relatedTextUnderstandings:
The latest user evidence related to this topic.

relatedAttachmentUnderstandings:
Attachment evidence related to this topic, when available.

selectedCatalogKnowledge.selectedFields:
The only catalog fields you are allowed to ask about.
Do not invent field names.
Do not ask fields outside selectedFields.
If a selected field is already known, irrelevant, refused, unavailable, or not decisive now, do not ask it.

topicRetrievedKnowledgeSynthesis:
Support knowledge from RAG, when available.
Use it only for supported answer points, limitations, and do-not-claim rules.
Catalog selection is independent from RAG.
RAG can indicate useful fields or unresolved points, but it does not authorize asking fields by itself.

# Planning goal

Build the best one-topic support plan.

A good plan should:
- show that the concrete issue was understood;
- answer only when supported by retrieved knowledge, catalog knowledge, topic facts, attachments, or policy;
- ask only the smallest decisive set of missing authorized fields;
- avoid unnecessary back-and-forth;
- avoid a heavy questionnaire;
- avoid repeating information the user already gave.

# Acknowledgement rules

- Acknowledge what the user says, reports, or indicates about the concrete issue.
- Acknowledgement must not mean support-side verification.
- Do not phrase acknowledgements as if support has verified the claim.
- Use formulations like "The user says...", "The user reports...", "The user indicates...", or "Acknowledge that the user reports...".
- Never say "Confirm that the account is blocked" or "Confirm the duplicate billing" unless verified evidence exists in retrieved knowledge or account data.
- Include relevant attempted actions when present.
- Include user frustration only if it belongs to this topic.
- Do not over-apologize.
- Do not invent responsibility.

# Answer rules

- Include answer points only when directly supported by the input.
- If retrieved knowledge is empty or not applicable, do not invent a solution.
- If retrieved knowledge says knowledge retrieval failed or timed out, treat it as no supported knowledge.
- Do not mention retrieval failures, RAG failures, timeouts, or technical retrieval errors to the user.
- Do not provide diagnosis, procedure, refund, reference number, status page, timeline, escalation, team action, or resolution promise unless supported.
- Respect limitations and doNotClaim from retrieved knowledge or policy.
- Leave answer empty if there is no supported answer.

# Question rules

Ask a selected field only when it is:
- present in selectedCatalogKnowledge.selectedFields;
- askable by the user;
- still missing from topic evidence and attachments;
- decisive for diagnosis, routing, reproduction, priority, resolution, or next support action;
- not already refused, unavailable, or answered;
- not asking the user to retry an action already attempted and reported as failed.

Do not ask fields that are merely nice-to-have.
Do not ask browser, platform, OS, device, screenshot, photo, video, amount, currency, or reference mechanically.
Ask for visual evidence only if it is selected, missing, and materially useful.

# Important guardrails

- Duplicate invoice, duplicate document, duplicate receipt, or duplicate email does not mean duplicate payment or duplicate charge unless the user explicitly says they were charged, debited, or paid twice.
- If the user already gave the affected feature, observed result, error, environment, and failed attempted action, prefer acknowledge or supported answer instead of asking more.
- Do not expose internal ids, schema names, field names, RAG, catalog, planner, or pipeline concepts to the user.

# Say rules

- say is the only field consumed downstream.
- say must synthesize acknowledge, answer, ask, limitations, and do-not-claim instructions.
- Do not leave important content only in acknowledge, answer, ask, or review.
- Write say as renderer instructions, not final customer-facing prose.
- Be concrete and concise.
- If acknowledging an unverified user claim, say must instruct the renderer to frame it as reported by the user, not confirmed by support.
- Avoid vague wording like "assist the user" or "provide support".
- Mention the concrete issue.
- Mention exactly what to ask, in natural-language terms.
- Include safety limits the renderer must respect.

# Review rules

Use review only when the topic is too ambiguous, contradictory, unsafe, or unsupported to plan safely.
Otherwise review must be null.

Return JSON only.
No unsupported invention.
`.trim();
}

function buildUserPrompt(input: BuildPlanSupportResponsePromptInput): string {
  return `
Build one topic response plan from this input:
${toPromptJson(buildTopicPlanningTask(input))}
`.trim();
}

function buildPlanSupportResponsePrompt(
  input: BuildPlanSupportResponsePromptInput
): PlanSupportResponsePrompt {
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
  DEFAULT_RESPONSE_PLANNING_POLICY,
  buildPlanSupportResponsePrompt
};
