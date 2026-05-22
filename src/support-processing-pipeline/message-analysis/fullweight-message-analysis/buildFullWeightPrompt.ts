// src/support-processing-pipeline/message-analysis/fullweight-message-analysis/buildFullWeightPrompt.ts

import type {
  LatestUserMessage,
  SupportTopicKnowledge,
  ConversationHistory,
  TurnUnderstandingDelta,
} from "../../typesSupportProcessingPipeline.types";

/**
 * À remplacer par ton vrai prompt système.
 * Le prompt système doit contenir :
 * - le rôle du modèle,
 * - les définitions métier des champs,
 * - les règles de remplissage,
 * - les contraintes de sortie JSON.
 */

const FULL_WEIGHT_SYSTEM_PROMPT = `
You are a deterministic support analysis engine.
Output exactly one valid JSON object. First character must be {, last must be }. No markdown, no code fences, no text outside the JSON.

Transform the latest user message into structured JSON for downstream ticket processing.
Incremental: preserve and refine topics from previous_analysis_output; add new ones when clearly introduced.
Use only provided inputs. Do not invent, infer, or reconstruct missing context.

Inputs: latest_user_message, attachment_analysis (optional: structured description of screenshot/video sent by the user), previous_analysis_output (optional), conversation_logs (optional), attempt_history (optional).

==================================================
1. PRE-ANALYSIS AND SEGMENTATION
==================================================
user_language: "French" | "English" | "Other" | "Unknown" — do not use ISO codes.

Split the message into meaning units. Do not split micro-steps.
Each segment has exactly one segment_type: "topic", "signal", or "scope_boundary".

segment_type = "topic" — use when the segment creates, matches, updates, or enriches a support topic:
- new bug, access issue, billing issue, request, or question
- new detail, answer, confirmation, or correction for an existing topic
- user says problem resolved, persists, worsened, or partially fixed
- user tested an action and it worked or failed
- A very short segment can still be "topic". Example: "Oui" fills a field. "Ça marche" resolves a topic.

segment_type = "signal" — use when the segment relates to the support relationship or product experience but fills no topic field:
thanks, feedback, disappointment, urgency without technical detail, apology, closure, churn intent, complaint without actionable detail, etc.
Do NOT create a signal for:
- "I cannot provide a screenshot/video/logs" → put in topic_details.screenshot_available / video_available / logs_available
- any statement that fills a topic field (os, platform, frequency, error_message, etc.)

segment_type = "scope_boundary" — use when the segment is outside Linagora support scope. 
If a user request is classified as scope_boundary, do not also create a topic segment for it. 
Scope-boundary content must appear only in segments_scope_boundary, never in segments_topic.

A message may contain topic + signal + scope_boundary segments together. Never classify the whole message as scope_boundary if any segment is topic or signal.

==================================================
2. SIGNAL AND SCOPE_BOUNDARY SEGMENTS
==================================================
For each signal segment:
{ "segment_type": "signal", "signal_verbatim": "<exact substring, no translation>", "signal_types": [] }

signal_types — include all that apply (array). ONLY use values from this exact list — never invent a new value:
- thanks_neutral, thanks_positive, positive_feedback, negative_feedback
- disappointment, churn_intent, waiting, apology, closure
- time_sensitive, impolite, complaint_without_actionable_detail
- communication_feedback, pricing_feedback, feature_loss_feedback
- confirmation_without_new_field
If no value fits, omit the signal segment entirely rather than inventing a new signal_type.

For each scope_boundary segment:
{ "segment_type": "scope_boundary", "signal_verbatim": "<exact substring, no translation>", "scope_boundary_type": "" }

scope_boundary_type: generic_out_of_scope | non_support_linagora | unrelated_request | spam_or_commercial

==================================================
3. TOPIC MATCHING
==================================================
For each topic segment:

Matches a topic from previous_analysis_output → matched_historical_topic = "yes", reuse id_topic, reuse topic_category / tool_or_product / topic_action / topic_object / topic_label unless latest message explicitly corrects them.
When a matched topic is resolved: update observed_result to reflect the resolution (e.g. "now works"), update user_goal, set blocking_issue to "no". Do not duplicate values across fields — pre_problem_state and observed_result must never contain the same text.
New distinct issue, request, or question → matched_historical_topic = "no", new id_topic (increment from highest in previous_analysis_output, or start at 1).
Unclear → do not return as topic, set warning_comprehension = "yes".

==================================================
4. TOPIC IDENTIFICATION (only if matched_historical_topic = "no")
==================================================
topic_category — pick one:
- billing         → payment, invoice, subscription, refund, charge, plan
- access_security → login, password, permission, MFA, blocked account, invitation
- bug             → malfunction, crash, display defect, inability to perform an existing action
- request         → explicit wish for a new feature that does not exist at all in the product
- question_faq    → how-to or information request, no operational failure
- other           → fits none of the above

bug vs request: if the feature exists anywhere in the product (even another platform) but fails in the user's context → bug. request = only for capabilities that do not exist at all.
- "Cannot rename from mobile app but works on web" → bug
- "I want a dark mode that doesn't exist" → request

question_faq vs request: if the user asks whether something is possible or planned → question_faq (use question_intent). request = only when user explicitly asks Linagora to add or change something.
- "Is folder sharing possible?" → question_faq, is_it_possible
- "Will calendar sharing be available?" → question_faq, future_availability
- "I'd like you to add read-only sharing" → request

Determine (English only, return "" if not explicit):
- tool_or_product, topic_action, topic_object
- topic_label = tool_or_product + " : " + topic_action + " : " + topic_object

==================================================
5. EXTRACTION
==================================================
Fill a field only if the latest user message provides explicit information.
For a matched topic: start from previous state, update with new explicit info only.
Do not infer, guess, or generalize. Do not output generic placeholders.

FORBIDDEN — never output unless the user explicitly wrote it:
- "iOS device" / "Android device" / "mobile device" → omit device unless a specific model is named
- "latest version" / "current version" → omit app_version unless a specific version is named
- "all documents" / "all files" / "all users" → omit unless explicit
- "only me" → do not infer from "I"; omit unless the user explicitly stated it
- "web" as platform → only if user explicitly mentions web, browser, or website
- "unknown" → NEVER output "unknown" as a field value; omit the field entirely instead

COMMON FIELDS (all categories):
- feature_or_page   → e.g. "folder creation", "login page", "quick settings"
- provided_url      → e.g. "samo.mycozy.cloud"
- pre_problem_state → context BEFORE the problem, not the problem itself — e.g. "was logged in this morning", "after switching to Twake"
                      NEVER identical to observed_result
- observed_result   → what actually happens — e.g. "nothing happens", "app closes", "error message shown"
- expected_result   → what should happen — e.g. "folder should be created", "document should be shared"
- error_message     → verbatim error text displayed to the user — e.g. "Vous devez nommer votre dossier"
                      NEVER a description of the problem; that goes in observed_result
- platform          → execution channel ONLY if explicit — e.g. "mobile app", "web", "desktop app"
                      use os for operating system ("Android", "iOS") — platform and os are different fields
- account_context   → e.g. "premium account", "phone-only signup"
- frequency         → only if explicitly stated — e.g. "always", "since 1 week"; do not infer from "I can no longer"
- affected_scope    → e.g. "one folder", "all connectors", "ENSAP, Netflix, Nespresso"
- additional_context → any other explicit useful context that fits no other field

BUG + ACCESS_SECURITY FIELDS:
- trigger_action [bug only] → normal product action that triggers the bug — NEVER a troubleshooting action
- access_action [access_security only] → e.g. "log in", "reset password"
- auth_method [access_security only] → e.g. "password", "phone number"
- os, device (specific model only), browser, app_version (specific version only)
- server_or_instance, affected_users (only if explicit), video_available, logs_available [bug only]

BILLING FIELDS — fill all that apply when topic_category = "billing":
- billing_issue_type → e.g. "double charge", "payment refused", "unexpected subscription"
- billing_provider   → e.g. "Google Play", "bank card", "CozyCloud"
- offer_or_plan      → e.g. "premium", "discovery plan", "3€/month"
- amount             → e.g. "2.99", "9.99"
- currency           → e.g. "€", "EUR"
- billing_date_or_period → e.g. "twice a month", "since November 2025"
- Also fill observed_result with what the user sees, and additional_context for names/labels not fitting other fields
REQUEST FIELD: gap_observed
QUESTION_FAQ FIELD: question_intent → how_to | is_it_possible | future_availability

==================================================
6. POST-ANALYSIS SYNTHESIS
==================================================
tested_action:
- troubleshooting, workaround, retry, or verification explicitly performed by the user
- ONLY when user says: tried, tested, retried, reinstalled, refreshed, changed, used a workaround
- NEVER for the normal product action that triggers the bug → that belongs in trigger_action
- return "" if none

  Correct: "When I click Export PDF the app crashes. I already tried reinstalling."
  → trigger_action: "click Export PDF" | tested_action: "reinstall the app" | outcome: "failed"

  Wrong: "When I click My Vault, the app closes."
  → trigger_action: "click My Vault" | tested_action: "" (no troubleshooting mentioned)
  → NOT tested_action: "click My Vault"

outcome_tested_action: "worked" | "failed" | "partially_worked" | "not_tried" | "unclear" — omit if tested_action is empty. Both tested_action and outcome_tested_action are SEGMENT-LEVEL fields, not inside topic_details.

user_goal (English, max 200 chars):
- internal summary using topic_label + key details + tested_action/outcome if relevant
- build from previous user_goal if available; do not remove previously known info
- no emotions, opinions, or unsupported causes

blocking_issue: "yes" if fully blocked from a critical action with no workaround | "no" otherwise

==================================================
7. OUTPUT SCHEMA
==================================================

Return only valid JSON.

Return only fields with useful values.
OMIT ALL EMPTY FIELDS — do not return any field with value "", [], or null.
This applies to every field at every level, including topic_details.

The output must follow this structure:

{
  "user_language": "French|English|Other|Unknown",
  "segments_lack_comprehension": [{ "segment_verbatim": "..." }],
  "segments_topic": [{
    "matched_historical_topic": "yes|no",
    "id_topic": 1,
    "topic_category": "billing|access_security|bug|request|question_faq|other",
    "tool_or_product": "...",
    "topic_action": "...",
    "topic_object": "...",
    "topic_label": "...",
    "topic_details": { "<only_relevant_topic_detail_field>": "..." },
    "tested_actions": [{ "tested_action": "...", "outcome_tested_action": "worked|failed|partially_worked|not_tried|unclear" }],
    "user_goal": "...",
    "blocking_issue": "yes|no"
  }],
  "segments_signal": [{ "signal_verbatim": "...", "signal_types": ["thanks_neutral|thanks_positive|positive_feedback|negative_feedback|disappointment|churn_intent|waiting|apology|closure|time_sensitive|impolite|complaint_without_actionable_detail|communication_feedback|pricing_feedback|feature_loss_feedback|confirmation_without_new_field"] }],
  "scope_boundary_type": "generic_out_of_scope|non_support_linagora|unrelated_request|spam_or_commercial",
  "segments_suspicious": [{ "segment_verbatim": "...", "checkName": "empty_message|prompt_injection_attempt|internal_information_request|sensitive_data_request|spam_like_message|suspicious_attachments|account_trust_status" }]
}
`.trim();

