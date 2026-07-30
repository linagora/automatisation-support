import {callLLM} from "../../../../../../../infrastructure/llm/llm-client";
import {parseLLMResponse} from "../../../../../../../infrastructure/llm/parseLLMResponse";
import {buildActionForSupportPrompt} from "./buildActionForSupportPrompt";
import {buildActionForSupportResponseFormat} from "./responseFormat";
import {validateBuildActionForSupportOutput} from "./validateBuildActionForSupportOutput";

export type RunBuildActionForSupportInput = {
  summaryTopic: string | null;
  supportFacingKnowledgeText: string | null;
};

export type RunBuildActionForSupportOutput = {
  actionToTakeForSupport: string | null;
};

async function runBuildActionForSupport(
  input: RunBuildActionForSupportInput
): Promise<RunBuildActionForSupportOutput> {
  const fallback = buildFallbackActionForSupport();

  if (!hasUsableText(input.supportFacingKnowledgeText)) {
    return fallback;
  }

  const {messages} = buildActionForSupportPrompt(input);

  try {
    const result = await callLLM(messages, {
      stage: "issue_solution_build_action_for_support",
      preset: "standard",
      temperature: 0,
      maxTokens: 700,
      responseFormat: buildActionForSupportResponseFormat
    });

    if (!result.success || !result.content) {
      return fallback;
    }

    const parsed = parseLLMResponse(result.content);
    const validated = validateBuildActionForSupportOutput(parsed);

    return validated ?? fallback;
  } catch {
    return fallback;
  }
}

function buildFallbackActionForSupport(): RunBuildActionForSupportOutput {
  return {
    actionToTakeForSupport: null
  };
}

function hasUsableText(value: string | null): value is string {
  return typeof value === "string" && value.trim() !== "";
}

export {runBuildActionForSupport};
