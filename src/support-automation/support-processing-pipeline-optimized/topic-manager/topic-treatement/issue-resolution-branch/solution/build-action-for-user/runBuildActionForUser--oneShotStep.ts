import {callLLM} from "../../../../../../../infrastructure/llm/llm-client";
import {parseLLMResponse} from "../../../../../../../infrastructure/llm/parseLLMResponse";
import {buildActionForUserPrompt} from "./buildActionForUserPrompt";
import {buildActionForUserResponseFormat} from "./responseFormat";
import {validateBuildActionForUserOutput} from "./validateBuildActionForUserOutput";

import type {LiveMemoryIssueSolution} from "../../../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";

type Solution = LiveMemoryIssueSolution;

export type RunBuildActionForUserInput = {
  summaryTopic: string | null;
  userFacingKnowledgeText: string | null;
};

export type RunBuildActionForUserOutput = {
  attemptedActionsToAskBecauseOfSolutionFound: Solution["attemptedActionsToAskBecauseOfSolutionFound"];
};

async function runBuildActionForUser(
  input: RunBuildActionForUserInput
): Promise<RunBuildActionForUserOutput> {
  const fallback = buildFallbackActionForUser();

  if (!hasUsableText(input.userFacingKnowledgeText)) {
    return fallback;
  }

  const {messages} = buildActionForUserPrompt(input);

  try {
    const result = await callLLM(messages, {
      stage: "issue_solution_build_action_for_user",
      preset: "standard",
      temperature: 0,
      maxTokens: 700,
      responseFormat: buildActionForUserResponseFormat
    });

    if (!result.success || !result.content) {
      return fallback;
    }

    const parsed = parseLLMResponse(result.content);
    const validated = validateBuildActionForUserOutput(parsed);

    return validated ?? fallback;
  } catch {
    return fallback;
  }
}

function buildFallbackActionForUser(): RunBuildActionForUserOutput {
  return {
    attemptedActionsToAskBecauseOfSolutionFound: []
  };
}

function hasUsableText(value: string | null): value is string {
  return typeof value === "string" && value.trim() !== "";
}

export {runBuildActionForUser};
