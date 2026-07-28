import {getDeepIssueQualificationFieldKeys} from "../qualificationRules.catalog";

import type {LiveMemoryTopicOptimized} from "../../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";

type DeepQualification = LiveMemoryTopicOptimized["sourceTopicManager"]["deepQualification"];
type CaseDetailExtracted = LiveMemoryTopicOptimized["sourceAnalyzeSupportText"]["caseDetailsExtracted"][number];
type DeepQualificationCaseDetailToAsk = DeepQualification["caseDetailsToAskBecauseOfDeepQualification"][number];

type BuildInitialDeepQualificationInput = {
  supportDomain: string | null;
  knownCaseDetailsExtracted: CaseDetailExtracted[];
};

type UpdateDeepQualificationInput = {
  deepQualification: DeepQualification;
  caseDetailsExtracted: CaseDetailExtracted[];
};

function buildInitialDeepQualification(input: BuildInitialDeepQualificationInput): DeepQualification {
  const extractedByKey = collectExtractedCaseDetails(input.knownCaseDetailsExtracted);

  const caseDetailsToAskBecauseOfDeepQualification = getDeepIssueQualificationFieldKeys(input.supportDomain).map((key) => {
    const extracted = extractedByKey.get(key) ?? extractedByKey.get(normalizeKey(key));

    return {
      key,
      reason: "catalogue rules",
      status: extracted?.status ?? "asking"
    } satisfies DeepQualificationCaseDetailToAsk;
  });

  return buildDeepQualificationState(caseDetailsToAskBecauseOfDeepQualification);
}

function updateDeepQualificationWithExtractedDetails(input: UpdateDeepQualificationInput): DeepQualification {
  const extractedByKey = collectExtractedCaseDetails(input.caseDetailsExtracted);

  const caseDetailsToAskBecauseOfDeepQualification = input.deepQualification.caseDetailsToAskBecauseOfDeepQualification.map((caseDetailToAsk) => {
    if (caseDetailToAsk.status !== "asking" || !caseDetailToAsk.key) return caseDetailToAsk;

    const extracted = extractedByKey.get(caseDetailToAsk.key) ?? extractedByKey.get(normalizeKey(caseDetailToAsk.key));
    if (!extracted) return caseDetailToAsk;

    return {
      ...caseDetailToAsk,
      status: extracted.status
    };
  });

  return buildDeepQualificationState(caseDetailsToAskBecauseOfDeepQualification);
}

function buildDeepQualificationState(
  caseDetailsToAskBecauseOfDeepQualification: DeepQualification["caseDetailsToAskBecauseOfDeepQualification"]
): DeepQualification {
  return {
    isBuilt: true,
    isCompleted: caseDetailsToAskBecauseOfDeepQualification.every((caseDetailToAsk) => {
      return caseDetailToAsk.status !== "asking";
    }),
    caseDetailsToAskBecauseOfDeepQualification
  };
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

export {
  buildInitialDeepQualification,
  updateDeepQualificationWithExtractedDetails
};