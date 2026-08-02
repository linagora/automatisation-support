import {
  outputJsonShapeForPrompt,
  responseFormat
} from "./responseFormat";
import {promptCatalogSelection} from "./catalogSelection";

import type {LLMMessage} from "../../../infrastructure/llm/llm-client";
import type {
  AnalyzeSupportTextAttemptedAction,
  AnalyzeSupportTextCaseDetail,
  AnalyzeSupportTextOther
} from "../analyze-support-text-optimized/runAnalyzeSupportText";
import type {
  LiveMemoryIssueIdle,
  LiveMemoryTopicOptimized
} from "../../../infrastructure/live-memory/liveMemoryContextOptimized.template";
import type {RecentInteractionContext} from "../typesPipelineContext";

type CurrentUserMessage = {
  content: string;
  channel?: string;
};

type BuildProposeTopicUpdatesPromptInput = {
  existingTopics: LiveMemoryTopicOptimized[];
  currentUserMessage: CurrentUserMessage;
  summaryMessage: string | null;
  caseDetailsExtracted: AnalyzeSupportTextCaseDetail[];
  attemptedActionsExtracted: AnalyzeSupportTextAttemptedAction[];
  otherExtracted: AnalyzeSupportTextOther[];
  recentInteractionContext: RecentInteractionContext;
};

type ProposeTopicUpdatesLlmRequest = {
  messages: LLMMessage[];
  responseFormat: typeof responseFormat;
};

type DerivedTopicCurrentStep =
  | "support_need_resolution"
  | "basic_qualification"
  | "retrieve_knowledge"
  | "deep_qualification"
  | "solution"
  | "idle"
  | null;

