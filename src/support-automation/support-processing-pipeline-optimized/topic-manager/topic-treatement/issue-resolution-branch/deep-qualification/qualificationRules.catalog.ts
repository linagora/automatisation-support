import {
  getCaseDetailFieldAskPrompt,
  getCaseDetailFieldRequestLabel,
  getDeepIssueQualificationFieldKeys,
  getDeepIssueQualificationGroupKey,
  getDeepIssueQualificationGroupLabel
} from "../qualificationRules.catalog";

import type {
  CaseDetailFieldKey,
  DeepQualificationGroupKey
} from "../qualificationRules.catalog";

type DeepIssueFieldSpec = {
  key: CaseDetailFieldKey;
  askPrompt: string;
  requestLabel: string;
  groupKey: DeepQualificationGroupKey | null;
  groupLabel: string | null;
};

function getDeepIssueFieldSpecs(supportDomain: string | null): DeepIssueFieldSpec[] {
  return getDeepIssueQualificationFieldKeys(supportDomain).map((key) => {
    const groupKey = getDeepIssueQualificationGroupKey(supportDomain, key);

    return {
      key,
      askPrompt: getDeepIssueFieldAskPrompt(key),
      requestLabel: getDeepIssueFieldRequestLabel(key),
      groupKey,
      groupLabel: groupKey ? getDeepIssueQualificationGroupLabel(groupKey) : null
    };
  });
}

function getDeepIssueFieldAskPrompt(key: string | null): string {
  return getCaseDetailFieldAskPrompt(key);
}

function getDeepIssueFieldRequestLabel(key: string | null): string {
  return getCaseDetailFieldRequestLabel(key);
}

function getDeepIssueFieldGroupKey(
  supportDomain: string | null,
  key: string | null
): DeepQualificationGroupKey | null {
  return getDeepIssueQualificationGroupKey(supportDomain, key);
}

function getDeepIssueFieldGroupLabel(groupKey: DeepQualificationGroupKey): string {
  return getDeepIssueQualificationGroupLabel(groupKey);
}

const issueDeepQualificationKeyCatalog = {
  product_behavior: getDeepIssueQualificationFieldKeys("product_behavior"),
  access_security: getDeepIssueQualificationFieldKeys("access_security"),
  billing: getDeepIssueQualificationFieldKeys("billing"),
  integration_sync: getDeepIssueQualificationFieldKeys("integration_sync"),
  performance: getDeepIssueQualificationFieldKeys("performance"),
  availability: getDeepIssueQualificationFieldKeys("availability"),
  data_migration: getDeepIssueQualificationFieldKeys("data_migration"),
  accessibility: getDeepIssueQualificationFieldKeys("accessibility"),
  other: getDeepIssueQualificationFieldKeys("other")
} as const satisfies Record<string, readonly CaseDetailFieldKey[]>;

export {
  getDeepIssueFieldAskPrompt,
  getDeepIssueFieldGroupKey,
  getDeepIssueFieldGroupLabel,
  getDeepIssueFieldRequestLabel,
  getDeepIssueFieldSpecs,
  issueDeepQualificationKeyCatalog
};

export type {
  CaseDetailFieldKey,
  DeepIssueFieldSpec,
  DeepQualificationGroupKey
};