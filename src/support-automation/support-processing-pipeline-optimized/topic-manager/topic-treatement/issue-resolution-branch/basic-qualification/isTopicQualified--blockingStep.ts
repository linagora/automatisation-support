import type {
  LiveMemoryIssueBasicQualification,
  LiveMemoryTopicOptimized
} from "../../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";

type CaseDetailExtracted = LiveMemoryTopicOptimized["sourceAnalyzeSupportText"]["caseDetailsExtracted"][number];
type BasicQualification = LiveMemoryIssueBasicQualification;

export type IsTopicQualifiedInput = {
  basicQualification: BasicQualification;
  caseDetailsExtracted: CaseDetailExtracted[];
};

export type IsTopicQualifiedOutput = {
  basicQualification: BasicQualification;
};

function isTopicQualified(input: IsTopicQualifiedInput): IsTopicQualifiedOutput {
  const extractedByKey = collectExtractedCaseDetails(input.caseDetailsExtracted);

  const caseDetailsToAskBecauseOfBasicQualification = input.basicQualification.caseDetailsToAskBecauseOfBasicQualification.map((caseDetailToAsk) => {
    if (caseDetailToAsk.status !== "asking" || !caseDetailToAsk.key) return caseDetailToAsk;

    const extracted = extractedByKey.get(caseDetailToAsk.key) ?? extractedByKey.get(normalizeKey(caseDetailToAsk.key));
    if (!extracted) return caseDetailToAsk;

    return {
      ...caseDetailToAsk,
      status: extracted.status
    };
  });

  const isCompleted = caseDetailsToAskBecauseOfBasicQualification.every((caseDetailToAsk) => {
    return caseDetailToAsk.status !== "asking";
  });

  return {
    basicQualification: {
      isBuilt: input.basicQualification.isBuilt,
      isCompleted,
      caseDetailsToAskBecauseOfBasicQualification
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