function buildProposeTopicUpdatesPrompt(input: BuildProposeTopicUpdatesPromptInput): ProposeTopicUpdatesLlmRequest {
  const existingTopicsForPrompt = input.existingTopics.map((topic) => {
    const pendingBasicFieldKeys = getPendingBasicFieldKeys(topic);
    const pendingDeepFieldKeys = getPendingDeepFieldKeys(topic);
    const pendingSolutionFieldKeys = getPendingSolutionFieldKeys(topic);

    return {
      topicId: topic.sourceProposeTopicUpdates.topicId,
      status: topic.status,
      currentStep: deriveTopicCurrentStep(topic.sourceTopicManager),
      title: topic.sourceProposeTopicUpdates.title,
      summaryTopic: topic.sourceProposeTopicUpdates.summaryTopic,
      idleMode: getActiveWorkflowIdle(topic.sourceTopicManager),
      supportNeed: topic.sourceTopicManager.supportNeedResolution.supportNeed,
      supportDomain: topic.sourceProposeTopicUpdates.supportDomain,
      pendingBasicFieldKeys,
      pendingDeepFieldKeys,
      pendingSolutionFieldKeys,
      pendingFieldKeys: [...new Set([...pendingBasicFieldKeys, ...pendingDeepFieldKeys, ...pendingSolutionFieldKeys])],
      pendingSolutionActions: getPendingSolutionActions(topic),
      knownCaseDetails: topic.sourceAnalyzeSupportText.caseDetailsExtracted,
      knownAttemptedActions: topic.sourceAnalyzeSupportText.attemptedActionsExtracted
    };
  });

  const systemPrompt = `
You route extracted support facts to persistent support topics.

Return topic update plans only.
Do not answer the user.
Do not build memory patches.
Do not diagnose.
Do not propose solutions.
Return only JSON matching the requested schema.
`.trim();

  const userPrompt = `
# Input

<current_user_message>
${JSON.stringify(input.currentUserMessage)}
</current_user_message>

<message_summary>
${JSON.stringify(input.summaryMessage)}
</message_summary>

<case_details_extracted>
${JSON.stringify(input.caseDetailsExtracted)}
</case_details_extracted>

<attempted_actions_extracted>
${JSON.stringify(input.attemptedActionsExtracted)}
</attempted_actions_extracted>

<other_extracted>
${JSON.stringify(input.otherExtracted)}
</other_extracted>

<existing_topics>
${JSON.stringify(existingTopicsForPrompt)}
</existing_topics>

<recent_interaction_context>
${JSON.stringify(input.recentInteractionContext)}
</recent_interaction_context>

# Catalog

Support domains:
${renderPromptItems(promptCatalogSelection.supportDomains)}

# Task

Decide which extracted facts belong to which persistent support topic.

A plan with topicId number updates an existing topic.
A plan with topicId null creates a new topic.

Route facts by their ids:
- sourceCaseDetailIds
- sourceAttemptedActionIds
- sourceOtherIds

Do not output fact values inside the plan.
Do not invent fact ids.
Do not output memory patches.

# Routing rules

Prefer updating an existing topic when the fact clearly:
- answers one of that topic's pendingFieldKeys;
- answers one of that topic's pendingSolutionFieldKeys;
- reports the result of one of that topic's pendingSolutionActions;
- clarifies, confirms, denies, or corrects the same product, feature, symptom, or issue;
- explicitly refers to that topic.

Create a new topic when the facts describe a different product, feature, symptom, request, objective, or issue.

Strong new-topic signals:
- "another problem";
- "another issue";
- "also";
- "by the way";
- "second issue";
- "I also have";
- equivalent wording in the user's language.

Do not attach a new issue to the latest topic only because the latest topic is active.

# Shared facts

The same fact id may appear in several plans when the current user message clearly says the fact applies to several topics.

Examples:
- "for both issues";
- "for the two subjects";
- "same browser";
- "same environment";
- "same account";
- "same workspace";
- "in both cases".

Only duplicate a fact when the whole fact applies to every selected topic.

# Sticky state guard

A topic that is idle, completed, or escalated must not capture a new subject automatically.

Route to such a topic only when the message explicitly refers to that same topic.

# Topic fields

Always output title, summaryTopic, and supportDomain.

For an existing topic:
- reuse the previous title unless the new facts clearly improve it;
- reuse the previous supportDomain unless the new facts clearly correct it;
- update summaryTopic by combining the previous summary with the routed facts.

For a new topic:
- create a short stable title;
- create an initial summaryTopic;
- choose the best supportDomain from the catalog;
- use supportDomain.value null only if the domain is genuinely unclear.

# Empty routing

If a fact is not useful or cannot be routed safely, omit it from all plans.
Do not create an empty plan.

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

function getPendingBasicFieldKeys(topic: LiveMemoryTopicOptimized): string[] {
  return topic.sourceTopicManager.workflows.issueResolution.basicQualification.caseDetailsToAskBecauseOfBasicQualification
    .filter((field) => field.status === "asking")
    .map((field) => field.key)
    .filter((key): key is string => typeof key === "string" && key.trim() !== "");
}

function getPendingDeepFieldKeys(topic: LiveMemoryTopicOptimized): string[] {
  return topic.sourceTopicManager.workflows.issueResolution.deepQualification.caseDetailsToAskBecauseOfDeepQualification
    .filter((field) => field.status === "asking")
    .map((field) => field.key)
    .filter((key): key is string => typeof key === "string" && key.trim() !== "");
}

function getPendingSolutionFieldKeys(topic: LiveMemoryTopicOptimized): string[] {
  return topic.sourceTopicManager.workflows.issueResolution.solution.caseDetailsToAskBecauseOfSolutionFound
    .filter((field) => field.status === "asking")
    .map((field) => field.key)
    .filter((key): key is string => typeof key === "string" && key.trim() !== "");
}

function getPendingSolutionActions(topic: LiveMemoryTopicOptimized): Array<{
  action: string;
  reason: string | null;
}> {
  return topic.sourceTopicManager.workflows.issueResolution.solution.attemptedActionsToAskBecauseOfSolutionFound
    .filter((action) => action.status === "asking")
    .map((action) => ({
      action: action.action,
      reason: action.reason
    }))
    .filter((action): action is {action: string; reason: string | null} => {
      return typeof action.action === "string" && action.action.trim() !== "";
    });
}

function getActiveWorkflowIdle(
  sourceTopicManager: LiveMemoryTopicOptimized["sourceTopicManager"]
): LiveMemoryIssueIdle {
  const supportNeed = sourceTopicManager.supportNeedResolution.supportNeed.value;

  if (supportNeed === "issue_resolution") {
    return sourceTopicManager.workflows.issueResolution.idle;
  }

  if (supportNeed === "knowledge_answer") {
    return sourceTopicManager.workflows.knowledgeAnswer.idle;
  }

  if (supportNeed === "support_action") {
    return sourceTopicManager.workflows.supportAction.idle;
  }

  if (supportNeed === "feature_request") {
    return sourceTopicManager.workflows.featureRequest.idle;
  }

  return {isActivated: false};
}

function deriveTopicCurrentStep(
  sourceTopicManager: LiveMemoryTopicOptimized["sourceTopicManager"]
): DerivedTopicCurrentStep {
  const supportNeed = sourceTopicManager.supportNeedResolution.supportNeed.value;

  if (supportNeed === "issue_resolution") {
    return deriveIssueResolutionCurrentStep(sourceTopicManager.workflows.issueResolution);
  }

  if (supportNeed === "knowledge_answer") {
    return sourceTopicManager.workflows.knowledgeAnswer.idle.isActivated ? "idle" : null;
  }

  if (supportNeed === "support_action") {
    return sourceTopicManager.workflows.supportAction.idle.isActivated ? "idle" : null;
  }

  if (supportNeed === "feature_request") {
    return sourceTopicManager.workflows.featureRequest.idle.isActivated ? "idle" : null;
  }

  return "support_need_resolution";
}

function deriveIssueResolutionCurrentStep(
  workflow: LiveMemoryTopicOptimized["sourceTopicManager"]["workflows"]["issueResolution"]
): DerivedTopicCurrentStep {
  if (workflow.idle.isActivated === true) {
    return "idle";
  }

  if (workflow.basicQualification.isCompleted !== true) {
    return "basic_qualification";
  }

  if (workflow.retrieveKnowledge.isCompleted === false) {
    return "retrieve_knowledge";
  }

  if (workflow.solution.isCompleted !== true) {
    return "solution";
  }

  if (workflow.deepQualification.isCompleted !== true) {
    return "deep_qualification";
  }

  return "idle";
}

function renderPromptItems(entries: Array<{key: string; extractionGuidance?: string}>): string {
  return entries.map((entry) => buildPromptLine(entry)).join("\n");
}

function buildPromptLine(entry: {key: string; extractionGuidance?: string}): string {
  return entry.extractionGuidance
    ? `* "${entry.key}": ${entry.extractionGuidance}`
    : `* "${entry.key}"`;
}

export {
  buildProposeTopicUpdatesPrompt,
  deriveIssueResolutionCurrentStep,
  deriveTopicCurrentStep
};

export type {
  BuildProposeTopicUpdatesPromptInput,
  CurrentUserMessage,
  DerivedTopicCurrentStep,
  ProposeTopicUpdatesLlmRequest
};