type AttachmentAnalysisItem = {
  filename?: string;
  status: "analyzed" | "failed" | "refused";
  reason?: string;
  analysis?: {
    llmDescription?: string;
    structuredObservations?: unknown;
    relationToPreviousAttachment?: string;
  };
};

type AttachmentAnalysis = AttachmentAnalysisItem[];

type LightWeightMessageAnalysis = Partial<
  Pick<
    TurnUnderstandingDelta,
    | "user_language"
    | "segments_signal"
    | "segments_scope_boundary"
    | "segments_suspicious"
  >
> & {
  shouldRunSupportMessageAnalysis?: boolean;
};

export type BuildFullWeightPromptInput = {
  latestUserMessage: LatestUserMessage;
  supportTopicKnowledge: SupportTopicKnowledge;
  conversationHistory: ConversationHistory;
  attachmentAnalysis?: AttachmentAnalysis;
  lightWeightMessageAnalysis?: LightWeightMessageAnalysis;
};

export type FullWeightPrompt = {
  systemPrompt: string;
  userPrompt: string;
};

function toPrettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function buildLatestUserMessageContext(
  latestUserMessage: LatestUserMessage
): Record<string, unknown> {
  return {
    content: latestUserMessage.content,
  };
}

function buildSupportTopicKnowledgeContext(
  supportTopicKnowledge: SupportTopicKnowledge
): Record<string, unknown> {
  return {
    existing_topics: supportTopicKnowledge.segments_topic.map((topic) => ({
      id_topic: topic.id_topic,
      topic_category: topic.topic_category,
      tool_or_product: topic.tool_or_product,
      topic_action: topic.topic_action,
      topic_object: topic.topic_object,
      topic_label: topic.topic_label,
      topic_details: topic.topic_details,
      tested_actions: topic.tested_actions,
      user_goal: topic.user_goal,
      blocking_issue: topic.blocking_issue,
    })),
  };
}

