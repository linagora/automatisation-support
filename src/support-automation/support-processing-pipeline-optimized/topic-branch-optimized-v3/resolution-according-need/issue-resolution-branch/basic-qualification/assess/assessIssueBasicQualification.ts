import {getBasicIssueFieldSpecs} from "../issueBasicQualification.catalog";

import type {LiveMemoryTopicOptimized, Primitive, SupportUnderstanding} from "../../../../runTopicBranch";
import type {
  IssueAttemptedActionSignal,
  IssueFieldSpec,
  IssueProgressState,
  IssueQualificationField
} from "../../runIssueResolutionBranch";

type IssueBasicQualificationAssessOutput = {
  issueProgressState: IssueProgressState;
  missingRequiredFields: string[];
  missingRecommendedFields: string[];
  nextAskFields: string[];
  attemptedActionSignal: IssueAttemptedActionSignal;
};

function assessIssueBasicQualification(input: {
  supportDomain: string;
  issueProgressState: IssueProgressState;
  currentTopic: LiveMemoryTopicOptimized | null;
  sourceUnderstandings: SupportUnderstanding[];
}): IssueBasicQualificationAssessOutput {
  const fields = buildFields({
    specs: getBasicIssueFieldSpecs(input.supportDomain),
    existingFields: input.issueProgressState.basicQualification.fields,
    currentTopic: input.currentTopic,
    sourceUnderstandings: input.sourceUnderstandings
  });

  const attemptedActionSignal = buildAttemptedActionSignal({
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
    basicQualification: {
      fields,
      missingRequiredFields,
      missingRecommendedFields,
      nextAskFields,
      attemptedActionSignal
    }
  };

  return {
    issueProgressState,
    missingRequiredFields,
    missingRecommendedFields,
    nextAskFields,
    attemptedActionSignal
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

function buildAttemptedActionSignal(input: {
  currentTopic: LiveMemoryTopicOptimized | null;
  sourceUnderstandings: SupportUnderstanding[];
}): IssueAttemptedActionSignal {
  const attemptedActions = [
    ...(input.currentTopic?.attemptedActions ?? []).map((action) => ({
      action: action.action,
      outcome: action.outcome ?? null,
      evidence: action.evidence ?? null
    })),
    ...input.sourceUnderstandings.flatMap((understanding) => understanding.attemptedActions.map((action) => ({
      action: action.action,
      outcome: action.outcome,
      evidence: action.evidence
    })))
  ];

  return {
    status: attemptedActions.length > 0 ? "present" : "missing",
    attemptedActions,
    shouldAskForAttemptedActions: attemptedActions.length === 0
  };
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

export {assessIssueBasicQualification};
export type {IssueBasicQualificationAssessOutput};
