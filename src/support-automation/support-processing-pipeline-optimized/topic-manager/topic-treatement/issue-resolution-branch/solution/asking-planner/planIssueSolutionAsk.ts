import {callLLM} from "../../../../../../../infrastructure/llm/llm-client";
import {parseLLMResponse} from "../../../../../../../infrastructure/llm/parseLLMResponse";
import {buildDeterministicIssueSolutionAsk, buildIssueSolutionAskPrompt} from "./buildIssueSolutionAskPrompt";
import {issueSolutionAskResponseFormat} from "./responseFormat";
import {validateIssueSolutionAskPlannerOutput} from "./validateIssueSolutionAskPlannerOutput";

import type {LiveMemoryIssueSolution} from "../../../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";

type Solution = LiveMemoryIssueSolution;

export type PlanIssueSolutionAskInput = {
  previousConversationTurn: {
    previousUserMessage: string | null;
    previousBotMessage: string | null;
  };
  solution: Solution;
};

export type PlanIssueSolutionAskOutput = {
  say: string | null;
};

async function planIssueSolutionAsk(input: PlanIssueSolutionAskInput): Promise<PlanIssueSolutionAskOutput> {
  const fallbackSay = buildDeterministicIssueSolutionAsk(input);

  if (fallbackSay === null) {
    return {say: null};
  }

  const {messages} = buildIssueSolutionAskPrompt(input);

  try {
    const result = await callLLM(messages, {
      stage: "issue_solution_ask_user_action",
      preset: "standard",
      temperature: 0,
      maxTokens: 500,
      responseFormat: issueSolutionAskResponseFormat
    });

    if (!result.success || !result.content) {
      return {say: fallbackSay};
    }

    const parsed = parseLLMResponse(result.content);
    const validated = validateIssueSolutionAskPlannerOutput(parsed);

    return validated ?? {say: fallbackSay};
  } catch {
    return {say: fallbackSay};
  }
}

export {planIssueSolutionAsk};
