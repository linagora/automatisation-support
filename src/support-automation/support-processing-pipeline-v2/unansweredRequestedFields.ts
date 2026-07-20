import type {
  MergedTopicSnapshot,
  ResponsePlanV2
} from "./typesSupportProcessingPipelineV2.types";
import type {
  SupportCaseDetailFieldName
} from "../support-catalog";

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : null;
}

function uniqueFieldNames(values: unknown[]): SupportCaseDetailFieldName[] {
  const seen = new Set<string>();
  const fieldNames: SupportCaseDetailFieldName[] = [];

  for (const value of values) {
    const fieldName = nonEmptyString(value);

    if (!fieldName || seen.has(fieldName)) {
      continue;
    }

    seen.add(fieldName);
    fieldNames.push(fieldName as SupportCaseDetailFieldName);
  }

  return fieldNames;
}

function caseDetailKeys(snapshot: MergedTopicSnapshot): Set<string> {
  return new Set(snapshot.caseDetails.flatMap((detail) => {
    const key = nonEmptyString(detail.key);

    return key ? [key] : [];
  }));
}

function plannedAskFieldNames(
  topicResponsePlan: ResponsePlanV2
): SupportCaseDetailFieldName[] {
  return uniqueFieldNames(topicResponsePlan.ask.map((ask) => {
    return ask.fieldName;
  }));
}

function buildUnansweredRequestedFieldNamesForTopic(params: {
  snapshot: MergedTopicSnapshot;
  topicResponsePlan: ResponsePlanV2;
  previousUnansweredRequestedFieldNames?: SupportCaseDetailFieldName[] | null;
}): SupportCaseDetailFieldName[] {
  const knownFieldNames = caseDetailKeys(params.snapshot);
  const requestedFieldNames = uniqueFieldNames([
    ...(params.previousUnansweredRequestedFieldNames ?? []),
    ...plannedAskFieldNames(params.topicResponsePlan)
  ]);

  return requestedFieldNames.filter((fieldName) => {
    return !knownFieldNames.has(fieldName);
  });
}

export {
  buildUnansweredRequestedFieldNamesForTopic
};
