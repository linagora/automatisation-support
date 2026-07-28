import {callLLM} from "../../../../../../../infrastructure/llm/llm-client";
import {parseLLMResponse} from "../../../../../../../infrastructure/llm/parseLLMResponse";
import {buildActionForUserPrompt} from "./buildActionForUserPrompt";
import {buildActionForUserResponseFormat} from "./responseFormat";
import {validateBuildActionForUserOutput} from "./validateBuildActionForUserOutput";

import type {LiveMemoryTopicOptimized} from "../../../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";

type Solution = LiveMemoryTopicOptimized["sourceTopicManager"]["solution"];

export type RunBuildActionForUserInput = {
  summaryTopic: string | null;
  userFacingInformation: string | null;
  currentUserMessage: {content: string; channel?: string};
};

export type RunBuildActionForUserOutput = {
  attemptedActionsToAskBecauseOfSolutionFound: Solution["attemptedActionsToAskBecauseOfSolutionFound"];
};

async function runBuildActionForUser(
  input: RunBuildActionForUserInput
): Promise<RunBuildActionForUserOutput> {
  const fallback = buildFallbackActionForUser(input.userFacingInformation);

  if (!hasUsableText(input.userFacingInformation)) {
    return {attemptedActionsToAskBecauseOfSolutionFound: []};
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

function buildFallbackActionForUser(userFacingInformation: string | null): RunBuildActionForUserOutput {
  if (!hasUsableText(userFacingInformation)) {
    return {attemptedActionsToAskBecauseOfSolutionFound: []};
  }

  return {
    attemptedActionsToAskBecauseOfSolutionFound: [
      {
        action: "Try the user-facing troubleshooting step described in the selected knowledge.",
        reason: userFacingInformation,
        status: "asking"
      }
    ]
  };
}

function hasUsableText(value: string | null): value is string {
  return typeof value === "string" && value.trim() !== "";
}

export {runBuildActionForUser};
