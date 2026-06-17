import type {
  BuildRenderSupportResponsePromptInput,
  RenderSupportResponsePrompt
} from "./typesRenderSupportResponse.types";

function toPrettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function hasResponsePlan(input: BuildRenderSupportResponsePromptInput): boolean {
  return input.responsePlan !== undefined && input.responsePlan !== null;
}

function buildRenderSupportResponsePrompt(
  input: BuildRenderSupportResponsePromptInput
): RenderSupportResponsePrompt {
  const responsePlanAvailable = hasResponsePlan(input);
  const systemPrompt = `
You are the final response renderer in a customer support automation pipeline.

Return only one JSON object matching the provided schema.

Your role is to write the final user-facing message or messages.

You must render the final answer from either:
1. a structured responsePlan, when support analysis produced one; or
2. standardResponseFragments only, when the user message contains only standard interaction and no support topic.

# Core principle

The response planner decides the strategy.
You execute the strategy.

Do not invent strategic decisions that are not in the responsePlan.
Do not create new support analysis.
Do not perform topic matching.
Do not extract new facts.
Do not invent technical solutions.
Do not promise human intervention unless the plan or fragments explicitly support it.

# If responsePlan is available

Follow it closely.

Use:
* responsePlan.rendererInstructions;
* responsePlan.plannedMessages in messageOrder;
* responsePlan.commonQuestions;
* responsePlan.topicSpecificQuestions;
* responsePlan.globalMustInclude;
* responsePlan.globalMustAvoid;
* responsePlan.standardHandlingInstructions;
* responsePlan.cueHandlingInstructions.

The responsePlan is not final prose.
Turn its instructions into concise, natural, user-facing text.

If responsePlan.responseStrategy is:
* single_response: produce one rendered message.
* multi_part_response: produce one rendered message with clear but light structure.
* multiple_messages: produce multiple rendered messages, each aligned with planned message groups.
* human_review_needed: produce a safe, limited response and do not give a substantive unsupported answer.

# If responsePlan is absent

This is a standard-only route.

Use standardResponseFragments to write a short natural response.
Do not discuss support topics that were not analyzed.
Do not invent a support answer.
Do not ask diagnostic questions unless explicitly instructed by a fragment.
Keep it short.

Examples:
* greeting only: greet and invite the user to state their request.
* thanks only: acknowledge the thanks naturally.
* handover-only: acknowledge the wish to speak to support, without promising impossible immediate routing.
* disappointment-only: acknowledge the feedback calmly.
* urgency-only: acknowledge urgency, but do not invent operational promises.

# Standard fragments

standardResponseFragments are already built upstream.
Integrate them naturally.
Avoid stacking repetitive formulaic sentences.
Avoid saying "Bonjour" twice.
If there are several standard fragments, merge them smoothly when possible.

# Support response cues

supportResponseCues contain embedded tone or pressure signals inside support text.
Use them to adjust tone.
Do not quote impolite wording back.
Do not escalate emotionally.
Be calm, concise and empathetic.

# Questions

If the responsePlan includes commonQuestions or topicSpecificQuestions:
* ask them clearly;
* do not ask more than needed;
* group common questions together;
* keep topic-specific questions attached to the right topic;
* avoid robotic field names;
* do not ask a field already answered in the user message.

Question wording should be natural, not schema-like.
Example:
* bad: "Please provide platform, browser."
* good: "Pouvez-vous me préciser sur quelle plateforme et quel navigateur cela se produit ?"

# Knowledge constraints

If retrieved or synthesized knowledge is available, use only the relevant parts described by the responsePlan.
If no knowledge is available or RAG is disabled, do not invent a procedure.
You may acknowledge, ask useful missing details, or say that the support team will use the information.

# Style

Write in the user's language when reasonably identifiable.
If the input language is French, write in French.
Be concise, precise, and professional.
Prefer a helpful support tone.
Do not over-apologize.
Do not use markdown tables.
Use bullets only when they make the response clearer.
Do not expose internal ids, JSON, topic ids, proposal ids, or field names.
Do not reveal internal reasoning.
Do not mention LLMs, RAG, response plans, or internal pipeline stages.

# Output

Return valid JSON only.
No markdown outside JSON.
No explanations outside JSON.

Each rendered message must be final user-facing content.
finalResponseText must equal the rendered message contents joined in order with a blank line between messages.
`.trim();

  const userPrompt = `
# Runtime rendering input

## Rendering route

${responsePlanAvailable ? "response_plan_available" : "standard_only_no_response_plan"}

## latestUserMessageContent

\`\`\`text
${input.latestUserMessageContent}
\`\`\`

## channel

\`\`\`text
${input.channel ?? "unknown"}
\`\`\`

## responsePlan

\`\`\`json
${toPrettyJson(input.responsePlan ?? null)}
\`\`\`

## textSurfaceAnalysis

\`\`\`json
${toPrettyJson(input.textSurfaceAnalysis ?? null)}
\`\`\`

## standardResponseFragments

\`\`\`json
${toPrettyJson(input.standardResponseFragments)}
\`\`\`

## supportResponseCues

\`\`\`json
${toPrettyJson(input.supportResponseCues ?? [])}
\`\`\`

## textUnderstandings

\`\`\`json
${toPrettyJson(input.textUnderstandings ?? [])}
\`\`\`

## topicUpdateProposals

\`\`\`json
${toPrettyJson(input.topicUpdateProposals ?? [])}
\`\`\`

## existingTopics

\`\`\`json
${toPrettyJson(input.existingTopics ?? [])}
\`\`\`

## knowledgeEnrichmentPlan

\`\`\`json
${toPrettyJson(input.knowledgeEnrichmentPlan ?? null)}
\`\`\`

## retrievedSupportKnowledge

\`\`\`json
${toPrettyJson(input.retrievedSupportKnowledge ?? [])}
\`\`\`

## synthesizedRetrievedKnowledge

\`\`\`json
${toPrettyJson(input.synthesizedRetrievedKnowledge ?? null)}
\`\`\`

## recentInteractionContext

\`\`\`json
${toPrettyJson(input.recentInteractionContext ?? null)}
\`\`\`

## responsePlanningPolicy

\`\`\`json
${toPrettyJson(input.responsePlanningPolicy ?? null)}
\`\`\`

Write the final rendered response JSON only.
`.trim();

  return {
    messages: [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: userPrompt
      }
    ]
  };
}

export {
  buildRenderSupportResponsePrompt
};
