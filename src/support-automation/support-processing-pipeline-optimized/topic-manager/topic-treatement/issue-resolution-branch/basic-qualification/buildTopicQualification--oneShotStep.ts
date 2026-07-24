import {getBasicIssueFieldSpecs} from "./qualificationRules.catalog";

import type {LiveMemoryTopicOptimized} from "../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";

type CaseDetailExtracted = LiveMemoryTopicOptimized["sourceAnalyzeSupportText"]["caseDetailsExtracted"][number];
type BasicQualification = LiveMemoryTopicOptimized["sourceTopicManager"]["basicQualification"];
type BasicQualificationCaseDetailToAsk = BasicQualification["caseDetailsToAskBecauseOfBasicQualification"][number];

export type BuildTopicQualificationInput = {
  supportDomain: string | null;
  knownCaseDetailsExtracted: CaseDetailExtracted[];
};

export type BuildTopicQualificationOutput = {
  caseDetailsToAskBecauseOfBasicQualification: BasicQualification["caseDetailsToAskBecauseOfBasicQualification"];
};

function buildTopicQualification(input: BuildTopicQualificationInput): BuildTopicQualificationOutput {
  const extractedByKey = collectExtractedCaseDetails(input.knownCaseDetailsExtracted);

  const caseDetailsToAskBecauseOfBasicQualification = getBasicIssueFieldSpecs(input.supportDomain).map((spec) => {
    const extracted = extractedByKey.get(spec.key) ?? extractedByKey.get(normalizeKey(spec.key));

    return {
      key: spec.key,
      reason: "catalogue rules",
      status: extracted?.status ?? "asking"
    } satisfies BasicQualificationCaseDetailToAsk;
  });

  return {caseDetailsToAskBecauseOfBasicQualification};
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
