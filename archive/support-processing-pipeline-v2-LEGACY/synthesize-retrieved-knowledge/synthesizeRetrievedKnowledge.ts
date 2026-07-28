import {
  buildSynthesizeRetrievedKnowledgePrompt
} from "./buildSynthesizeRetrievedKnowledgePrompt";
import {
  formatSynthesizeRetrievedKnowledgeOutput,
  isNoRelevantKnowledgeText,
  safeFallback
} from "./formatSynthesizeRetrievedKnowledgeOutput";
import {
  requestSynthesizeRetrievedKnowledge
} from "./requestSynthesizeRetrievedKnowledge";

import type {
  CandidateKnowledgeChunk,
  KnowledgeChunk,
  RetrievedKnowledgeSynthesis,
  SynthesizeRetrievedKnowledgeInput,
  SynthesizeRetrievedKnowledgeRequester
} from "./typesSynthesizeRetrievedKnowledge.types";

function hasUsableSource(chunk: KnowledgeChunk): boolean {
  const metadata = chunk.metadata;

  if (!metadata) {
    return true;
  }

  if (
    typeof metadata.sourceCount === "number" &&
    Number.isFinite(metadata.sourceCount)
  ) {
    return metadata.sourceCount > 0;
  }

  if (Array.isArray(metadata.sources)) {
    return metadata.sources.length > 0;
  }

  return true;
}

function toCandidateChunk(chunk: KnowledgeChunk): CandidateKnowledgeChunk {
  return {
    topicId: chunk.topicId ?? null,
    sourceId: chunk.sourceId,
    content: chunk.content.trim(),
    score: chunk.score,
    metadata: chunk.metadata
  };
}

function buildCandidateChunks(
  knowledgeChunks: KnowledgeChunk[]
): CandidateKnowledgeChunk[] {
  return knowledgeChunks.flatMap((chunk) => {
    const content = chunk.content.trim();

    if (
      content === "" ||
      !hasUsableSource(chunk) ||
      isNoRelevantKnowledgeText(content)
    ) {
      return [];
    }

    return [toCandidateChunk(chunk)];
  });
}

function logSynthesisFailure(reason: string): void {
  console.debug("support.v2.synthesize_retrieved_knowledge.failed", {
    reason
  });
}

async function synthesizeRetrievedKnowledge(
  input: SynthesizeRetrievedKnowledgeInput,
  requester: SynthesizeRetrievedKnowledgeRequester =
    requestSynthesizeRetrievedKnowledge
): Promise<RetrievedKnowledgeSynthesis> {
  const candidateChunks = buildCandidateChunks(input.knowledgeChunks);

  if (candidateChunks.length === 0) {
    return safeFallback(
      input,
      candidateChunks,
      "No usable customer-facing knowledge found for this topic."
    );
  }

  const prompt = buildSynthesizeRetrievedKnowledgePrompt({
    input,
    candidateChunks
  });
  const rawSynthesizeRetrievedKnowledge = await requester({ prompt });

  if (rawSynthesizeRetrievedKnowledge.status !== "completed") {
    logSynthesisFailure(
      rawSynthesizeRetrievedKnowledge.error?.message ?? "llm_call_failed"
    );
  }

  return formatSynthesizeRetrievedKnowledgeOutput({
    input,
    candidateChunks,
    rawSynthesizeRetrievedKnowledge
  });
}

export {
  buildCandidateChunks,
  synthesizeRetrievedKnowledge
};