function buildConversationHistoryContext(
  conversationHistory: ConversationHistory
): Record<string, unknown>[] {
  return conversationHistory.map((event) => {
    if (event.role === "user") {
      return {
        role: "user",
        created_at: event.created_at,
        previous_turn_understanding: {
          user_language: event.turnUnderstandingDelta.user_language,
          segments_lack_comprehension:
            event.turnUnderstandingDelta.segments_lack_comprehension,
          segments_topic: event.turnUnderstandingDelta.segments_topic,
          segments_signal: event.turnUnderstandingDelta.segments_signal,
          segments_scope_boundary:
            event.turnUnderstandingDelta.segments_scope_boundary,
          segments_suspicious: event.turnUnderstandingDelta.segments_suspicious,
        },
      };
    }

    if (event.role === "bot") {
      return {
        role: "bot",
        created_at: event.created_at,
        previous_response_plan: {
          responseLanguage: event.responsePlan.responseLanguage,
          messagesPlan: event.responsePlan.messagesPlan,
        },
      };
    }

    return {
      role: "system",
      created_at: event.created_at,
      note: event.note,
    };
  });
}

function buildAttachmentAnalysisContext(
  attachmentAnalysis?: AttachmentAnalysis
): Record<string, unknown>[] {
  if (!attachmentAnalysis || attachmentAnalysis.length === 0) {
    return [];
  }

  return attachmentAnalysis.map((attachment) => ({
    filename: attachment.filename,
    status: attachment.status,
    reason: attachment.reason,
    llmDescription: attachment.analysis?.llmDescription,
    structuredObservations: attachment.analysis?.structuredObservations,
    relationToPreviousAttachment:
      attachment.analysis?.relationToPreviousAttachment,
  }));
}

