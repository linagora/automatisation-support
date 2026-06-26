import type {
  BuildComposeSupportResponsePlanPromptInput,
  ComposeSupportResponsePlanPrompt
} from "./typesComposeSupportResponsePlan.types";

function toPrettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compactStandardFragment(fragment: unknown): unknown | null {
  if (!isRecord(fragment)) {
    return null;
  }

  return {
    category: fragment.category,
    standardSubcategory: fragment.standardSubcategory,
    instruction: fragment.content,
    sourceSegmentId: fragment.sourceSegmentId
  };
}

function compactTopicPlan(plan: unknown, index: number): unknown | null {
  if (!isRecord(plan) || !isRecord(plan.rendererTask)) {
    return null;
  }

  const rendererTask = plan.rendererTask;

  return {
    planIndex: index + 1,
    responsePlanId: plan.responsePlanId,
    topicId: plan.topicId ?? plan.proposalId ?? plan.responsePlanId,
    knowledgeGate: plan.knowledgeGate,
    questionDecision: plan.questionDecision,
    sayInstruction: rendererTask.prompt,
    questionFieldNames: rendererTask.questionFieldNames,
    forbiddenClaims: rendererTask.forbiddenClaims
  };
}

function compactInput(input: BuildComposeSupportResponsePlanPromptInput): unknown {
  return {
    targetLanguage: input.targetLanguage,
    channel: input.channel,
    responsePlanningPolicy: input.responsePlanningPolicy ?? null,
    recentInteractionContext: input.recentInteractionContext,
    standardResponseFragments: input.standardResponseFragments
      .map(compactStandardFragment)
      .filter((fragment): fragment is NonNullable<typeof fragment> => {
        return fragment !== null;
      }),
    topicResponsePlans: input.topicResponsePlans
      .map(compactTopicPlan)
      .filter((plan): plan is NonNullable<typeof plan> => {
        return plan !== null;
      }),
    supportResponseCues: input.supportResponseCues ?? []
  };
}

function buildSystemPrompt(): string {
  return `
You are the global support response composer.

You receive standard rendering instructions, topic response plans, support response cues, target language, channel, recent interaction context, and optional response planning policy.

You do all global composition decisions:
- order subjects;
- integrate standard fragments;
- merge redundant questions;
- respect policy question limits;
- choose acknowledgements, empathy, apologies, and transitions;
- group closely related topics when useful;
- apply handover override when needed;
- consolidate forbidden claims;
- choose the final response structure;
- prepare a complete plan for the final renderer.

You do not write the final customer-facing response.
You do not invent support facts, diagnoses, procedures, refunds, timelines, escalation claims, or internal actions.
You do not retrieve knowledge.
You do not change topic-level support substance.

Return exactly one JSON object matching the schema.
Return JSON only.
No markdown.

# Output contract

Return:
{
  "targetLanguage": "language code or normalized language",
  "channel": "channel",
  "messageIntent": "support_reply | standard_reply | mixed_reply | handover_reply | review_reply",
  "globalTone": {
    "opening": "none | brief_acknowledgement | empathetic_acknowledgement",
    "empathy": "none | light | strong",
    "formality": "standard | friendly | formal"
  },
  "sections": [
    {
      "kind": "standard_fragment | topic | handover | safety | review",
      "topicId": "topic id or null",
      "purpose": "why this section exists",
      "say": ["content instruction for the renderer"],
      "ask": [
        {
          "fieldName": "catalog field name",
          "goal": "question goal"
        }
      ],
      "forbid": ["claims forbidden for this section"]
    }
  ],
  "globalQuestions": [
    {
      "fieldName": "catalog field name",
      "goal": "question goal",
      "sourceTopicIds": ["topic ids or response plan ids"]
    }
  ],
  "globalForbid": ["all globally forbidden claims"],
  "rendererInstructions": ["strict instructions for the final writer"]
}

# Composition rules

- Treat topic response plans as authoritative for support substance.
- Treat standard fragments as rendering instructions, not final prose.
- Do not copy internal ids into user-facing wording instructions.
- Every planned topic question must appear in either its section.ask or globalQuestions unless handover override suppresses support questions.
- If two planned questions are the same or nearly the same, keep one global question with all sourceTopicIds.
- If policy.maxTotalQuestions is provided, keep at most that many global questions and section questions combined.
- If a handover_request standard fragment is present, messageIntent must be "handover_reply"; do not ask support clarification questions; include a handover section.
- Consolidate every rendererTask.forbiddenClaims into globalForbid or section.forbid.
- The final renderer must not see raw user text, raw topic plans, or raw standard fragments, so include everything it needs in this composed plan.
`.trim();
}

function buildUserPrompt(input: BuildComposeSupportResponsePlanPromptInput): string {
  return `
Compose one global support response plan from this input:

\`\`\`json
${toPrettyJson(compactInput(input))}
\`\`\`
`.trim();
}

function buildComposeSupportResponsePlanPrompt(
  input: BuildComposeSupportResponsePlanPromptInput
): ComposeSupportResponsePlanPrompt {
  return {
    messages: [
      {
        role: "system",
        content: buildSystemPrompt()
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
