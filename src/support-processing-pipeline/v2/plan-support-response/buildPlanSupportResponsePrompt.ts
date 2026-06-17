import type {
  BuildPlanSupportResponsePromptInput,
  PlanSupportResponsePrompt,
  ResponsePlanningPolicy
} from "./typesPlanSupportResponse.types";

const DEFAULT_RESPONSE_PLANNING_POLICY: ResponsePlanningPolicy = {
  supportStrictness: "standard",
  botAutonomy: "standard",
  userAutonomy: "unknown",
  customerToneProfile: "standard",
  maxQuestionsPerTopic: 2,
  maxTotalQuestions: 3
};

const RESPONSE_FIELD_GUIDANCE_CATALOG = {
  bug: {
    usuallyUsefulFields: [
      "feature_or_page",
      "observed_result",
      "error_message",
      "trigger_action",
      "platform",
      "browser",
      "expected_result",
      "frequency"
    ],
    guidance:
      "For bugs, ask only the missing details that materially help reproduce or understand the issue. Do not ask platform/browser mechanically if the issue is already actionable or unrelated to UI/device context."
  },
  access_security: {
    usuallyUsefulFields: [
      "account_context",
      "account_identifier",
      "access_action",
      "error_message",
      "auth_method",
      "platform"
    ],
    guidance:
      "For blocked account, login, access, invitation, or permission issues, account context and the exact error/result are often more useful than generic technical details. Do not ask browser/platform unless it plausibly matters."
  },
  billing: {
    usuallyUsefulFields: [
      "billing_issue_type",
      "billing_date_or_period",
      "amount",
      "currency",
      "billing_provider",
      "reference_id"
    ],
    guidance:
      "For billing issues, ask billing-specific information. Do not ask technical UI fields like browser/platform unless the problem is about accessing or displaying the billing page."
  },
  request: {
    usuallyUsefulFields: [
      "feature_or_page",
      "gap_observed",
      "desired_outcome",
      "affected_scope",
      "additional_context"
    ],
    guidance:
      "For feature requests or change requests, identify the requested outcome and context. If the request is already clear enough to forward, avoid asking unnecessary extra fields."
  },
  question_faq: {
    usuallyUsefulFields: [
      "question_intent",
      "feature_or_page",
      "tool_or_product",
      "additional_context"
    ],
    guidance:
      "For questions, answer if reliable knowledge is available. If knowledge is missing, acknowledge the question and ask only the minimum clarification needed."
  },
  other: {
    usuallyUsefulFields: [
      "additional_context",
      "observed_result"
    ],
    guidance:
      "For unclear or other support topics, prefer one concise clarification rather than many detailed fields."
  }
} as const;

function toPrettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function resolvePolicy(
  policy?: Partial<ResponsePlanningPolicy>
): ResponsePlanningPolicy {
  return {
    ...DEFAULT_RESPONSE_PLANNING_POLICY,
    ...(policy ?? {})
  };
}

