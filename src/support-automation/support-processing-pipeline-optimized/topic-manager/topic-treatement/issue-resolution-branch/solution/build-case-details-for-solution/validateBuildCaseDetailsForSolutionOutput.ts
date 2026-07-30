import {formatCatalogSelection} from "../../../../../analyze-support-text-optimized/catalogSelection";

import type {LiveMemoryTopicOptimized} from "../../../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";

type Solution = LiveMemoryTopicOptimized["sourceTopicManager"]["solution"];
type SolutionCaseDetailToAsk = Solution["caseDetailsToAskBecauseOfSolutionFound"][number];
type CaseDetailExtracted = LiveMemoryTopicOptimized["sourceAnalyzeSupportText"]["caseDetailsExtracted"][number];

export type BuildCaseDetailsForSolutionValidatedOutput = {
  caseDetailsToAskBecauseOfSolutionFound: Solution["caseDetailsToAskBecauseOfSolutionFound"];
};

export type ValidateBuildCaseDetailsForSolutionOutputInput = {
  knownCaseDetailsExtracted: CaseDetailExtracted[];
  alreadyRequestedCaseDetailKeys: string[];
  alreadyRequestedCaseDetailQuestions: string[];
};

const extractableKeySet = new Set(formatCatalogSelection.extractableFields.map((key) => normalizeKey(key)));

function validateBuildCaseDetailsForSolutionOutput(
  parsedResponse: unknown,
  input: ValidateBuildCaseDetailsForSolutionOutputInput
): BuildCaseDetailsForSolutionValidatedOutput | null {
  if (!isRecord(parsedResponse)) return null;
  if (!hasOnlyKeys(parsedResponse, ["caseDetailsToAskBecauseOfSolutionFound"])) return null;
  if (!Array.isArray(parsedResponse.caseDetailsToAskBecauseOfSolutionFound)) return null;

  const knownKeySet = new Set(input.knownCaseDetailsExtracted.map((caseDetail) => normalizeKey(caseDetail.key)));
  const requestedKeySet = new Set(input.alreadyRequestedCaseDetailKeys.map((key) => normalizeKey(key)));
  const requestedQuestionSet = new Set(input.alreadyRequestedCaseDetailQuestions.map((question) => normalizeQuestion(question)));
  const outputKeySet = new Set<string>();
  const outputQuestionSet = new Set<string>();
  const caseDetailsToAskBecauseOfSolutionFound: SolutionCaseDetailToAsk[] = [];

  for (const rawCaseDetail of parsedResponse.caseDetailsToAskBecauseOfSolutionFound) {
    const caseDetail = validateCaseDetailToAsk(rawCaseDetail);
    if (!caseDetail) continue;

    const normalizedKey = normalizeKey(caseDetail.key);
    const normalizedQuestion = normalizeQuestion(caseDetail.question);

    if (!extractableKeySet.has(normalizedKey)) continue;
    if (knownKeySet.has(normalizedKey)) continue;
    if (requestedKeySet.has(normalizedKey)) continue;
    if (requestedQuestionSet.has(normalizedQuestion)) continue;
    if (outputKeySet.has(normalizedKey)) continue;
    if (outputQuestionSet.has(normalizedQuestion)) continue;

    outputKeySet.add(normalizedKey);
    outputQuestionSet.add(normalizedQuestion);
    caseDetailsToAskBecauseOfSolutionFound.push({
      ...caseDetail,
      key: normalizedKey
    });

    if (caseDetailsToAskBecauseOfSolutionFound.length >= 3) break;
  }

  return {caseDetailsToAskBecauseOfSolutionFound};
}

function validateCaseDetailToAsk(value: unknown): SolutionCaseDetailToAsk | null {
  if (!isRecord(value)) return null;
  if (!hasOnlyKeys(value, ["key", "question", "reason", "status"])) return null;
  if (value.status !== "asking") return null;

  const key = validateRequiredString(value.key);
  const question = validateRequiredString(value.question);

  if (key === null || question === null) return null;

  return {
    key,
    question,
    reason: validateNullableString(value.reason),
    status: "asking"
  };
}

function validateRequiredString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmedValue = value.trim();
  return trimmedValue === "" ? null : trimmedValue;
}

function validateNullableString(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value === "string") return value.trim() === "" ? null : value.trim();
  return null;
}

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeQuestion(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: string[]): boolean {
  const allowedKeySet = new Set(allowedKeys);
  return Object.keys(value).every((key) => allowedKeySet.has(key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export {validateBuildCaseDetailsForSolutionOutput};
