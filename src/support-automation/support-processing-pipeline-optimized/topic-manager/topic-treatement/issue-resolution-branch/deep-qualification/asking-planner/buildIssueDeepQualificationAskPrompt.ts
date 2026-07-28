import {
  getDeepIssueFieldGroupKey,
  getDeepIssueFieldGroupLabel,
  getDeepIssueFieldRequestLabel
} from "../qualificationRules.catalog";

import type {LLMMessage} from "../../../../../../../infrastructure/llm/llm-client";
import type {LiveMemoryTopicOptimized} from "../../../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";
import type {DeepQualificationGroupKey} from "../qualificationRules.catalog";

type DeepQualification = LiveMemoryTopicOptimized["sourceTopicManager"]["deepQualification"];
type FieldToAsk = DeepQualification["caseDetailsToAskBecauseOfDeepQualification"][number] & {status: "asking"};

export type IssueDeepQualificationAskPromptInput = {
  currentUserMessage: {content: string; channel?: string};
  previousConversationTurn: {
    previousUserMessage: string | null;
    previousBotMessage: string | null;
  };
  fieldsToAsk: FieldToAsk[];
  userFacingInformation: string | null;
  supportDomain: string | null;
};

function buildIssueDeepQualificationAskPrompt(_input: IssueDeepQualificationAskPromptInput): {messages: LLMMessage[]} {
  return {
    messages: [
      {
        role: "system",
        content: "Deep qualification is currently deterministic. Do not call the LLM for this step."
      }
    ]
  };
}

function buildDeterministicDeepQualificationAsk(input: {
  fieldsToAsk: FieldToAsk[];
  userFacingInformation: string | null;
  supportDomain: string | null;
}): string {
  const groupedFields = groupFieldsToAsk({
    fieldsToAsk: input.fieldsToAsk,
    supportDomain: input.supportDomain
  });

  const bullets = groupedFields
    .map((group) => buildGroupBullet(group))
    .filter((value) => value.trim() !== "")
    .slice(0, 4);

  if (bullets.length === 0) {
    return "Could you share any remaining detail that may help support investigate this issue?";
  }

  const intro = input.userFacingInformation
    ? "To help the support team check the most relevant cause, please provide these details if available:"
    : "To help the support team investigate, please provide these details if available:";

  return `${intro}\n${bullets.join("\n")}\n\nIf you do not know or cannot provide one of these details, just say so.`;
}

type GroupedFieldsToAsk = {
  groupKey: DeepQualificationGroupKey | "other";
  groupLabel: string;
  fields: FieldToAsk[];
};

function groupFieldsToAsk(input: {
  fieldsToAsk: FieldToAsk[];
  supportDomain: string | null;
}): GroupedFieldsToAsk[] {
  const groups = new Map<string, GroupedFieldsToAsk>();

  for (const field of input.fieldsToAsk) {
    const groupKey = getDeepIssueFieldGroupKey(input.supportDomain, field.key) ?? "other";
    const groupLabel = groupKey === "other"
      ? "Other details"
      : getDeepIssueFieldGroupLabel(groupKey);

    const existingGroup = groups.get(groupKey);
    if (existingGroup) {
      existingGroup.fields.push(field);
      continue;
    }

    groups.set(groupKey, {
      groupKey,
      groupLabel,
      fields: [field]
    });
  }

  return [...groups.values()];
}

function buildGroupBullet(group: GroupedFieldsToAsk): string {
  const labels = group.fields
    .map((field) => getDeepIssueFieldRequestLabel(field.key))
    .filter((value) => value.trim() !== "");

  const uniqueLabels = [...new Set(labels)];
  if (uniqueLabels.length === 0) return "";

  return `- ${group.groupLabel}: ${joinWithAnd(uniqueLabels)}.`;
}

function joinWithAnd(values: readonly string[]): string {
  if (values.length === 0) return "";
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;

  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

export {
  buildDeterministicDeepQualificationAsk,
  buildIssueDeepQualificationAskPrompt
};