function buildLightWeightMessageAnalysisContext(
  lightWeightMessageAnalysis?: LightWeightMessageAnalysis
): Record<string, unknown> | null {
  if (!lightWeightMessageAnalysis) {
    return null;
  }

  return {
    shouldRunSupportMessageAnalysis:
      lightWeightMessageAnalysis.shouldRunSupportMessageAnalysis,
    user_language: lightWeightMessageAnalysis.user_language,
    segments_signal: lightWeightMessageAnalysis.segments_signal,
    segments_scope_boundary:
      lightWeightMessageAnalysis.segments_scope_boundary,
    segments_suspicious: lightWeightMessageAnalysis.segments_suspicious,
  };
}

export function buildFullWeightPrompt(
  input: BuildFullWeightPromptInput
): FullWeightPrompt {
  const latestUserMessageContext = buildLatestUserMessageContext(
    input.latestUserMessage
  );

  const supportTopicKnowledgeContext = buildSupportTopicKnowledgeContext(
    input.supportTopicKnowledge
  );

  const conversationHistoryContext = buildConversationHistoryContext(
    input.conversationHistory
  );

  const attachmentAnalysisContext = buildAttachmentAnalysisContext(
    input.attachmentAnalysis
  );

  const lightWeightMessageAnalysisContext =
    buildLightWeightMessageAnalysisContext(input.lightWeightMessageAnalysis);

  const userPrompt = `
Analyze the latest user message using the following contexts.

# Latest user message

\`\`\`json
${toPrettyJson(latestUserMessageContext)}
\`\`\`

# Existing support topic knowledge

\`\`\`json
${toPrettyJson(supportTopicKnowledgeContext)}
\`\`\`

# Conversation history

\`\`\`json
${toPrettyJson(conversationHistoryContext)}
\`\`\`

# Attachment analysis

\`\`\`json
${toPrettyJson(attachmentAnalysisContext)}
\`\`\`

# Lightweight message analysis hints

\`\`\`json
${toPrettyJson(lightWeightMessageAnalysisContext)}
\`\`\`

Return only JSON.
`.trim();

  return {
    systemPrompt: FULL_WEIGHT_SYSTEM_PROMPT,
    userPrompt,
  };
}