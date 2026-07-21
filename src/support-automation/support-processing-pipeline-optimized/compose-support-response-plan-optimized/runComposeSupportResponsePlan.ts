import {callLLM} from "../../../infrastructure/llm/llm-client";
import {parseLLMResponse} from "../../../infrastructure/llm/parseLLMResponse";
import {buildComposeSupportResponsePlanPrompt} from "./buildComposeSupportResponsePlanPrompt";
import {
  buildDeterministicComposedSupportResponsePlan,
  validateComposeSupportResponsePlanOutput
} from "./validateComposeSupportResponsePlanOutput";

import type {
  PreviousConversationTurn,
  StandardResponseFragment,
  SupportResponseCue,
  TopicPlannerOutput
} from "./buildComposeSupportResponsePlanPrompt";
import type {
  ComposedSupportResponsePlan
} from "./validateComposeSupportResponsePlanOutput";

type ComposeSupportResponsePlanFallbackReason =
  | "empty_plan_input"
  | "llm_call_failed"
  | "missing_llm_content"
  | "invalid_llm_output";

type ComposeSupportResponsePlanInput = {
  topicPlannerOutputs: TopicPlannerOutput[];
  standardResponseFragments?: StandardResponseFragment[];
  supportResponseCues?: SupportResponseCue[];
  currentUserMessage?: {content: string};
  previousConversationTurn?: PreviousConversationTurn;
  responsePlanningPolicy?: unknown;
  channel?: string;
};

type ComposeSupportResponsePlanComposedOutput = {
  status: "composed";
  fallbackReason: null;
  composedSupportResponsePlan: ComposedSupportResponsePlan;
};

type ComposeSupportResponsePlanFallbackOutput = {
  status: "fallback";
  fallbackReason: ComposeSupportResponsePlanFallbackReason;
  composedSupportResponsePlan: ComposedSupportResponsePlan;
};

type ComposeSupportResponsePlanOutput =
  | ComposeSupportResponsePlanComposedOutput
  | ComposeSupportResponsePlanFallbackOutput;

// LLM brick contract:
// Input: topic-level say outputs plus optional standard fragments and response cues.
// Output: a compact composed response plan consumed by the renderer.
// Non-goals: no diagnosis, no retrieval, no support action, no final user-facing prose.
// Fallback policy: deterministic composition from existing say fragments only.
async function runComposeSupportResponsePlan(
  input: ComposeSupportResponsePlanInput
): Promise<ComposeSupportResponsePlanOutput> {
  if (!hasAnyComposableContent(input)) {
    return buildFallbackOutput(input, "empty_plan_input");
  }

  const {messages, responseFormat} = buildComposeSupportResponsePlanPrompt(input);

  try {
    const result = await callLLM(messages, {
      stage: "compose_support_response_plan",
      preset: "fullWeightMessageAnalysis",
      temperature: 0,
      maxTokens: 1800,
      responseFormat
    });

    if (!result.success) {
      return buildFallbackOutput(input, "llm_call_failed");
    }

    if (!result.content || result.content.trim() === "") {
      return buildFallbackOutput(input, "missing_llm_content");
    }

    const parsedResponse = parseLLMResponse(result.content);

    if (!parsedResponse) {
      return buildFallbackOutput(input, "invalid_llm_output");
    }

    const validatedOutput = validateComposeSupportResponsePlanOutput(parsedResponse);

    if (!validatedOutput) {
      return buildFallbackOutput(input, "invalid_llm_output");
    }

    return {
      status: "composed",
      fallbackReason: null,
      composedSupportResponsePlan: validatedOutput
    };
  } catch {
    return buildFallbackOutput(input, "llm_call_failed");
  }
}

function hasAnyComposableContent(input: ComposeSupportResponsePlanInput): boolean {
  const hasTopicSay = input.topicPlannerOutputs.some((plan) => {
    return typeof plan.say === "string" && plan.say.trim() !== "";
  });

  const hasStandardFragment = (input.standardResponseFragments ?? []).some((fragment) => {
    return typeof fragment.content === "string" && fragment.content.trim() !== "";
  });

  return hasTopicSay || hasStandardFragment;
}

function buildFallbackOutput(
  input: ComposeSupportResponsePlanInput,
  reason: ComposeSupportResponsePlanFallbackReason
): ComposeSupportResponsePlanFallbackOutput {
  return {
    status: "fallback",
    fallbackReason: reason,
    composedSupportResponsePlan: buildDeterministicComposedSupportResponsePlan({
      topicPlannerOutputs: input.topicPlannerOutputs,
      standardResponseFragments: input.standardResponseFragments
    })
  };
}

const composeSupportResponsePlan = runComposeSupportResponsePlan;

export {
  composeSupportResponsePlan,
  runComposeSupportResponsePlan
};

export type {
  ComposeSupportResponsePlanFallbackReason,
  ComposeSupportResponsePlanInput,
  ComposeSupportResponsePlanOutput,
  ComposedSupportResponsePlan,
  StandardResponseFragment,
  SupportResponseCue,
  TopicPlannerOutput
};
