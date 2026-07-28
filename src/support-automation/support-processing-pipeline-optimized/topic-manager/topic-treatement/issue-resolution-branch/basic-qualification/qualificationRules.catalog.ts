import {
  getBasicIssueQualificationFieldKeys,
  getCaseDetailFieldAskPrompt
} from "../qualificationRules.catalog";

import type {CaseDetailFieldKey} from "../qualificationRules.catalog";

type BasicIssueFieldSpec = {
  key: CaseDetailFieldKey;
  askPrompt: string;
};

function getBasicIssueFieldSpecs(supportDomain: string | null): BasicIssueFieldSpec[] {
  return getBasicIssueQualificationFieldKeys(supportDomain).map((key) => {
    return {
      key,
      askPrompt: getBasicIssueFieldAskPrompt(key)
    };
  });
}

function getBasicIssueFieldAskPrompt(key: string | null): string {
  return getCaseDetailFieldAskPrompt(key);
}

const issueBasicQualificationKeyCatalog = {
  product_behavior: getBasicIssueQualificationFieldKeys("product_behavior"),
  access_security: getBasicIssueQualificationFieldKeys("access_security"),
  billing: getBasicIssueQualificationFieldKeys("billing"),
  integration_sync: getBasicIssueQualificationFieldKeys("integration_sync"),
  performance: getBasicIssueQualificationFieldKeys("performance"),
  availability: getBasicIssueQualificationFieldKeys("availability"),
  data_migration: getBasicIssueQualificationFieldKeys("data_migration"),
  accessibility: getBasicIssueQualificationFieldKeys("accessibility"),
  other: getBasicIssueQualificationFieldKeys("other")
} as const satisfies Record<string, readonly CaseDetailFieldKey[]>;

export {
  getBasicIssueFieldAskPrompt,
  getBasicIssueFieldSpecs,
  issueBasicQualificationKeyCatalog
};

export type {BasicIssueFieldSpec, CaseDetailFieldKey};