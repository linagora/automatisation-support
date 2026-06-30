import type {
  CandidateKnowledgeChunk,
  FormatSynthesizeRetrievedKnowledgeOutputInput,
  RawRetrievedKnowledgeSynthesis,
  RetrievedKnowledgeSynthesis,
  SynthesizeRetrievedKnowledgeInput
} from "./typesSynthesizeRetrievedKnowledge.types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim() !== ""))];
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return unique(value.flatMap((item) => {
    return typeof item === "string" && item.trim() !== ""
      ? [item.trim()]
      : [];
  }));
}

function isNoRelevantKnowledgeText(value: string): boolean {
  return /\b(no relevant|no applicable|nothing relevant|no information|not enough information|aucune information|pas d'information)\b/iu
    .test(value);
}

function getTopicId(
  input: SynthesizeRetrievedKnowledgeInput,
  candidateChunks: CandidateKnowledgeChunk[]
): string | number | null {
  return candidateChunks[0]?.topicId ??
    input.knowledgeEnrichmentPlan.retrievalRequests[0]?.topicId ??
    input.topicEvidence.topicId ??
    null;
}

function technicalLimitations(
  input: SynthesizeRetrievedKnowledgeInput
): string[] {
  return input.knowledgeRetrievalFailureReason
    ? ["Knowledge retrieval failed or timed out for this topic."]
    : [];
}

function safeFallback(
  input: SynthesizeRetrievedKnowledgeInput,
  candidateChunks: CandidateKnowledgeChunk[],
  reason: string
): RetrievedKnowledgeSynthesis {
  const topicId = getTopicId(input, candidateChunks);

  return {
    relevantFacts: [],
    applicableInstructions: [],
    possibleFields: [],
    unresolvedPoints: [],
    sourceReferences: [],
    limitations: unique([
      ...technicalLimitations(input),
      reason
    ]),
    doNotClaim: [],
    internalNotes: [],
    retrievedChunkCount: 0,
    topics: [
      {
        topicId,
        relevantFacts: [],
        applicableInstructions: [],
        possibleFields: [],
        unresolvedPoints: [],
        sourceReferences: []
      }
    ]
  };
}

function sourceReferencesForUsableKnowledge(params: {
  rawSourceReferences: unknown;
  candidateChunks: CandidateKnowledgeChunk[];
  relevantFacts: string[];
  applicableInstructions: string[];
}): string[] {
  if (
    params.relevantFacts.length === 0 &&
    params.applicableInstructions.length === 0
  ) {
    return [];
  }

  const candidateSourceIds = new Set(params.candidateChunks.map((chunk) => {
    return chunk.sourceId;
  }));

  return stringArray(params.rawSourceReferences).filter((sourceReference) => {
    return candidateSourceIds.has(sourceReference);
  });
}

function sanitizeFacts(values: unknown): string[] {
  return stringArray(values).filter((value) => {
    return !isNoRelevantKnowledgeText(value);
  });
}

function sanitizeRetrievedChunkCount(params: {
  rawCount: unknown;
  sourceReferences: string[];
  candidateChunks: CandidateKnowledgeChunk[];
}): number {
  const rawCount = typeof params.rawCount === "number" &&
    Number.isFinite(params.rawCount)
    ? Math.max(0, Math.floor(params.rawCount))
    : params.sourceReferences.length;

  return Math.min(
    rawCount,
    params.sourceReferences.length,
    params.candidateChunks.length
  );
}

function formatSynthesizeRetrievedKnowledgeOutput(
  input: FormatSynthesizeRetrievedKnowledgeOutputInput
): RetrievedKnowledgeSynthesis {
  if (input.rawSynthesizeRetrievedKnowledge.status !== "completed") {
    const reason =
      input.rawSynthesizeRetrievedKnowledge.error?.message ??
      "llm_call_failed";

    return safeFallback(input.input, input.candidateChunks, reason);
  }

  if (!isRecord(input.rawSynthesizeRetrievedKnowledge.parsedResponse)) {
    return safeFallback(
      input.input,
      input.candidateChunks,
      "invalid_or_missing_parsed_response"
    );
  }

  const raw = input.rawSynthesizeRetrievedKnowledge
    .parsedResponse as RawRetrievedKnowledgeSynthesis;
  const rawRelevantFacts = sanitizeFacts(raw.relevantFacts);
  const rawApplicableInstructions = sanitizeFacts(raw.applicableInstructions);
  const sourceReferences = sourceReferencesForUsableKnowledge({
    rawSourceReferences: raw.sourceReferences,
    candidateChunks: input.candidateChunks,
    relevantFacts: rawRelevantFacts,
    applicableInstructions: rawApplicableInstructions
  });
  const hasAcceptedSource = sourceReferences.length > 0;
  const relevantFacts = hasAcceptedSource ? rawRelevantFacts : [];
  const applicableInstructions = hasAcceptedSource
    ? rawApplicableInstructions
    : [];
  const retrievedChunkCount = sanitizeRetrievedChunkCount({
    rawCount: raw.retrievedChunkCount,
    sourceReferences,
    candidateChunks: input.candidateChunks
  });
  const possibleFields = hasAcceptedSource ? stringArray(raw.possibleFields) : [];
  const unresolvedPoints = hasAcceptedSource
    ? stringArray(raw.unresolvedPoints)
    : [];
  const limitations = unique([
    ...technicalLimitations(input.input),
    ...stringArray(raw.limitations),
    ...(retrievedChunkCount === 0
      ? ["No usable customer-facing knowledge found for this topic."]
      : [])
  ]);
  const topicId = getTopicId(input.input, input.candidateChunks);

  return {
    relevantFacts,
    applicableInstructions,
    possibleFields,
    unresolvedPoints,
    sourceReferences,
    limitations,
    doNotClaim: stringArray(raw.doNotClaim),
    internalNotes: stringArray(raw.internalNotes),
    retrievedChunkCount,
    topics: [
      {
        topicId,
        relevantFacts,
        applicableInstructions,
        possibleFields,
        unresolvedPoints,
        sourceReferences
      }
    ]
  };
}

export {
  formatSynthesizeRetrievedKnowledgeOutput,
  isNoRelevantKnowledgeText,
  safeFallback
};
