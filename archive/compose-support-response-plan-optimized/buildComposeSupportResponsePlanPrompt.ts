import {
  outputJsonShapeForPrompt,
  responseFormat
} from "./responseFormat";

import type {LLMMessage} from "../../../infrastructure/llm/llm-client";

type TopicPlannerOutput = {
  topicId: number | null;
  say: string;
};

type StandardResponseFragment = {
  category?: string | null;
  standardSubcategory?: string | null;
  sourceSegmentId?: string | null;
  sourceVerbatim?: string | null;
  content?: string | null;
};

type SupportResponseCue = {
  cueId?: string | null;
  cueNote?: string | null;
  verbatim?: string | null;
  sourceSegmentIds?: string[];
  relatedUnderstandingIds?: string[];
};

type PreviousConversationTurn = {
  previousUserVerbatim: string | null;
  previousBotVerbatim: string | null;
};

type BuildComposeSupportResponsePlanPromptInput = {
  topicPlannerOutputs: TopicPlannerOutput[];
  standardResponseFragments?: StandardResponseFragment[];
  supportResponseCues?: SupportResponseCue[];
  currentUserMessage?: {content: string};
  previousConversationTurn?: PreviousConversationTurn;
  responsePlanningPolicy?: unknown;
  channel?: string;
};

type ComposeSupportResponsePlanLlmRequest = {
  messages: LLMMessage[];
  responseFormat: typeof responseFormat;
};

function buildComposeSupportResponsePlanPrompt(
  input: BuildComposeSupportResponsePlanPromptInput
): ComposeSupportResponsePlanLlmRequest {
  const systemPrompt = `
You are the global support response composer.

You are NOT the final user-facing writer.
The final renderer will write the natural final message.

Your job is to compose a compact response plan from already-approved topic-level outputs.
Return only JSON matching the requested schema.
`.trim();

  const userPrompt = `
# Input

<current_user_message>
${input.currentUserMessage?.content ?? ""}
</current_user_message>

<previous_conversation_turn>
${JSON.stringify(input.previousConversationTurn ?? null)}
</previous_conversation_turn>

<channel>
${input.channel ?? "unknown"}
</channel>

<response_planning_policy>
${JSON.stringify(input.responsePlanningPolicy ?? null)}
</response_planning_policy>

<topic_planner_outputs>
${JSON.stringify(normalizeTopicPlannerOutputs(input.topicPlannerOutputs))}
</topic_planner_outputs>

<standard_response_fragments>
${JSON.stringify(normalizeStandardResponseFragments(input.standardResponseFragments))}
</standard_response_fragments>

<support_response_cues>
${JSON.stringify(normalizeSupportResponseCues(input.supportResponseCues))}
</support_response_cues>

# Contract

The authoritative support content is topicPlannerOutputs[].say.
Each topicPlannerOutput has already been produced by the relevant topic branch.
Do not invent a diagnosis, solution, support action, promise, account status, escalation, refund, timeline, or internal operation.
Do not expose topic ids, branch names, RAG, catalog names, planner names, pipeline names, JSON, or technical internals to the user.

# Composition policy

- Preserve every useful topicPlannerOutputs[].say.
- Remove duplicates and merge repeated instructions.
- Keep the plan compact: the renderer should receive clear instructions, not a long final message.
- If there are support topic outputs and standard fragments, use messageIntent = "mixed_reply".
- If there are only support topic outputs, use messageIntent = "support_reply".
- If there are only standard fragments, use messageIntent = "standard_reply" unless the fragment is clearly a handover request.
- Use messageIntent = "handover_reply" only when handover is the main requested response.
- Use messageIntent = "review_reply" only when the inputs are contradictory, unsafe, or impossible to compose safely.
- topicIds must be the topic ids from topicPlannerOutputs, deduplicated in natural response order.
- say[] must contain one or more compact renderer instructions.
- review must be null unless something needs human review.

# Output JSON shape

${outputJsonShapeForPrompt}

Return only JSON.
`.trim();

  return {
    messages: [
      {role: "system", content: systemPrompt},
      {role: "user", content: userPrompt}
    ],
    responseFormat
  };
}

function normalizeTopicPlannerOutputs(value: unknown): TopicPlannerOutput[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    if (typeof item.say !== "string" || item.say.trim() === "") return [];

    return [{
      topicId: typeof item.topicId === "number" && Number.isFinite(item.topicId)
        ? item.topicId
        : null,
      say: item.say.trim()
    }];
  });
}

function normalizeStandardResponseFragments(value: unknown): StandardResponseFragment[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!isRecord(item)) return [];

    const fragment = {
      category: asNullableString(item.category),
      standardSubcategory: asNullableString(item.standardSubcategory),
      sourceSegmentId: asNullableString(item.sourceSegmentId),
      sourceVerbatim: asNullableString(item.sourceVerbatim),
      content: asNullableString(item.content)
    };

    return Object.values(fragment).some((entry) => entry !== null)
      ? [fragment]
      : [];
  });
}

function normalizeSupportResponseCues(value: unknown): SupportResponseCue[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!isRecord(item)) return [];

    const cue = {
      cueId: asNullableString(item.cueId),
      cueNote: asNullableString(item.cueNote),
      verbatim: asNullableString(item.verbatim),
      sourceSegmentIds: stringArray(item.sourceSegmentIds),
      relatedUnderstandingIds: stringArray(item.relatedUnderstandingIds)
    };

    return cue.cueId || cue.cueNote || cue.verbatim || cue.sourceSegmentIds.length > 0 || cue.relatedUnderstandingIds.length > 0
      ? [cue]
      : [];
  });
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    return typeof item === "string" && item.trim() !== ""
      ? [item.trim()]
      : [];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export {buildComposeSupportResponsePlanPrompt};

export type {
  BuildComposeSupportResponsePlanPromptInput,
  ComposeSupportResponsePlanLlmRequest,
  PreviousConversationTurn,
  StandardResponseFragment,
  SupportResponseCue,
  TopicPlannerOutput
};