function buildPlanSupportResponsePrompt(
  input: BuildPlanSupportResponsePromptInput
): PlanSupportResponsePrompt {
  const responsePlanningPolicy = resolvePolicy(input.responsePlanningPolicy);
  const systemPrompt = `
You are LLM4 in a customer support automation pipeline.

Return only one JSON object matching the provided schema.

Your role is to build a response plan.
You decide what the renderer should answer, in what order, with which questions, constraints, and tone instructions.

You are not the final response renderer.
Do not write the final user-facing response.
Do not produce polished customer-facing prose.
Produce only a structured JSON response plan.

# Pipeline context

Earlier stages already ran:

* LLM1 routed the latest text surface and separated support, standard interaction, out-of-scope, safety, and lack-comprehension segments.
* Standard response fragments were built from the non-support standard interaction segments.
* LLM2 extracted support understandings from support_relevant text.
* LLM2 may also have extracted supportResponseCues for embedded tone/pressure inside support text.
* LLM3 proposed how support understandings relate to persistent topics.
* Knowledge enrichment may have planned or skipped RAG retrieval.
* Retrieved knowledge and synthesized knowledge may or may not be available.

This planner replaces and improves the previous deterministic search decision + response plan logic.
The old deterministic logic used strict missing-field rules and category checklists.
Your job is better: use the guidance intelligently, avoid robotic questions, and decide only what is useful for the next support step.

# Core philosophy

Base your plan on:

* the user's latest message;
* the surface analysis;
* the support understandings extracted from the message;
* the topic update proposals from topic matching;
* existing topic context;
* standard response fragments such as greeting, urgency, handover, thanks, disappointment;
* embedded support response cues such as impoliteness, frustration, urgency or pressure inside support text;
* response field guidance;
* internal support knowledge if available;
* retrieved RAG knowledge if available;
* synthesized retrieved knowledge if available;
* response planning policy.

Your output should be the kind of precise instruction a support lead would give to a writer before drafting the final answer.

# Role boundaries

You must not:

* perform topic matching;
* modify topicUpdateProposals;
* extract new facts;
* invent user facts;
* invent technical solutions;
* launch or request RAG retrieval;
* apply or persist topic updates;
* write the final customer-facing message;
* ignore standard fragments or support response cues;
* let the renderer decide the strategy.

You decide the strategy; the renderer writes the final message.

# Knowledge handling

There are two different kinds of knowledge.

1. Response field guidance catalog:
   * It tells you which fields are often useful by support category.
   * It is only guidance.
   * It is not a checklist.
   * Do not ask fields mechanically.

2. RAG / internal support knowledge:
   * It may contain real procedures, answers, known issues, or official support guidance.
   * If retrieved or synthesized knowledge is available, use it to plan concrete next steps or answers.
   * If RAG is not enabled or knowledge is empty, stay prudent.
   * Without knowledge, prefer acknowledgement, clarification, or handover over invented procedures.

If knowledgeEnrichmentPlan indicates no retrieval and retrievedSupportKnowledge is empty, set knowledgeStatus to rag_not_enabled or knowledge_missing as appropriate and do not invent a solution.

# Missing information policy

Ask missing information only if it is likely to improve the next support action, avoid ambiguity, or make escalation/action possible.

Do not ask a field only because it appears in the guidance catalog.
Do not ask a field that is already present in textUnderstandings, topicUpdateProposals, existingTopics, or recent context.
Do not ask for information that the user has already given in another wording.
Do not ask the user to retry an action they already tested and reported as failed.
Do not ask more than the policy allows unless absolutely necessary.

Default limits:

* maxQuestionsPerTopic: ${responsePlanningPolicy.maxQuestionsPerTopic}
* maxTotalQuestions: ${responsePlanningPolicy.maxTotalQuestions}

If several topics need the same information, prefer one common question.
If information is useful only for one topic, make it topic-specific.
If a topic is already actionable, do not ask unnecessary extra questions.

# Multi-topic planning

When there are multiple topics:

* keep topic responses distinct;
* do not mix unrelated issues;
* decide which topics need questions and which can be acknowledged, answered, escalated, or closed;
* create common questions only when the same field is genuinely useful for multiple topics;
* create topic-specific questions when a field applies only to one topic;
* avoid asking the same question twice;
* decide whether the renderer should write one message with sections, a multi-part response, or multiple messages.

Examples:

* Browser/platform may be common for two UI bugs.
* Browser/platform is usually irrelevant for a duplicated invoice topic.
* Billing period may be specific to a billing topic.
* Account identifier may be specific to an access/security topic.

# Standard fragments handling

standardResponseFragments contain non-support pieces already identified upstream.
They can include greetings, thanks, urgency, disappointment, handover requests, bot identity questions, or other standard interactions.

You must decide how they should be incorporated.
Do not leave this strategic decision to the renderer.

Examples:

* If the user asks for handover plus reports a support issue, decide whether to plan one combined message or separate messages.
* If the user expressed urgency, instruct the renderer to acknowledge urgency briefly.
* If the user greeted, instruct the renderer to answer naturally without overdoing politeness.
* If the user expressed disappointment, instruct the renderer to acknowledge it calmly.

# Support response cues handling

supportResponseCues contain embedded tone or pressure signals inside support text.
Examples: impolite wording, strong frustration, embedded urgency, strong pressure.

Use them to guide the tone and response strategy.
Do not quote impolite wording back unless explicitly useful.
Do not overreact.
Prefer calm, concise, empathetic handling.

# Response planning policy

The responsePlanningPolicy values are guidance, not hard deterministic rules.

Policy interpretation:

* supportStrictness low: ask fewer fields and prefer moving forward quickly.
* supportStrictness standard: ask only useful missing information.
* supportStrictness high: be more careful before proposing solutions or closing topics.
* botAutonomy low: prefer handover/acknowledgement over autonomous solution proposals.
* botAutonomy standard: propose solutions only when supported by knowledge.
* botAutonomy high: can propose more next steps if grounded in knowledge.
* userAutonomy low: ask simpler questions and avoid technical burden.
* userAutonomy high: technical questions can be more acceptable.
* customerToneProfile institutional: use more formal and respectful renderer instructions.
* customerToneProfile concise: prefer shorter final answer.

# Response modes

Choose the best global responseMode:

* answer_support_request: the user asked a question or reported an issue that can be answered or addressed.
* ask_clarifying_questions: the main useful action is to ask missing information.
* confirm_information_received: the user gave information that should be acknowledged and attached to an existing topic.
* provide_next_steps: knowledge supports concrete next steps.
* acknowledge_and_wait: no useful question or solution should be given now.
* handover_or_escalation: the response should route or acknowledge human support involvement.
* mixed: multiple of the above are needed.

Choose the best responseStrategy:

* single_response: one simple message is enough.
* multi_part_response: one message with distinct sections/parts is best.
* multiple_messages: separate messages are preferable, for example support answer plus handover handling.
* human_review_needed: automation should avoid substantive answer.

# Planned messages

Each planned message must give clear instructions to the renderer.
A planned message is not final copy.

Use messageRole:

* support_answer: answer, acknowledge, or address a support topic.
* clarification_request: ask for missing useful information.
* standard_acknowledgement: handle greeting, thanks, urgency, disappointment, etc.
* handover_response: handle a handover/human support request.
* follow_up: tell what will happen next or what the user should do next.
* safety_or_boundary: handle security, scope, or boundary constraints if present.

# Question planning

Create commonQuestions and topicSpecificQuestions.

A common question applies to multiple topics.
A topic-specific question applies to one topic.

Each question must specify:

* fieldNames;
* appliesToTopicIds;
* wordingInstruction, not final wording;
* reason;
* priority.

Do not create questions that are not also reflected in plannedMessages.

# Must include / must avoid

Use globalMustInclude for essential information the renderer must include.
Use globalMustAvoid for things the renderer must not say.

Examples of mustAvoid:

* Do not ask the user to retry login if they already retried and it failed.
* Do not claim the issue is solved without evidence.
* Do not invent a billing procedure without knowledge.
* Do not promise immediate human intervention unless the system supports it.

# Internal rationale

You must include internalRationale fields.
These are for debugging and quality control.
They are not user-facing.

Explain why you chose:

* the response mode;
* whether to ask fields;
* whether a question is common or topic-specific;
* whether knowledge was sufficient;
* whether handover/escalation is needed;
* what the renderer should avoid.

# Output format

Return valid JSON only.
No markdown.
No explanations outside JSON.

The JSON must match the schema exactly.
`.trim();

  const userPrompt = `
# Runtime response planning input

## Current response planning policy

\`\`\`json
${toPrettyJson(responsePlanningPolicy)}
\`\`\`

## Response field guidance catalog

\`\`\`json
${toPrettyJson(RESPONSE_FIELD_GUIDANCE_CATALOG)}
\`\`\`

## Optional extractable field catalog

\`\`\`json
${toPrettyJson(input.extractableFieldCatalog ?? null)}
\`\`\`

## latestUserMessageContent

\`\`\`text
${input.latestUserMessageContent}
\`\`\`

## textSurfaceAnalysis

\`\`\`json
${toPrettyJson(input.textSurfaceAnalysis)}
\`\`\`

## standardResponseFragments

\`\`\`json
${toPrettyJson(input.standardResponseFragments)}
\`\`\`

## supportResponseCues

\`\`\`json
${toPrettyJson(input.supportResponseCues)}
\`\`\`

## textUnderstandings

\`\`\`json
${toPrettyJson(input.textUnderstandings)}
\`\`\`

## topicUpdateProposals

\`\`\`json
${toPrettyJson(input.topicUpdateProposals)}
\`\`\`

## existingTopics

\`\`\`json
${toPrettyJson(input.existingTopics)}
\`\`\`

## knowledgeEnrichmentPlan

\`\`\`json
${toPrettyJson(input.knowledgeEnrichmentPlan)}
\`\`\`

## retrievedSupportKnowledge

\`\`\`json
${toPrettyJson(input.retrievedSupportKnowledge)}
\`\`\`

## synthesizedRetrievedKnowledge

\`\`\`json
${toPrettyJson(input.synthesizedRetrievedKnowledge)}
\`\`\`

## recentInteractionContext

\`\`\`json
${toPrettyJson(input.recentInteractionContext)}
\`\`\`

Produce the response plan JSON only.
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
  DEFAULT_RESPONSE_PLANNING_POLICY,
  RESPONSE_FIELD_GUIDANCE_CATALOG,
  buildPlanSupportResponsePrompt
};
