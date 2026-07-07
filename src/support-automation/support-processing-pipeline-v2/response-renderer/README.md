# response-renderer

Final writing step for the V2 support-processing pipeline.

This LLM receives only a `composedSupportResponsePlan` produced by
`compose-support-response-plan`.

It does not compose globally and does not receive:

- raw latest user message content;
- standard response fragments;
- raw topic response plans.

## Responsibilities

- Turn the composed plan into concise final customer-facing content.
- Preserve the section order and planned questions.
- Use `sections[].say` as the operational source for topic support content.
- Respect renderer instructions.
- Return one or several rendered messages.

## Non-responsibilities

- No topic matching.
- No fact extraction.
- No global composition.
- No question deduplication.
- No support strategy decision.
- No invented technical solution.
- No RAG retrieval.
- No persistence.
