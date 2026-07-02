import type {
  BuildSynthesizeRetrievedKnowledgePromptInput,
  SynthesizeRetrievedKnowledgePrompt
} from "./typesSynthesizeRetrievedKnowledge.types";

function toPromptJson(value: unknown): string {
  return JSON.stringify(value);
}

function buildSynthesisTask(
  input: BuildSynthesizeRetrievedKnowledgePromptInput
): unknown {
  const pipelineInput = input.input;

  return {
    topic: {
      topicId: pipelineInput.topicEvidence.topicId,
      topicSourceVerbatims: pipelineInput.topicEvidence.topicSourceVerbatims,
      topicSnapshot:
        pipelineInput.topicSnapshot ??
        pipelineInput.topicEvidence.topicSnapshot ??
        null,
      relatedTextUnderstandings:
        pipelineInput.topicEvidence.relatedTextUnderstandings,
      relatedAttachmentUnderstandings:
        pipelineInput.topicEvidence.relatedAttachmentUnderstandings
    },
    selectedCatalogKnowledge: pipelineInput.selectedCatalogKnowledge,
    retrievalRequests:
      pipelineInput.knowledgeEnrichmentPlan.retrievalRequests.map((request) => {
        return {
          topicId: request.topicId,
          searchPurpose: request.searchPurpose,
          desiredKnowledge: request.desiredKnowledge,
          context: request.context,
          filters: request.filters ?? null
        };
      }),
    candidateChunks: input.candidateChunks.map((chunk) => {
      return {
        sourceId: chunk.sourceId,
        topicId: chunk.topicId,
        score: chunk.score,
        content: chunk.content,
        metadata: chunk.metadata ?? null
      };
    })
  };
}

function buildSystemPrompt(): string {
  return `
You are cleaning retrieved support knowledge before response planning.

Do not write the final support response.
Do not decide what the support bot should say.
Separate customer-facing knowledge from internal-only knowledge.
Reject irrelevant or unsafe chunks.
Return JSON only.

# Output

{
  "relevantFacts": [],
  "applicableInstructions": [],
  "possibleFields": [],
  "unresolvedPoints": [],
  "sourceReferences": [],
  "limitations": [],
  "doNotClaim": [],
  "internalNotes": [],
  "retrievedChunkCount": 0
}

# Rules

- relevantFacts: only reliable, topic-relevant information safe to show to the customer.
- applicableInstructions: only safe support-client guidance or safe planner guidance.
- possibleFields: only field names that a customer can reasonably answer.
- unresolvedPoints: only unresolved customer-facing questions or ambiguity.
- sourceReferences: sourceId values only for chunks accepted into relevantFacts or applicableInstructions.
- limitations: internal knowledge limits, not text to expose verbatim.
- doNotClaim: claims the planner must not make.
- internalNotes: useful support/dev/backend/infrastructure notes that must not reach the customer.
- retrievedChunkCount: number of accepted chunks represented by sourceReferences.

Reject a chunk if it is off-topic, about another product/platform/feature/problem, too internal, too technical, implementation-only, not customer-facing, ambiguous, unreliable, or not useful for a customer-safe support response.

Do not copy raw retrieved text unless it is safe, relevant, customer-facing, and concise.
Do not put internal, developer, backend, infrastructure, logs, configuration, code-level, admin-only, or non-customer-facing content in relevantFacts or applicableInstructions.
If no usable customer-facing knowledge remains, return empty relevantFacts, applicableInstructions, sourceReferences, retrievedChunkCount 0, and add a limitation.
`.trim();
}

function buildUserPrompt(
  input: BuildSynthesizeRetrievedKnowledgePromptInput
): string {
  return `
Clean and synthesize this retrieved knowledge:
${toPromptJson(buildSynthesisTask(input))}
`.trim();
}

function buildSynthesizeRetrievedKnowledgePrompt(
  input: BuildSynthesizeRetrievedKnowledgePromptInput
): SynthesizeRetrievedKnowledgePrompt {
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
  buildSynthesizeRetrievedKnowledgePrompt
};
