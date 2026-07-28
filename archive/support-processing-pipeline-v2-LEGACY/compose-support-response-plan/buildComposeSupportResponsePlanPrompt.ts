import type {
  BuildComposeSupportResponsePlanPromptInput,
  ComposeSupportResponsePlanPrompt
} from "./typesComposeSupportResponsePlan.types";

function toPromptJson(value: unknown): string {
  return JSON.stringify(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const stringItem = asString(item);

    return stringItem ? [stringItem] : [];
  });
}

function sanitizeStandardResponseFragments(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((fragment) => {
    if (!isRecord(fragment)) {
      return [];
    }

    return [{
      category: asString(fragment.category),
      standardSubcategory: asString(fragment.standardSubcategory),
      sourceSegmentId: asString(fragment.sourceSegmentId),
      sourceVerbatim: asString(fragment.sourceVerbatim),
      content: asString(fragment.content)
    }];
  });
}

function sanitizeTopicResponsePlans(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((plan) => {
    if (!isRecord(plan)) {
      return [];
    }

    const say = stringArray(plan.say);

    if (say.length === 0) {
      return [];
    }

    return [{
      responsePlanId: asString(plan.responsePlanId),
      topicId: asString(plan.topicId),
      acknowledge: stringArray(plan.acknowledge),
      answer: Array.isArray(plan.answer) ? plan.answer : [],
      ask: Array.isArray(plan.ask) ? plan.ask : [],
      say,
      review: asString(plan.review)
    }];
  });
}

function sanitizeSupportResponseCues(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((cue) => {
    if (!isRecord(cue)) {
      return [];
    }

    return [{
      cueId: asString(cue.cueId),
      cueNote: asString(cue.cueNote),
      verbatim: asString(cue.verbatim),
      sourceSegmentIds: stringArray(cue.sourceSegmentIds),
      relatedUnderstandingIds: stringArray(cue.relatedUnderstandingIds)
    }];
  });
}

type ComposerTask = {
  channel: unknown;
  hasSupportTopics: boolean;
  recentInteractionContext: unknown;
  responsePlanningPolicy: unknown;
  standardResponseFragments: unknown[];
  topicResponsePlans: unknown[];
  supportResponseCues: unknown[];
};

function buildComposerTask(
  input: BuildComposeSupportResponsePlanPromptInput
): ComposerTask {
  const topicResponsePlans = sanitizeTopicResponsePlans(
    input.topicResponsePlans
  );

  return {
    channel: input.channel,
    hasSupportTopics: topicResponsePlans.length > 0,
    recentInteractionContext: input.recentInteractionContext ?? null,
    responsePlanningPolicy: input.responsePlanningPolicy ?? null,
    standardResponseFragments: sanitizeStandardResponseFragments(
      input.standardResponseFragments
    ),
    topicResponsePlans,
    supportResponseCues: sanitizeSupportResponseCues(
      input.supportResponseCues
    )
  };
}

function hasSupportTopics(
  input: BuildComposeSupportResponsePlanPromptInput
): boolean {
  return sanitizeTopicResponsePlans(input.topicResponsePlans).length > 0;
}

function buildStandardOnlySystemPrompt(): string {
  return `
You are a support response plan composer for standard-only replies.

You are NOT the final user-facing writer.
You do NOT write the final customer message.
The final renderer will write the final natural message.

You receive standardResponseFragments, supportResponseCues, recentInteractionContext, responsePlanningPolicy, and channel.
There are no support topic plans in this task.
The final renderer receives language and channel separately, so do not output them.

Return exactly one valid JSON object.
Return JSON only. No markdown.

# Output shape

{
  "topicId": null,
  "messageIntent": "standard_reply | handover_reply | review_reply",
  "acknowledge": ["internal planning note"],
  "answer": [
    {
      "point": "internal standard reply point",
      "support": "standard_fragment | support_cue | policy"
    }
  ],
  "ask": [
    {
      "goal": "internal question goal",
      "sourceTopicIds": []
    }
  ],
  "say": ["compact renderer instruction, not final user-facing prose"],
  "review": "short reason or null"
}

# Contract

The field "say" is NOT the final customer-facing message.
It is a compact instruction list for the renderer.
Do not write polished final prose inside say.
Do not localize the final answer yourself.
Keep the plan short and clear.

# Standard-only behavior

- Preserve the intent of every usable standardResponseFragment.
- Combine and deduplicate equivalent fragments.
- Use standardResponseFragments as the main source.
- Use supportResponseCues only for tone, caution, or wording constraints.
- Use recentInteractionContext and responsePlanningPolicy only as constraints.
- If a handover_request fragment is present, use messageIntent = "handover_reply".
- Otherwise use messageIntent = "standard_reply".
- Use messageIntent = "review_reply" only when the inputs are unsafe, contradictory, or impossible to compose safely.

# Safety limits

Do not invent support facts, troubleshooting steps, diagnosis, account status, escalation, refund, timeline, internal action, or resolution promise.
Do not claim anything was checked or verified.
Do not claim that a human agent was notified unless a fragment explicitly says so.
If clarification is needed, ask a generic clarification question only when the standard fragments require it.

# say[] requirements

say[] must give the renderer enough information to write the final answer using only channel and say[].
Include the standard intent to preserve, any generic question to ask, and any important do-not-claim limit.
`.trim();
}

