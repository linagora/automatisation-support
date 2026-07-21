import {
  outputJsonShapeForPrompt,
  responseFormat
} from "./responseFormat";
import {promptCatalogSelection} from "./catalogSelection";

import type {LLMMessage} from "../../../infrastructure/llm/llm-client";
import type {AnalyzeSupportTextUnderstanding} from "../../support-processing-pipeline-optimized/analyze-support-text-optimized/runAnalyzeSupportText";
import type {ExistingSupportTopic} from "./validateProposeTopicUpdatesOutput";
import type {RecentInteractionContext} from "../../support-processing-pipeline-v2/typesSupportProcessingPipelineV2.types";

type BuildProposeTopicUpdatesPromptInput = {
  existingTopics: ExistingSupportTopic[];
  understandings: AnalyzeSupportTextUnderstanding[];
  recentInteractionContext: RecentInteractionContext;
};

type ProposeTopicUpdatesLlmRequest = {
  messages: LLMMessage[];
  responseFormat: typeof responseFormat;
};

function buildProposeTopicUpdatesPrompt(input: BuildProposeTopicUpdatesPromptInput): ProposeTopicUpdatesLlmRequest {
  const systemPrompt = `
You are the optimized topic linker and topic identity updater of a customer support pipeline.

Propose topic update plans only.
Do not build patches, snapshots, response plans, diagnostics, retrieval requests, or final persistence.
Return only JSON matching the requested schema.
`.trim();

  const userPrompt = `
# Input

<existing_topics>
${JSON.stringify(input.existingTopics)}
</existing_topics>

<understandings>
${JSON.stringify(input.understandings)}
</understandings>

<recent_interaction_context>
${JSON.stringify(input.recentInteractionContext)}
</recent_interaction_context>

# Catalog

Topic operations:
${renderPromptItems(promptCatalogSelection.topicOperations)}

Support domains:
${renderPromptItems(promptCatalogSelection.supportDomains)}

# Role

Propose topic update plans only.

# Main decision

For each support understanding, decide whether it belongs to an existing topic or starts a new topic.

# Grouping

Group understandings by persistent support subject before creating plans.
Do not create one plan per understanding if several understandings belong to the same topic.
Create multiple plans only for independent support subjects.

# Update vs create

Use "update" when the understanding continues, clarifies, corrects, confirms, denies, answers, or adds detail to an existing topic.
Use "create" only when it is a distinct new issue, request, question, feature request, or objective not covered by existing topics.

Infer update or create from the understanding summary, extractedFields, attemptedActions, other, supportDomain, the existing topics, and the latest user message context. The deep support contract has no intent-act field.

# sourceUnderstandingIds

sourceUnderstandingIds are the only link between the plan and support understandings.
Every persistable understanding should appear in exactly one topicUpdatePlan.

# targetTopicId

For update, targetTopicId must be the existing topic id.
For create, targetTopicId must be null.

# topicIdentity

topicIdentity is always an object containing title, supportDomain, and summary.
For create, all three fields must be non-null.
For update, each field may be null to keep the existing identity, or a value when the new understanding improves that part of the identity.
Do not change title, supportDomain, or summary unless the new understanding makes the topic identity clearer or more accurate.

# topicIdentity.title

For create, write a short stable topic title.
For update, return null unless a better title is now justified.

# topicIdentity.supportDomain

supportDomain = the support domain/topic area, not the support need.
Use only one of the available support domains.
For update, return null unless the previous support domain should be improved.

# topicIdentity.summary

summary is the persistent topic summary.
For create, it is the initial persistent summary.
For update, it should combine the previous topic understanding and the new understanding.
It is not the same thing as the latest understanding summary.

# Memory updates

Do not choose extracted fields.
Do not choose attempted actions.
Do not choose other notes.
Do not output memory updates.
Do not output patches.
A later deterministic memory step will add or concatenate extractedFields, attemptedActions, other, values, and evidences from the selected sourceUnderstandingIds.

# Context

Use recent_interaction_context only to interpret short contextual answers.
Do not use it as source data or evidence.

# Non-goals

No patches in LLM output.
No snapshots.
No topic update proposal objects.
No response planning.
No diagnosis.
No retrieval.
No final persistence.

# Output JSON shape

${outputJsonShapeForPrompt}

Return only JSON.
`.trim();

  return {
    messages: [
      {role: "system", content: systemPrompt},
      {role: "user", content: userPrompt}
    ],
    responseFormat
  };
}

function renderPromptItems(entries: Array<{key: string; extractionGuidance?: string}>): string {
  return entries.map((entry) => buildPromptLine(entry)).join("\n");
}

function buildPromptLine(entry: {key: string; extractionGuidance?: string}): string {
  return entry.extractionGuidance
    ? `* "${entry.key}": ${entry.extractionGuidance}`
    : `* "${entry.key}"`;
}

export {buildProposeTopicUpdatesPrompt};

export type {
  BuildProposeTopicUpdatesPromptInput,
  ProposeTopicUpdatesLlmRequest
};
