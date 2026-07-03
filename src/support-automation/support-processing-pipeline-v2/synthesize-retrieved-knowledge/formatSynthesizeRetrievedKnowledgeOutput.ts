import type {
  CandidateKnowledgeChunk,
  FormatSynthesizeRetrievedKnowledgeOutputInput,
  RawRetrievedKnowledgeSynthesis,
  RetrievedKnowledgeSynthesis,
  SynthesizeRetrievedKnowledgeInput
} from "./typesSynthesizeRetrievedKnowledge.types";
import {
  normalizeSupportKnowledgeSummary
} from "../supportKnowledgeSummary";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim() !== ""))];
}

function compactString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : null;
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

function parseNumericTopicId(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 1) {
    return value;
  }

  return null;
}

function getTopicId(
  input: SynthesizeRetrievedKnowledgeInput,
  candidateChunks: CandidateKnowledgeChunk[]
): number | null {
  return parseNumericTopicId(candidateChunks[0]?.topicId) ??
    parseNumericTopicId(input.knowledgeEnrichmentPlan.retrievalRequests[0]?.topicId) ??
    parseNumericTopicId(input.topicEvidence.topicId);
}

function technicalLimitations(
  input: SynthesizeRetrievedKnowledgeInput
): string[] {
  return input.knowledgeRetrievalFailureReason
    ? ["Knowledge retrieval failed or timed out for this topic."]
    : [];
}

function supportKnowledgeSummaryForFallback(
  input: SynthesizeRetrievedKnowledgeInput
): RetrievedKnowledgeSynthesis["supportKnowledgeSummary"] {
  return input.knowledgeRetrievalFailureReason
    ? {
        summary: "Support knowledge lookup failed or timed out. No usable customer-facing knowledge was found.",
        customerFacing: null,
        supportFacing: "Knowledge retrieval failed or timed out for this topic."
      }
    : {
        summary: "Support knowledge lookup returned no usable customer-facing knowledge for this topic.",
        customerFacing: null,
        supportFacing: null
      };
}

function supportKnowledgeSummaryForSynthesis(params: {
  input: SynthesizeRetrievedKnowledgeInput;
  candidateChunks: CandidateKnowledgeChunk[];
  retrievedChunkCount: number;
  customerFacing: string | null;
  supportFacing: string | null;
}): RetrievedKnowledgeSynthesis["supportKnowledgeSummary"] {
  if (params.input.knowledgeRetrievalFailureReason) {
    return {
      summary: "Support knowledge lookup failed or timed out. No usable customer-facing knowledge was found.",
      customerFacing: null,
      supportFacing: "Knowledge retrieval failed or timed out for this topic."
    };
  }

  if (params.customerFacing) {
    return {
      summary: "Support knowledge lookup returned useful customer-facing knowledge for this topic.",
      customerFacing: params.customerFacing,
      supportFacing: params.supportFacing
    };
  }

  if (params.supportFacing) {
    return {
      summary: "Support knowledge lookup returned support-facing context but no verified customer-facing knowledge.",
      customerFacing: null,
      supportFacing: params.supportFacing
    };
  }

  if (params.candidateChunks.length > 0) {
    return {
      summary: "Support knowledge lookup returned content, but it was not useful for this topic because it was off-topic, internal-only, or not customer-facing.",
      customerFacing: null,
      supportFacing: null
    };
  }

  return {
    summary: "Support knowledge lookup returned no usable customer-facing knowledge for this topic.",
    customerFacing: null,
    supportFacing: null
  };
}

function safeFallback(
  input: SynthesizeRetrievedKnowledgeInput,
  candidateChunks: CandidateKnowledgeChunk[],
  reason: string
): RetrievedKnowledgeSynthesis {
  const topicId = getTopicId(input, candidateChunks);

  const supportKnowledgeSummary = supportKnowledgeSummaryForFallback(input);

  return {
    supportKnowledgeSummary,
    summary: supportKnowledgeSummary.summary,
    customerFacing: supportKnowledgeSummary.customerFacing,
    supportFacing: supportKnowledgeSummary.supportFacing,
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

function fromNewRawFormat(
  raw: RawRetrievedKnowledgeSynthesis
): RetrievedKnowledgeSynthesis["supportKnowledgeSummary"] | null {
  if (
    raw.summary === undefined &&
    raw.customerFacing === undefined &&
    raw.supportFacing === undefined
  ) {
    return null;
  }

  return normalizeSupportKnowledgeSummary({
    summary: compactString(raw.summary),
    customerFacing: compactString(raw.customerFacing),
    supportFacing: compactString(raw.supportFacing)
  });
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
  const newFormatSummary = fromNewRawFormat(raw);
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
  const legacyCustomerFacing = unique([
    ...relevantFacts,
    ...applicableInstructions,
    ...possibleFields.map((field) => `Customer-answerable field: ${field}`),
    ...unresolvedPoints
  ]).join("\n") || null;
  const legacySupportFacing = unique([
    ...stringArray(raw.internalNotes),
    ...stringArray(raw.doNotClaim),
    ...stringArray(raw.limitations)
  ]).join("\n") || null;
  const limitations = unique([
    ...technicalLimitations(input.input),
    ...stringArray(raw.limitations),
    ...(retrievedChunkCount === 0
      ? ["No usable customer-facing knowledge found for this topic."]
      : [])
  ]);
  const topicId = getTopicId(input.input, input.candidateChunks);
  const supportKnowledgeSummary = newFormatSummary ??
    supportKnowledgeSummaryForSynthesis({
      input: input.input,
      candidateChunks: input.candidateChunks,
      retrievedChunkCount,
      customerFacing: legacyCustomerFacing,
      supportFacing: legacySupportFacing
    });

  return {
    supportKnowledgeSummary,
    summary: supportKnowledgeSummary.summary,
    customerFacing: supportKnowledgeSummary.customerFacing,
    supportFacing: supportKnowledgeSummary.supportFacing,
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
