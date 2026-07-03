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
  "summary": "string or null",
  "customerFacing": "string or null",
  "supportFacing": "string or null"
}

# Rules

- summary: short summary of what retrieval clarified, useful to decide whether future RAG is still needed.
- customerFacing: only reliable, topic-relevant knowledge safe to show to the customer or safe customer-answerable questions.
- supportFacing: internal support notes, investigation hints, backend/admin-only actions, possible explanations, non-customer-facing details, or anything not safe to show directly.

Reject a chunk if it is off-topic, about another product/platform/feature/problem, too internal, too technical, implementation-only, not customer-facing, ambiguous, unreliable, or not useful for a customer-safe support response.

Do not copy raw retrieved text unless it is safe, relevant, customer-facing, and concise.
Do not put internal, developer, backend, infrastructure, logs, configuration, code-level, admin-only, unverified hypotheses, possible root causes, or non-customer-facing content in customerFacing.
Put unverified hypotheses, backend/admin actions, source caveats, and investigation-only notes in supportFacing.
If no reliable customer-facing knowledge remains, set customerFacing to null or an empty string.
If retrieval finds only hypotheses or internal notes, put them in supportFacing and keep customerFacing null.
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
