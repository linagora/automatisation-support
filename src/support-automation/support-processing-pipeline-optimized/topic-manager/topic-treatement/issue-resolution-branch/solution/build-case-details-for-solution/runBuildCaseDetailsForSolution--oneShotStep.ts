import {callLLM} from "../../../../../../../infrastructure/llm/llm-client";
import {parseLLMResponse} from "../../../../../../../infrastructure/llm/parseLLMResponse";
import {buildCaseDetailsForSolutionPrompt} from "./buildCaseDetailsForSolutionPrompt";
import {buildCaseDetailsForSolutionResponseFormat} from "./responseFormat";
import {validateBuildCaseDetailsForSolutionOutput} from "./validateBuildCaseDetailsForSolutionOutput";

import type {LiveMemoryTopicOptimized} from "../../../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";

type Solution = LiveMemoryTopicOptimized["sourceTopicManager"]["solution"];
type CaseDetailExtracted = LiveMemoryTopicOptimized["sourceAnalyzeSupportText"]["caseDetailsExtracted"][number];

export type RunBuildCaseDetailsForSolutionInput = {
  summaryTopic: string | null;
  userFacingKnowledgeText: string | null;
  supportFacingKnowledgeText: string | null;
  knownCaseDetailsExtracted: CaseDetailExtracted[];
  alreadyRequestedCaseDetailKeys: string[];
  alreadyRequestedCaseDetailQuestions: string[];
};

export type RunBuildCaseDetailsForSolutionOutput = {
  caseDetailsToAskBecauseOfSolutionFound: Solution["caseDetailsToAskBecauseOfSolutionFound"];
};

async function runBuildCaseDetailsForSolution(
  input: RunBuildCaseDetailsForSolutionInput
): Promise<RunBuildCaseDetailsForSolutionOutput> {
  const fallback = buildFallbackCaseDetailsForSolution();

  if (!hasUsableText(input.userFacingKnowledgeText) && !hasUsableText(input.supportFacingKnowledgeText)) {
    return fallback;
  }

  const {messages} = buildCaseDetailsForSolutionPrompt(input);

  try {
    const result = await callLLM(messages, {
      stage: "issue_solution_build_case_details",
      preset: "standard",
      temperature: 0,
      maxTokens: 800,
      responseFormat: buildCaseDetailsForSolutionResponseFormat
    });

    if (!result.success || !result.content) {
      return fallback;
    }

    const parsed = parseLLMResponse(result.content);
    const validated = validateBuildCaseDetailsForSolutionOutput(parsed, {
      knownCaseDetailsExtracted: input.knownCaseDetailsExtracted,
      alreadyRequestedCaseDetailKeys: input.alreadyRequestedCaseDetailKeys,
      alreadyRequestedCaseDetailQuestions: input.alreadyRequestedCaseDetailQuestions
    });

    return validated ?? fallback;
  } catch {
    return fallback;
  }
}

function buildFallbackCaseDetailsForSolution(): RunBuildCaseDetailsForSolutionOutput {
  return {
    caseDetailsToAskBecauseOfSolutionFound: []
  };
}

function hasUsableText(value: string | null): value is string {
  return typeof value === "string" && value.trim() !== "";
}

export {runBuildCaseDetailsForSolution};
