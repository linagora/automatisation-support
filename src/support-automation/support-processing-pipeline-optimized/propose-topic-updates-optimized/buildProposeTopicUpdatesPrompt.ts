import {
  outputJsonShapeForPrompt,
  responseFormat
} from "./responseFormat";
import {promptCatalogSelection} from "./catalogSelection";

import type {LLMMessage} from "../../../infrastructure/llm/llm-client";
import type {AnalyzeSupportTextUnderstanding} from "../../support-processing-pipeline-optimized/analyze-support-text-optimized/runAnalyzeSupportText";
import type {LiveMemoryTopicOptimized} from "../../../infrastructure/live-memory/liveMemoryContextOptimized.template";
import type {RecentInteractionContext} from "../../support-processing-pipeline-v2/typesSupportProcessingPipelineV2.types";

type BuildProposeTopicUpdatesPromptInput = {
  existingTopics: LiveMemoryTopicOptimized[];
  understandings: AnalyzeSupportTextUnderstanding[];
  recentInteractionContext: RecentInteractionContext;
};

type ProposeTopicUpdatesLlmRequest = {
  messages: LLMMessage[];
  responseFormat: typeof responseFormat;
};

function buildProposeTopicUpdatesPrompt(input: BuildProposeTopicUpdatesPromptInput): ProposeTopicUpdatesLlmRequest {
  const existingTopicsForPrompt = input.existingTopics.map((topic) => {
    return {
      topicId: topic.sourceProposeTopicUpdates.topicId,
      title: topic.sourceProposeTopicUpdates.title,
      summaryTopic: topic.sourceProposeTopicUpdates.summaryTopic,
      supportNeed: topic.sourceTopicManager.supportNeedResolution.supportNeed,
      supportDomain: topic.sourceProposeTopicUpdates.supportDomain,
      caseDetailsExtracted: topic.sourceAnalyzeSupportText.caseDetailsExtracted,
      attemptedActionsExtracted: topic.sourceAnalyzeSupportText.attemptedActionsExtracted
    };
  });

  const systemPrompt = `
You are the optimized topic linker and topic identity updater of a customer support pipeline.

Propose topic update plans only.
Do not build patches, snapshots, response plans, diagnostics, retrieval requests, or final persistence.
Return only JSON matching the requested schema.
`.trim();

  const userPrompt = `
# Input

<existing_topics>
${JSON.stringify(existingTopicsForPrompt)}
</existing_topics>

<understandings>
${JSON.stringify(input.understandings)}
</understandings>

<recent_interaction_context>
${JSON.stringify(input.recentInteractionContext)}
</recent_interaction_context>

# Catalog

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

# Topic id

Do not output a separate create/update field. Use topicId instead:
- topicId number means updating an existing topic.
- topicId null means creating a new topic.

Use an existing topicId when the understanding continues, clarifies, corrects, confirms, denies, answers, or adds detail to an existing topic.
Use null only when it is a distinct new issue, request, question, feature request, or objective not covered by existing topics.

Infer update or create from the understanding summaryMessage, caseDetailsExtracted, attemptedActionsExtracted, other notes, the existing topics, and the latest user message context. The deep support contract has no intent-act field.

# sourceUnderstandingIds

sourceUnderstandingIds are the only link between the plan and support understandings.
Every persistable understanding should appear in exactly one topicUpdatePlan.

# Topic fields

Always output title, summaryTopic and supportDomain for every plan.
For existing topics, reuse the previous title/supportDomain unless the new message clearly improves or corrects them.
Do not set title/supportDomain to null just because the topic already exists.

# title

For an existing topic, reuse the previous title and correct it only if the new message provides a better formulation.
For a new topic, create a short stable topic title.
title must be null only when the subject is truly impossible to name.

# supportDomain

supportDomain = the support domain/topic area, not the support need.
For an existing topic, reuse the previous supportDomain.value unless the new message clearly justifies a correction.
For a new topic, choose the best possible domain from the catalog.
supportDomain.value must be one of the available support domains or null when the domain is uncertain.
supportDomain.reason must briefly justify the selected support domain using the current understanding and, when updating an existing topic, the previous topic context.
If supportDomain.value is null, supportDomain.reason must explain why the domain is uncertain.

# summaryTopic

summaryTopic is the persistent topic summary.
For a new topic, it is the initial persistent summary.
For an existing topic, it should combine the previous topic understanding and the new understanding.
It is not the same thing as the latest understanding summaryMessage.

# Memory updates

Do not choose extracted fields.
Do not choose attempted actions.
Do not choose other notes.
Do not output memory updates.
Do not output patches.
A later deterministic memory step will add or concatenate caseDetailsExtracted, attemptedActionsExtracted, other, values, and evidences from the selected sourceUnderstandingIds.

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
