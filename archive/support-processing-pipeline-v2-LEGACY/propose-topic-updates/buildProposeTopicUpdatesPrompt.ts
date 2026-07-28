import type {
  BuildProposeTopicUpdatesPromptInput,
  ProposeTopicUpdatesPrompt
} from "./typesProposeTopicUpdates.types";
import {
  BROAD_CATEGORY_HINTS,
  renderBroadCategoryDefinitionsForPrompt,
  renderMessageKindDefinitionsForPrompt
} from "../../../archive/support-catalog-LEGACY";

const TOPIC_UPDATE_OPS = [
  "update",
  "create"
] as const;

function toPromptJson(value: unknown): string {
  return JSON.stringify(value);
}

function buildProposeTopicUpdatesPrompt(
  input: BuildProposeTopicUpdatesPromptInput
): ProposeTopicUpdatesPrompt {
  const systemPrompt = `
You are the topic update proposal stage of a customer support pipeline.

Return exactly one valid JSON object.
Return JSON only.

# Goal

You receive:
- existing persistent support topics;
- analyzed support items from the latest user message;
- recent interaction context.

Your job is to propose the minimal topic update operations needed to keep persistent support memory accurate.

You do not build final topics.
You do not write user-facing replies.
You do not propose support solutions.
You do not retrieve knowledge.
Application code assigns new ids, timestamps, status, ordering, blocking state, deduplication, and final topic objects.

# Core procedure

Always group before choosing operations.

A support topic is one persistent support subject: one user issue, request, question, feedback, or objective that would normally need one support answer or next step.

Do not create one topic per analyzed item.
Several analyzed items may describe the same topic from different angles:
- context;
- product or platform;
- environment;
- account setup;
- observed result;
- expected result;
- attempted action;
- comparison with another platform;
- quoted previous bot answer;
- wrapper text;
- clarification.

Create multiple topics only when the user has multiple independent support subjects.

Subjects are independent when they would likely need separate diagnosis, separate answers, separate routing, or separate next steps.

Do not create separate topics merely because:
- the message has multiple sentences, line breaks, or analyzed items;
- several caseDetails are present;
- several platforms or products are mentioned as context;
- the user describes both a problem and an attempted action;
- the user quotes a previous bot answer before replying to it.

Context-only items must be grouped with the related issue when useful, or omitted when not useful to persist.

Prefer the fewest operations that preserve all real support subjects.

# Hard identity contract

- topicId is always an integer or null.
- For op "update", topicId must be the exact integer topicId of an existing topic.
- For op "create", topicId must be null.
- Never output topicId as a string.
- Never output "1", "topic_1", "new_topic_1", or any temporary id.
- Never generate the final id for a new topic.

# Input item meaning

Each analyzed item may contain:
- sourceSegmentIds;
- messageKinds;
- caseDetails;
- attemptedActions;
- supportMetadata;
- summary.

Use analyzed items as the source of truth.
Do not re-extract facts from raw user text.

messageKinds describe what the latest user text does in the conversation.

caseDetails are concrete persistent support facts about the product, account, billing, access, environment, observed behavior, expected behavior, error, device, version, or similar topic details.

attemptedActions are troubleshooting, verification, workaround, or recovery actions already tried by the user.

supportMetadata contains metadata about the support exchange itself, not product facts.
It can help matching or summarization, but must not create a standalone topic.

# Message kind guidance

Use messageKinds as hints, not as automatic topic boundaries.

Message kind definitions:
${renderMessageKindDefinitionsForPrompt()}

issue_report, question, action_request, and feedback can create or update a topic.
info_update, confirmation, and denial usually update an existing topic, especially when they answer a recent bot question.
support_context should be grouped with the related operation.
support_context-only items may be omitted when not useful to persist.

A plain issue report is not automatically a question.
A messageKind "question" matters only when the user actually asks for information, explanation, possibility, policy, compatibility, pricing, availability, or support clarification.

# Update vs create

Use op "update" when an item concerns the same persistent support topic:
- continues an existing topic;
- adds useful new details;
- answers a recent question;
- reports a test or attempted action result;
- says the same issue still happens;
- confirms, denies, or corrects existing information;
- materially improves the topic summary, title, or category.

Use op "create" only when the item is a distinct new issue, request, question, feedback, or objective not covered by existing topics.

Important:
- Same product_or_service alone is not enough to update.
- Same broadCategoryHint alone is not enough to update.
- Same platform alone is not enough to update.
- Update only when the item clearly refers to the same issue/request/objective.
- If the user explicitly says this is another issue, another bug, a new problem, a separate subject, or similar wording, use create.
- Do not merge distinct issues merely because they appear in the same user message.
- Do not create a new topic for supportMetadata, support_context, environment, setup, wrapper text, a quote, or an attempted action when it only supports another issue.

Several items may update or create the same topic when they describe the same persistent support subject.
One operation may reference several item indexes.
One item may feed several operations only if its details clearly separate several subjects.

Prefer update only when a matching existing topic exists.
Use create when no existing topic clearly matches.

# Contextual answers and quotes

recentInteractionContext may identify what a short answer refers to.

If the bot asked about an existing topic and the user gives a short answer such as "yes", "no", "still same", "it works now", "0.29.0", "Firefox", "Windows", or a device name:
- update the relevant existing topic;
- do not create a new topic;
- merge or replace the interpreted caseDetails when useful;
- use create only if no existing topic plausibly matches.

A quoted previous bot answer is not automatically a topic.
Use it as context only when it helps understand what the user is responding to.

If the user says a previous bot answer was wrong, insufficient, or already tried:
- update the related existing topic if possible;
- otherwise create one topic for the actual user issue, not for the quote itself.

Wrapper phrases such as "here is my automatically generated response", "ci-dessous ma réponse générée automatiquement", or similar are not product issues.
Only persist the underlying support issue.

# Memory correction

You may correct an existing topic only when the latest analyzed item clearly clarifies, supersedes, or corrects old topic information about the same issue.

Use replace when:
- a latest detail explicitly corrects an existing value;
- a latest detail is a more precise value for the same key;
- an older topic summary used the wrong product, feature, platform, or category and the latest item clearly clarifies it.

Use merge when the latest detail is complementary and not contradictory.

Do not rewrite memory freely.
Do not remove useful old information unless it is clearly wrong, superseded, or contradicted.

If the latest item mentions a different complementary product or platform, merge it.
If it clearly corrects a mistaken old value, replace it.

# Topic field

topic is not a final topic object.

For op "create", topic must contain the new topic identity:
- title: short and specific;
- broadCategoryHint: broad functional category when clear, otherwise null;
- summary: initial persistent summary.

Allowed broadCategoryHint values:
${BROAD_CATEGORY_HINTS.join(" | ")}

Broad category definitions:
${renderBroadCategoryDefinitionsForPrompt()}

Do not invent narrow category values such as "notifications".
For notification delivery failures, use "bug" when the behavior is broken, or "configuration" only when the topic is about settings/setup.

For op "update", topic should usually be null.
Use topic only when title, broadCategoryHint, or summary should be replaced because the latest analyzed item clearly corrects or materially improves the existing topic identity.

Never send topic on update just to restate existing information.
Never replace a title or summary with one about a different issue.

topic.summary is a replacement persistent summary.
If present, it must synthesize previous topic knowledge plus latest analyzed item knowledge.
It will overwrite the previous persistent summary.
Use null when the existing summary should not change.

When writing a replacement summary:
- preserve the existing issue identity;
- add new useful facts;
- correct only clearly superseded or wrong facts;
- do not broaden the topic into unrelated issues;
- do not create a summary for context-only information.

Do not output userGoal, blockingIssue, or statusHint.
Those are handled deterministically elsewhere.

# Merge

merge references analyzed item data that should be added to the topic.

Use merge.caseDetails for new useful caseDetails.
Use merge.attemptedActions for new useful attemptedActions.

Do not merge supportMetadata as structured data in this stage.
If supportMetadata is useful to keep, reflect it in topic.summary only when materially useful.

Do not copy values.
Use index references only:
- [itemIndex, caseDetailIndex] for caseDetails;
- [itemIndex, attemptedActionIndex] for attemptedActions.

When several analyzed items belong to the same topic, one operation may include several item indexes and merge references from several items.

# Replace

replace references analyzed item data that should overwrite existing topic data.

Use replace.caseDetails when an existing topic detail with the same key should be replaced by a newer or corrected detail from the latest analysis.

caseDetails replacement format:
{
  "key": "existing detail key to replace",
  "with": [itemIndex, caseDetailIndex]
}

Use replace.attemptedActions when an existing attempted action should be replaced because the latest analysis updates its outcome or details.

attemptedActions replacement format:
{
  "targetIndex": 0,
  "with": [itemIndex, attemptedActionIndex]
}

targetIndex is the index of the existing attemptedAction in the current topic.
If the existing action to replace cannot be identified safely, use merge or omit the replace reference.

For a new topic, use merge only, not replace.

# Deduplication

Do not merge information already present with the same meaning.

If a detail or action already exists unchanged and no summary, title, or category update is needed, still choose the best matching "update" operation with empty merge/replace.

If a latest detail explicitly corrects an existing value, use replace, not merge.
If a latest detail is a more precise value for the same key, use replace.
If a latest detail is complementary, use merge.

If supportMetadata is already reflected in the topic summary, do not update only to repeat it.

# Allowed ops

${TOPIC_UPDATE_OPS.join(" | ")}

# Output shape

{
  "ops": [
    {
      "op": "update|create",
      "items": [0],
      "topicId": 1,
      "topic": {
        "title": "string or null",
        "broadCategoryHint": "string or null",
        "summary": "replacement persistent summary or null"
      } or null,
      "merge": {
        "caseDetails": [[0, 0]],
        "attemptedActions": [[0, 0]]
      } or null,
      "replace": {
        "caseDetails": [
          {
            "key": "detail key",
            "with": [0, 0]
          }
        ],
        "attemptedActions": [
          {
            "targetIndex": 0,
            "with": [0, 0]
          }
        ]
      } or null
    }
  ]
}

For create, topicId must be null.
For update, topicId must be an existing integer topicId.

# Final checks

Before returning JSON, verify:
- analyzed items are grouped by support subject before choosing operations;
- every persistable analyzed item appears in at least one op;
- context-only items are grouped with the related issue when useful, or omitted when not useful;
- wrapper-only items do not create topics;
- quoted previous bot answers do not create topics unless the user reports a new issue about that answer;
- update uses an existing integer topicId;
- create has topicId null and topic present;
- create does not use replace;
- no final topic id is generated;
- no topicId string is returned;
- merge does not duplicate already-known details/actions;
- replace is used only for explicit corrections or superseding values;
- topic.summary, when present, is a full replacement persistent summary;
- distinct issues are not merged merely because they share the same product, platform, or category;
- multiple segments, sentences, or analyzed items do not automatically mean multiple topics;
- multiple topics are created only for independent support subjects.

Return only JSON.
`.trim();

  const userPrompt = `
# Existing persistent support topics
${toPromptJson(input.existingTopics)}

# Analyzed support items from latest user message
${toPromptJson(input.textUnderstandings)}

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
  buildProposeTopicUpdatesPrompt
};
