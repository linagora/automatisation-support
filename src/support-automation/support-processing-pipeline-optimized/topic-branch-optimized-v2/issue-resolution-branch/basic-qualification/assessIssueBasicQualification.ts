import {getBasicIssueFieldSpecs} from "./issueBasicQualification.catalog";

import type {AnalyzeSupportTextUnderstanding} from "../../runTopicBranch";
import type {IssueProgressState, IssueQualificationField, IssueFieldSpec} from "../issueResolutionTypes";

function assessIssueBasicQualification(input: {
  supportDomain: string;
  issueProgressState: IssueProgressState;
  sourceUnderstandings: AnalyzeSupportTextUnderstanding[];
}): IssueProgressState {
  const fields = buildFields({
    specs: getBasicIssueFieldSpecs(input.supportDomain),
    existingFields: input.issueProgressState.basicQualification.fields,
    sourceUnderstandings: input.sourceUnderstandings
  });

  const missingRequiredFields = fields.filter((field) => field.requirement === "required" && !isResolved(field)).map((field) => field.key);
  const missingRecommendedFields = fields.filter((field) => field.requirement === "recommended" && !isResolved(field)).map((field) => field.key);

  return {
    ...input.issueProgressState,
    basicQualification: {
      complete: missingRequiredFields.length === 0,
      fields,
      missingRequiredFields,
      missingRecommendedFields,
      nextAskFields: selectNextAskFieldKeys(fields)
    }
  };
}

function buildFields(input: {
  specs: IssueFieldSpec[];
  existingFields: IssueQualificationField[];
  sourceUnderstandings: AnalyzeSupportTextUnderstanding[];
}): IssueQualificationField[] {
  const existingByKey = new Map(input.existingFields.map((field) => [field.key, field]));
  const extractedByKey = collectExtractedFields(input.sourceUnderstandings);

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
        status: "obtained",
        askedCount: existing?.askedCount ?? 0
      };
    }

    return existing
      ? {...existing, label: spec.label, requirement: spec.requirement}
      : {key: spec.key, label: spec.label, requirement: spec.requirement, value: null, evidence: null, status: "missing_not_asked", askedCount: 0};
  });
}

function collectExtractedFields(sourceUnderstandings: AnalyzeSupportTextUnderstanding[]): Map<string, {value: string | number | boolean | null; evidence: string}> {
  const fields = new Map<string, {value: string | number | boolean | null; evidence: string}>();

  for (const understanding of sourceUnderstandings) {
    for (const field of understanding.extractedFields) {
      fields.set(field.key, {value: field.value, evidence: field.evidence});
      fields.set(normalizeKey(field.key), {value: field.value, evidence: field.evidence});
    }
  }

  return fields;
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