function buildSupportOrMixedSystemPrompt(): string {
  return `
You are the global support response plan synthesizer for support or mixed replies.

You are NOT the final user-facing writer.
You do NOT write the final customer message.
The final renderer will write the final natural message.

You receive:
- channel
- standardResponseFragments
- topicResponsePlans
- supportResponseCues
- recentInteractionContext
- responsePlanningPolicy

This prompt is used only when at least one topicResponsePlan exists.
The final renderer will receive language and channel separately from the deterministic pipeline.
Do not output language or channel.

Return exactly one valid JSON object.
Return JSON only.
No markdown.

# Output shape

{
  "topicId": null,
  "messageIntent": "support_reply | mixed_reply | handover_reply | review_reply",
  "acknowledge": [
    "internal planning note"
  ],
  "answer": [
    {
      "point": "internal supported answer point",
      "support": "standard_fragment | topic_plan | support_cue | policy"
    }
  ],
  "ask": [
    {
      "goal": "internal question goal",
      "sourceTopicIds": ["topic ids or response plan ids"]
    }
  ],
  "say": [
    "compact renderer instruction, not final user-facing prose"
  ],
  "review": "short reason or null"
}

# Core contract

The field "say" is NOT the final customer-facing message.
The field "say" is a list of compact instructions for the renderer.

Do not write polished final prose inside say.
Do not localize the final answer yourself.
Do not write full customer-facing paragraphs.
The renderer is responsible for writing the final message and adapting it to channel.

Bad say:
[
  "Bonjour, je suis l'assistant de support. Comment puis-je vous aider aujourd'hui ? Je comprends que..."
]

Good say:
[
  "Briefly greet the user. Briefly acknowledge disappointment if present. Mention only the concrete issues already reported by the user. Ask only the specific planned questions from the topic response plans. Do not confirm user-reported issues as verified."
]

# Priority hierarchy

1. topicResponsePlans[].say is the authoritative support substance.
2. topicResponsePlans[].ask contains the specific planned questions.
3. standardResponseFragments are tone/context only.
4. supportResponseCues may adjust tone or caution, not support substance.
5. recentInteractionContext and responsePlanningPolicy may constrain wording, not create new support facts.

# Standard fragments in support or mixed replies

Because topicResponsePlans exist, standardResponseFragments are tone/context only.
They may add a short greeting, thanks, empathy, apology, or handover context.
They must not introduce generic help invitations.
They must not introduce generic clarification requests.
They must not ask the user to explain the issue again.
The user has already provided concrete support issues.
Topic response plans remain the support substance.

Do not include generic invitation instructions such as:
- "Ask how the assistant can help."
- "Invite the user to explain what they need help with."
- "Ask the user to describe their issue."
- "How can I help you?"
- "Comment puis-je vous aider ?"
- "Expliquez-moi votre demande."

# Acknowledgement

Acknowledge what the user says, reports, or indicates.
Do not phrase acknowledgements as if support has verified the claim.

Use instructions like:
- "Acknowledge that the user reports..."
- "Mention that the user says..."
- "Acknowledge the user's report of..."

Do not instruct the renderer to say:
- "Confirm that the account is blocked."
- "Confirm the duplicate billing."
- "We confirm that..."
- "The account is blocked."
unless verified evidence exists in retrieved knowledge or account data.

# Support substance

- Preserve every concrete support instruction from topicResponsePlans[].say.
- Preserve every specific question from topicResponsePlans[].say or topicResponsePlans[].ask.
- You may group or deduplicate equivalent questions.
- Do not create new questions, fields, checks, troubleshooting steps, refunds, timelines, escalation claims, internal team actions, or account status claims.
- Do not invent that anything has been checked.
- Do not invent a diagnosis.
- Do not invent that a human agent has been notified.
- For duplicate invoice, duplicate document, duplicate receipt, or duplicate email issues, do not imply duplicate payment or duplicate charge unless the user explicitly said they were charged, debited, or paid twice.

# Multi-topic synthesis

When multiple topicResponsePlans exist:
- Address every usable topic.
- Do not drop a topic.
- Preserve topic order unless another order is clearly more natural.
- Keep topic-specific questions attached to the correct topic.
- Merge duplicate questions only when they ask for the same information.
- Keep distinct questions when they serve different topics or different decisions.

# say[] requirements

say[] must be compact but complete.
say[] must mention all concrete user issues that need to be rendered.
say[] must include:
- how to open,
- what to acknowledge,
- what support substance to preserve,
- what specific questions to ask,
- what limitations or do-not-claim rules the renderer must respect.

Do not leave important content only in acknowledge, answer, ask, messageIntent, or review.
The renderer must be able to produce the final answer using only channel and say[].

# Message intent

Use:
- "support_reply" when there are support topic plans and no meaningful standard fragment.
- "mixed_reply" when there are both standard fragments and support topic plans.
- "handover_reply" when a handover request overrides the normal support response.
- "review_reply" when the inputs are too contradictory, unsafe, or incomplete to compose safely.
`.trim();
}

function buildSystemPrompt(
  input: BuildComposeSupportResponsePlanPromptInput
): string {
  if (!hasSupportTopics(input)) {
    return buildStandardOnlySystemPrompt();
  }

  return buildSupportOrMixedSystemPrompt();
}

function buildUserPrompt(
  input: BuildComposeSupportResponsePlanPromptInput
): string {
  return `
Build one global support response plan from this composer task:
${toPromptJson(buildComposerTask(input))}
`.trim();
}

function buildComposeSupportResponsePlanPrompt(
  input: BuildComposeSupportResponsePlanPromptInput
): ComposeSupportResponsePlanPrompt {
  return {
    messages: [
      {
        role: "system",
        content: buildSystemPrompt(input)
      },
      {
        role: "user",
        content: buildUserPrompt(input)
      }
    ]
  };
}

export {
  buildComposeSupportResponsePlanPrompt
};
