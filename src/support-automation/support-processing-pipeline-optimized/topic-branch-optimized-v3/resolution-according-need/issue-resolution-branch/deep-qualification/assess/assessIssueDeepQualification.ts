import {getDeepIssueFieldSpecs} from "../issueDeepQualification.catalog";

import type {LiveMemoryTopicOptimized, Primitive, SupportUnderstanding} from "../../../../runTopicBranch";
import type {IssueFieldSpec, IssueProgressState, IssueQualificationField} from "../../runIssueResolutionBranch";

type IssueDeepQualificationAssessOutput = {
  issueProgressState: IssueProgressState;
  mode: IssueProgressState["deepQualification"]["mode"];
  missingRequiredFields: string[];
  missingRecommendedFields: string[];
  nextAskFields: string[];
};

function assessIssueDeepQualification(input: {
  issueProgressState: IssueProgressState;
  currentTopic: LiveMemoryTopicOptimized | null;
  sourceUnderstandings: SupportUnderstanding[];
  supportDomain?: string | null;
}): IssueDeepQualificationAssessOutput {
  const mode = input.issueProgressState.similarTopic.analysis.status === "identified"
    ? "similar_topic_guided" as const
    : "domain_generic" as const;

  const fields = buildFields({
    specs: getDeepIssueFieldSpecs({
      selectedTopic: input.issueProgressState.similarTopic.analysis.selectedTopic,
      supportDomain: input.supportDomain
    }),
    existingFields: input.issueProgressState.deepQualification.fields,
    currentTopic: input.currentTopic,
    sourceUnderstandings: input.sourceUnderstandings
  });

  const missingRequiredFields = fields
    .filter((field) => field.requirement === "required" && !isResolved(field))
    .map((field) => field.key);

  const missingRecommendedFields = fields
    .filter((field) => field.requirement === "recommended" && !isResolved(field))
    .map((field) => field.key);

  const nextAskFields = selectNextAskFieldKeys(fields);

  const issueProgressState = {
    ...input.issueProgressState,
    deepQualification: {
      mode,
      fields,
      missingRequiredFields,
      missingRecommendedFields,
      nextAskFields
    }
  };

  return {
    issueProgressState,
    mode,
    missingRequiredFields,
    missingRecommendedFields,
    nextAskFields
  };
}

function buildFields(input: {
  specs: IssueFieldSpec[];
  existingFields: IssueQualificationField[];
  currentTopic: LiveMemoryTopicOptimized | null;
  sourceUnderstandings: SupportUnderstanding[];
}): IssueQualificationField[] {
  const existingByKey = new Map(input.existingFields.map((field) => [field.key, field]));
  const extractedByKey = collectAvailableCaseDetails(input.currentTopic, input.sourceUnderstandings);

  return input.specs.map((spec) => {
    const existing = existingByKey.get(spec.key);
    const extracted = extractedByKey.get(spec.key) ?? extractedByKey.get(normalizeKey(spec.key));

    if (extracted) {
      return {
        key: spec.key,
        label: spec.label,
        requirement: spec.requirement,
        value: extracted.value,
        evidence: extracted.evidence,
        status: extracted.status,
        askPrompt: spec.askPrompt,
        askedCount: existing?.askedCount ?? 0
      };
    }

    return existing
      ? {...existing, label: spec.label, requirement: spec.requirement, askPrompt: spec.askPrompt}
      : {key: spec.key, label: spec.label, requirement: spec.requirement, value: null, evidence: null, status: "missing_not_asked", askPrompt: spec.askPrompt, askedCount: 0};
  });
}

function collectAvailableCaseDetails(
  currentTopic: LiveMemoryTopicOptimized | null,
  sourceUnderstandings: SupportUnderstanding[]
): Map<string, {value: Primitive; evidence: string | null; status: IssueQualificationField["status"]}> {
  const fields = new Map<string, {value: Primitive; evidence: string | null; status: IssueQualificationField["status"]}>();

  for (const detail of currentTopic?.caseDetails ?? []) {
    const status = detail.status === "user_declared_unavailable" ? "user_declared_unavailable" : "obtained";
    setField(fields, detail.key, detail.value, detail.evidence ?? null, status);
  }

  for (const understanding of sourceUnderstandings) {
    for (const field of understanding.extractedFields) {
      setField(fields, field.key, field.value, field.evidence, "obtained");
    }
  }

  return fields;
}

function setField(
  fields: Map<string, {value: Primitive; evidence: string | null; status: IssueQualificationField["status"]}>,
  key: string,
  value: Primitive,
  evidence: string | null,
  status: IssueQualificationField["status"]
): void {
  fields.set(key, {value, evidence, status});
  fields.set(normalizeKey(key), {value, evidence, status});
}

function selectNextAskFieldKeys(fields: IssueQualificationField[], limit = 3): string[] {
  return fields
    .filter((field) => !isResolved(field))
    .sort((left, right) => scoreField(left) - scoreField(right))
    .slice(0, limit)
    .map((field) => field.key);
}

function scoreField(field: IssueQualificationField): number {
  return (field.requirement === "required" ? 0 : 100) + field.askedCount;
}

function isResolved(field: IssueQualificationField): boolean {
  return field.status === "obtained" || field.status === "user_declared_unavailable";
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export {assessIssueDeepQualification};
export type {IssueDeepQualificationAssessOutput};
