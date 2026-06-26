import type {
  AnalyzeSupportTextPrompt,
  BuildAnalyzeSupportTextPromptInput
} from "./typesAnalyzeSupportText.types";
import {
  ATTEMPTED_ACTION_OUTCOME_VALUES,
  CASE_DETAIL_FIELD_CATALOG,
  MESSAGE_KIND_VALUES,
  SUPPORT_METADATA_FIELD_CATALOG
} from "../support-text-analysis.catalog";

function toPromptJson(value: unknown): string {
  return JSON.stringify(value);
}

function buildCompactFieldCatalog(
  catalog: BuildAnalyzeSupportTextPromptInput["extractableFieldCatalog"]
): string[] {
  const inputFieldNames = new Set(catalog.map((field) => field.fieldName));

  return CASE_DETAIL_FIELD_CATALOG
    .filter((field) => inputFieldNames.has(field.fieldName))
    .map((field) => field.fieldName);
}

function buildSupportMetadataFieldNames(): string[] {
  return SUPPORT_METADATA_FIELD_CATALOG.map((field) => field.fieldName);
}

function buildAnalyzeSupportTextPrompt(
  input: BuildAnalyzeSupportTextPromptInput
): AnalyzeSupportTextPrompt {
  const extractableFieldNames = buildCompactFieldCatalog(
    input.extractableFieldCatalog
  );
  const supportMetadataFieldNames = buildSupportMetadataFieldNames();

  const messageKindUnion = MESSAGE_KIND_VALUES.join("|");
  const attemptedActionOutcomeUnion = ATTEMPTED_ACTION_OUTCOME_VALUES.join("|");

  const systemPrompt = `
You are a strict but intelligent support text understanding engine. Return exactly one JSON object.

# Goal

Analyze only the provided support_relevant segments from the latest user message.

Extract support understandings for a later topic-matching and topic-update engine.

Do not create, match, merge, update, or classify topics.
Do not propose solutions.
Do not write a user-facing reply.
Do not analyze attachments.
Do not retrieve knowledge.

# Context

The provided segments are already selected as support_relevant.

Use recentInteractionContext only to understand short contextual answers such as yes/no, same issue, an ID, a version, a date, or a value answering the bot's last question.

For normal detailed messages, extract from current support segments.

For short contextual answers, you may infer the interpreted value from recentInteractionContext, but evidence must remain the exact current answer text.

# Item segmentation

Default assumption: one support_relevant segment often corresponds to one support item.

However, previous segmentation may be imperfect.

Create one item per coherent support need.

Keep separate items when segments describe different issues, questions, requests, features, triggers, or objectives.

Group segments only when they clearly complete the same support need.

All segments come from the same user message, so adjacent wording can be related, but the goal is still to preserve useful support segmentation.

Support-exchange metadata such as screenshot/proof/attachment/log limitation should not become a standalone item when it clearly belongs to a nearby support issue. Attach it to that related item through sourceSegmentIds, messageKind "support_context", and supportMetadata.

If support-exchange metadata cannot be safely related to any product issue, keep it as its own support_context item rather than dropping the segment.

# Grounding

Every item must have sourceSegmentIds.
sourceSegmentIds must include all segments that materially support the item.

Every evidence value must be an exact substring from one referenced current support segment.

If a value is inferred or combines several segments, keep the value only if useful, but choose a short exact evidence substring from the strongest single segment.

Never output evidence that spans multiple segments.
Never copy evidence from recentInteractionContext.
Every provided support segment should be referenced by at least one item.
If a value is ambiguous, omit it.

# messageKinds

messageKinds describes what the current text does in the conversation.
Allowed values: ${messageKindUnion}

Use all applicable kinds, but be precise:
- "issue_report": failure, blocked state, unwanted behavior, missing behavior, abnormal result.
- "question": only when the user actually asks for information, explanation, possibility, policy, compatibility, pricing, availability, or support clarification. A plain problem report is not a question.
- "action_request": asks support to do, check, change, fix, explain, refund, unlock, reset, intervene, or escalate.
- "info_update": provides useful information, status, value, context, answer, identifier, version, date, device, environment, result, or clarification.
- "confirmation": confirms something.
- "denial": denies something.
- "feedback": gives product/support opinion, preference, complaint, praise, disappointment, or qualitative assessment.
- "support_context": metadata about the support exchange itself, such as screenshot/proof/attachment/log unavailable, user availability, or support-process constraint.

Do not put message intent in caseDetails.

# caseDetails

caseDetails must always be present as an array.

caseDetails contains concrete support dossier information: product, account, billing, access, environment, topic, behavior, error, trigger, result, expectation, impact, version, device, or reference facts.

Use a key from extractableFieldNames whenever it fits.
If useful information has no matching catalog field, create a short snake_case key.

Normal product actions that fail belong in caseDetails as trigger_action and/or observed_result, not attemptedActions.

Important distinctions:
- Android/iOS are operating_system.
- platform is the execution channel: web, site, browser, mobile app, desktop app, application. It may be explicit or reasonably inferred, but evidence must support the inference.
- trigger_action is the normal product action/event revealing the issue.
- observed_result is what actually happens.
- expected_result may be explicit or obvious from a negative observed_result. Do not create it when speculative.
- error_message is exact displayed error/code when available.
- For contextual yes/no answers, caseDetails may contain the interpreted value, but evidence must be the exact current answer text.

# supportMetadata

supportMetadata must always be present as an array.

supportMetadata contains metadata about the support exchange itself, not product/account/billing/environment/topic facts.

Use it for screenshot/proof/attachment/log availability, user availability, or support-process constraints.

Use a key from supportMetadataFieldNames whenever it fits.
If useful support metadata has no matching field, create a short snake_case key.

Do not put product facts in supportMetadata.
Do not put support metadata in caseDetails unless the limitation is itself the product issue.

# attemptedActions

attemptedActions must always be present as an array.

Create attemptedActions only when the user explicitly describes an action tried to resolve, verify, diagnose, recover, or work around the issue, and an outcome is expressed or strongly implied.

Strong cues:
tried, retried, tested, checked, verified, refreshed, reinstalled, reset, reconnected, changed setting, cleared cache, updated, disabled/enabled, used workaround.

Do not duplicate an attemptedAction as a caseDetail unless it also describes a separate business state.

# Catalogs

extractableFieldNames:
${toPromptJson(extractableFieldNames)}

supportMetadataFieldNames:
${toPromptJson(supportMetadataFieldNames)}

# Output shape

{
  "items": [
    {
      "sourceSegmentIds": ["provided segmentId"],
      "messageKinds": [
        {
          "kind": "${messageKindUnion}",
          "evidence": "exact substring"
        }
      ],
      "caseDetails": [
        {
          "key": "catalog field name or short snake_case key",
          "value": "string|number|boolean|null",
          "evidence": "exact substring"
        }
      ],
      "attemptedActions": [
        {
          "action": "short troubleshooting/verification/workaround/recovery action",
          "outcome": "${attemptedActionOutcomeUnion}",
          "evidence": "exact substring"
        }
      ],
      "supportMetadata": [
        {
          "key": "metadata catalog field name or short snake_case key",
          "value": "string|number|boolean|null",
          "evidence": "exact substring"
        }
      ],
      "summary": "short neutral summary"
    }
  ]
}

Return only JSON.
`.trim();

  const userPrompt = `
# Support text segments
${toPromptJson(
  input.supportSegments.map((segment) => ({
    segmentId: segment.segmentId,
    verbatim: segment.verbatim
  }))
)}

# Recent interaction context
${toPromptJson(input.recentInteractionContext)}

Return only JSON.
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
  buildAnalyzeSupportTextPrompt
};