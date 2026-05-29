# Test and Build Repair Roadmap

## Tests to Rewrite or Realign

### `tests/support-processing-pipeline/runSupportProcessingPipeline.test.ts`

- Old contract tested: injectable step chain ending with `data-production`, with legacy input fields such as `attachments`.
- New expected contract: async support-processing orchestrator using current inputs, optional real/default steps, `response-production`, and `patches-production`.
- Priority: high.

### `tests/support-processing-pipeline/message-analysis/runMessageAnalysis.test.ts`

- Old contract tested: step-injected message analysis pipeline with `input-cleaning`, routing decision, LLM0/LLM1, and support knowledge assembly.
- New expected contract: current `runMessageAnalysis` orchestration around security checks, attachment analysis, fullweight analysis, and turn understanding delta.
- Priority: later, after stabilizing the current message-analysis type contracts.

### `tests/support-processing-pipeline/message-analysis/attachment-analysis/runAttachmentAnalysis.test.ts`

- Old contract tested: exported helper functions and legacy `attachments` input.
- New expected contract: current `runAttachmentAnalysis` input based on `latestUserAttachments`, current attachment readiness logic, and current vision analysis shape.
- Priority: later, together with attachment-analysis build/type repair.

### `tests/support-processing-pipeline/search-decision/runSearchDecision.test.ts`

- Old contract tested: injectable search-decision steps and boolean `decisionSearchingSolution`.
- New expected contract: deterministic per-topic decision returning `decision.topics[]` with `ask_more_info`, `acknowledgement`, or `solution_searching`.
- Priority: high.

### `tests/support-processing-pipeline/solution-retrieval/runSolutionRetrieval.test.ts`

- Old contract tested: retrieval status object and injectable retrieval steps.
- New expected contract: current deterministic/mock retrieval output used when at least one topic requests `solution_searching`.
- Priority: medium.

### `tests/support-processing-pipeline/response-plan/runResponsePlan.test.ts`

- Old contract tested: response plan without per-topic search decisions.
- New expected contract: response plan input includes `decisionSearchingSolution.topics`, and topic messages are built from per-topic decisions.
- Priority: high.

### `tests/support-processing-pipeline/response-production/runResponseProduction.test.ts`

- Old contract tested: legacy topic formatting with inline text, `(x)` plurals, and old status labels.
- New expected contract: final `{ messages }` output with natural topic text, line breaks, grouped signals, and current topic status labels.
- Priority: high.

## Build Errors by Zone

### `llm`

- Missing exports for `LLMTokenEstimate` and `LLMModelConfig`.
- Duplicate type declarations for `MessageContent` and `LLMRequestBody`.
- Duplicate string index signatures.

### `message-analysis / attachment-analysis`

- `AttachmentVisionAnalysis` shape is inconsistent between expected `visionDescription` and produced `llmDescription` / `structuredObservations`.
- `LatestUserAttachment` field names are inconsistent between shared types and implementation (`name`, `url`, `path`, `mimeType`, `sizeBytes` versus `filename`, `accessUrl`, `sizeInBytes`).

### `message-analysis / fullweight-message-analysis`

- Normalized `UnknownRecord[]` values are assigned to stricter segment types.
- `unknown[] | null` is passed where `unknown[]` is expected.
- Duplicate `RawFullWeightMessageAnalysis` declarations.

### `message-analysis global`

- `FullWeightMessageAnalysisOutput` is imported from a file that does not export it.
- Central message-analysis types and submodule-specific types are no longer aligned.
- `runTurnUnderstandingDelta` reads `decision` and `analysis` from values typed as `{}`.

### `response-plan`

- `TopicNextStep` needed to accept `wait_for_support` because `addTopicPlanMessage` can produce that value.

## Recommended Order

1. Fix `response-plan` first by allowing `TopicNextStep` to accept `wait_for_support`.
2. Realign `search-decision` tests.
3. Realign `response-plan` tests.
4. Realign `response-production` tests.
5. Realign `solution-retrieval` tests.
6. Then treat `message-analysis` / `attachment-analysis`.
7. Finally treat `llm` and the remaining global build errors.
