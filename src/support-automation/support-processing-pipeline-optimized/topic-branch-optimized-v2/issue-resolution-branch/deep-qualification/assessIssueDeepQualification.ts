import {getDeepIssueFieldSpecs} from "./issueDeepQualification.catalog";

import type {AnalyzeSupportTextUnderstanding} from "../../runTopicBranch";
import type {IssueFieldSpec, IssueProgressState, IssueQualificationField} from "../issueResolutionTypes";

function assessIssueDeepQualification(input: {
  issueProgressState: IssueProgressState;
  sourceUnderstandings: AnalyzeSupportTextUnderstanding[];
  supportDomain?: string | null;
}): IssueProgressState {
  const fields = buildFields({
    specs: getDeepIssueFieldSpecs({
      selectedTopic: input.issueProgressState.similarTopic.selectedTopic,
      supportDomain: input.supportDomain
    }),
    existingFields: input.issueProgressState.deepQualification.fields,
    sourceUnderstandings: input.sourceUnderstandings
  });

  const missingFields = fields.filter((field) => field.requirement === "required" && !isResolved(field)).map((field) => field.key);

  return {
    ...input.issueProgressState,
    deepQualification: {
      complete: missingFields.length === 0,
      mode: input.issueProgressState.similarTopic.status === "identified" ? "similar_topic_guided" : "domain_generic",
      fields,
      missingFields,
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
    .sort((left, right) => left.askedCount - right.askedCount)
    .slice(0, limit)
    .map((field) => field.key);
}

function isResolved(field: IssueQualificationField): boolean {
  return field.status === "obtained" || field.status === "user_declared_unavailable";
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export {assessIssueDeepQualification};
