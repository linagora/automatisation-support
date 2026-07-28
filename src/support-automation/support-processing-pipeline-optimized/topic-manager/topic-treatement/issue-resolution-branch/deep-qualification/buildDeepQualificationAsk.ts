import {
  getCaseDetailFieldRequestLabel,
  getDeepIssueQualificationGroupKey,
  getDeepIssueQualificationGroupLabel
} from "../qualificationRules.catalog";

import type {LiveMemoryTopicOptimized} from "../../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";
import type {DeepQualificationGroupKey} from "../qualificationRules.catalog";

type DeepQualification = LiveMemoryTopicOptimized["sourceTopicManager"]["deepQualification"];
type FieldToAsk = DeepQualification["caseDetailsToAskBecauseOfDeepQualification"][number] & {status: "asking"};

type BuildDeepQualificationAskInput = {
  deepQualification: DeepQualification;
  userFacingInformation: string | null;
  supportDomain: string | null;
};

type GroupedFieldsToAsk = {
  groupKey: DeepQualificationGroupKey | "other";
  groupLabel: string;
  fields: FieldToAsk[];
};

function buildDeepQualificationAsk(input: BuildDeepQualificationAskInput): string {
  const fieldsToAsk = selectFieldsToAsk(input.deepQualification);

  if (fieldsToAsk.length === 0) {
    return "Could you share any remaining detail that may help support investigate this issue?";
  }

  const bullets = groupFieldsToAsk({
    fieldsToAsk,
    supportDomain: input.supportDomain
  })
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

function selectFieldsToAsk(deepQualification: DeepQualification): FieldToAsk[] {
  return deepQualification.caseDetailsToAskBecauseOfDeepQualification.filter((field): field is FieldToAsk => {
    return field.status === "asking";
  });
}

function groupFieldsToAsk(input: {
  fieldsToAsk: FieldToAsk[];
  supportDomain: string | null;
}): GroupedFieldsToAsk[] {
  const groups = new Map<string, GroupedFieldsToAsk>();

  for (const field of input.fieldsToAsk) {
    const groupKey = getDeepIssueQualificationGroupKey(input.supportDomain, field.key) ?? "other";

    const groupLabel = groupKey === "other"
      ? "Other details"
      : getDeepIssueQualificationGroupLabel(groupKey);

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
    .map((field) => getCaseDetailFieldRequestLabel(field.key))
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

export {buildDeepQualificationAsk};