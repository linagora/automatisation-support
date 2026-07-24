import {getDeepIssueFieldSpecs} from "./qualificationRules.catalog";

import type {LiveMemoryTopicOptimized} from "../../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";

type CaseDetailExtracted = LiveMemoryTopicOptimized["sourceAnalyzeSupportText"]["caseDetailsExtracted"][number];
type DeepQualification = LiveMemoryTopicOptimized["sourceTopicManager"]["deepQualification"];
type DeepQualificationCaseDetailToAsk = DeepQualification["caseDetailsToAskBecauseOfDeepQualification"][number];

export type BuildTopicQualificationInput = {
  supportDomain: string | null;
  knownCaseDetailsExtracted: CaseDetailExtracted[];
};

export type BuildTopicQualificationOutput = {
  caseDetailsToAskBecauseOfDeepQualification: DeepQualification["caseDetailsToAskBecauseOfDeepQualification"];
};

function buildTopicQualification(input: BuildTopicQualificationInput): BuildTopicQualificationOutput {
  const extractedByKey = collectExtractedCaseDetails(input.knownCaseDetailsExtracted);

  const caseDetailsToAskBecauseOfDeepQualification = getDeepIssueFieldSpecs(input.supportDomain).map((spec) => {
    const extracted = extractedByKey.get(spec.key) ?? extractedByKey.get(normalizeKey(spec.key));

    return {
      key: spec.key,
      reason: "catalogue rules",
      status: extracted?.status ?? "asking"
    } satisfies DeepQualificationCaseDetailToAsk;
  });

  return {caseDetailsToAskBecauseOfDeepQualification};
}

function collectExtractedCaseDetails(caseDetailsExtracted: CaseDetailExtracted[]): Map<string, CaseDetailExtracted> {
  const extractedByKey = new Map<string, CaseDetailExtracted>();

  for (const caseDetail of caseDetailsExtracted) {
    extractedByKey.set(caseDetail.key, caseDetail);
    extractedByKey.set(normalizeKey(caseDetail.key), caseDetail);
  }

  return extractedByKey;
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export {buildTopicQualification};
