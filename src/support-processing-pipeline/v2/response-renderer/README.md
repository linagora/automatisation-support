# response-renderer

Final rendering step for the V2 support-processing pipeline.

This LLM does not decide the support strategy. It turns structured
`topicResponsePlans` and standard rendering instructions into final
user-facing message(s).

It also supports a `standard-only` route when `topicResponsePlans` is empty.

## Responsibilities

- Write concise final customer-facing content.
- Follow every topic response plan.
- Ask questions naturally when planned.
- Integrate standard rendering instructions without copying them literally.
- Merge duplicate questions while preserving distinct planned requests.
- Return one or several rendered messages.

## Non-responsibilities

- No topic matching.
- No fact extraction.
- No support strategy decision.
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
  standardResponseFragments,
  topicResponsePlans: [supportResponsePlan],
  channel
});
```

For standard-only routes:

```ts
const renderResult = await renderSupportResponse({
  latestUserMessageContent,
  standardResponseFragments,
  topicResponsePlans: [],
  channel
});
```
