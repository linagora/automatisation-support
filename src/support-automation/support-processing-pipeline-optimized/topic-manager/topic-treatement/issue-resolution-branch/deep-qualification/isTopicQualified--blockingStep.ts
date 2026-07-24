import type {LiveMemoryTopicOptimized} from "../../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";

type CaseDetailExtracted = LiveMemoryTopicOptimized["sourceAnalyzeSupportText"]["caseDetailsExtracted"][number];
type DeepQualification = LiveMemoryTopicOptimized["sourceTopicManager"]["deepQualification"];

export type IsTopicQualifiedInput = {
  deepQualification: DeepQualification;
  caseDetailsExtracted: CaseDetailExtracted[];
};

export type IsTopicQualifiedOutput = {
  deepQualification: DeepQualification;
};

function isTopicQualified(input: IsTopicQualifiedInput): IsTopicQualifiedOutput {
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

  const isCompleted = caseDetailsToAskBecauseOfDeepQualification.every((caseDetailToAsk) => {
    return caseDetailToAsk.status !== "asking";
  });

  return {
    deepQualification: {
      isBuilt: input.deepQualification.isBuilt,
      isCompleted,
      caseDetailsToAskBecauseOfDeepQualification
    }
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

export {isTopicQualified};
