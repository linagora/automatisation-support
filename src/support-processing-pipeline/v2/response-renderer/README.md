# response-renderer

Final rendering step for the V2 support-processing pipeline.

This LLM does not decide the support strategy. It turns the structured `responsePlan`
into final user-facing message(s).

It also supports a temporary `standard-only` route:
when no support topic exists and `responsePlan` is absent, it can render a short
natural answer from `standardResponseFragments` only.

## Responsibilities

- Write concise final customer-facing content.
- Follow `responsePlan` when present.
- Respect planned message order.
- Ask questions naturally when planned.
- Integrate standard fragments without repetition.
- Adjust tone from `supportResponseCues`.
- Return one or several rendered messages.

## Non-responsibilities

- No topic matching.
- No fact extraction.
- No support strategy decision when a `responsePlan` exists.
- No invented technical solution.
- No RAG retrieval.
- No persistence.

## Suggested location

```text
src/support-processing-pipeline/v2/response-renderer/
```

## Pipeline usage

For support routes:

```ts
const renderResult = await renderSupportResponse({
  latestUserMessageContent,
  responsePlan,
  textSurfaceAnalysis,
  standardResponseFragments,
  supportResponseCues,
  textUnderstandings,
  topicUpdateProposals,
  existingTopics,
  knowledgeEnrichmentPlan,
  retrievedSupportKnowledge,
  synthesizedRetrievedKnowledge,
  recentInteractionContext,
  responsePlanningPolicy,
  channel
});
```

For standard-only routes:

```ts
const renderResult = await renderSupportResponse({
  latestUserMessageContent,
  responsePlan: null,
  standardResponseFragments,
  supportResponseCues: [],
  channel
});
```
