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
    ? value.replace(/\s+/g, " ").trim()
    : null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return unique(value.flatMap((item) => {
    return typeof item === "string" && item.trim() !== ""
      ? [item.replace(/\s+/g, " ").trim()]
      : [];
  }));
}

function splitLines(value: string | null): string[] {
  if (!value) {
    return [];
  }

  return unique(value
    .split(/\n+|(?:^|\s)[*-]\s+/u)
    .map((line) => line.replace(/^[-*•]\s*/u, "").trim())
    .filter(Boolean));
}

function joinLines(values: string[]): string | null {
  const cleaned = unique(values.map((value) => value.trim()));

  return cleaned.length > 0 ? cleaned.join("\n") : null;
}

function isNoRelevantKnowledgeText(value: string): boolean {
  return /\b(no relevant|no applicable|nothing relevant|no information|not enough information|aucune information|pas d'information|no usable customer-facing|no reliable customer-facing)\b/iu
    .test(value);
}

function isUnsafeCustomerFacingLine(value: string): boolean {
  return /\b(may|might|could|possibly|possible|probably|likely|hypothesis|hypothese|hypothèse|root cause|cause probable|caused by|due to|related to|migration|billing cycle|cycle de facturation|investigat|escalat|refund|remboursement|overcharge|surcharge|resolved|résolu|resolution|known issue|issue being fixed|will be|we will|team is|support team|SLA|timeline|deadline|backend|admin|database|logs?|billing console|infrastructure)\b/iu
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

function getTopicSnapshot(input: SynthesizeRetrievedKnowledgeInput): unknown {
  return input.topicSnapshot ?? input.topicEvidence.topicSnapshot ?? null;
}

function getExistingSupportKnowledgeSummary(
  input: SynthesizeRetrievedKnowledgeInput
): RetrievedKnowledgeSynthesis["supportKnowledgeSummary"] | null {
  const snapshot = getTopicSnapshot(input) as {
    supportKnowledgeSummary?: unknown;
  } | null;

  const value = snapshot?.supportKnowledgeSummary;

  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return normalizeSupportKnowledgeSummary({
      summary: compactString(value),
      customerFacing: null,
      supportFacing: null
    });
  }

  if (!isRecord(value)) {
    return null;
  }

  return normalizeSupportKnowledgeSummary({
    summary: compactString(value.summary),
    customerFacing: compactString(value.customerFacing),
    supportFacing: compactString(value.supportFacing)
  });
}

function technicalLimitations(
  input: SynthesizeRetrievedKnowledgeInput
): string[] {
  return input.knowledgeRetrievalFailureReason
    ? ["Knowledge retrieval failed or timed out for this topic."]
    : [];
}

function fallbackSummary(params: {
  input: SynthesizeRetrievedKnowledgeInput;
  candidateChunks: CandidateKnowledgeChunk[];
  supportFacing: string | null;
}): string {
  if (params.input.knowledgeRetrievalFailureReason) {
    return "Support knowledge lookup failed or timed out. No usable customer-facing knowledge was found.";
  }

  if (params.supportFacing) {
    return "Support knowledge lookup returned support-facing context but no verified customer-facing knowledge.";
  }

  if (params.candidateChunks.length > 0) {
    return "Support knowledge lookup returned content, but it did not provide reliable customer-facing knowledge for this topic.";
  }

  return "Support knowledge lookup returned no usable customer-facing knowledge for this topic.";
}

function mergeSupportFacing(...values: Array<string | null>): string | null {
  return joinLines(values.flatMap((value) => splitLines(value)));
}

function postProcessSupportKnowledgeSummary(params: {
  input: SynthesizeRetrievedKnowledgeInput;
  candidateChunks: CandidateKnowledgeChunk[];
  summary: string | null;
  customerFacing: string | null;
  supportFacing: string | null;
}): RetrievedKnowledgeSynthesis["supportKnowledgeSummary"] {
  const existing = getExistingSupportKnowledgeSummary(params.input);
  const customerFacingLines = splitLines(params.customerFacing).filter((line) => {
    return !isNoRelevantKnowledgeText(line);
  });
  const safeCustomerFacingLines: string[] = [];
  const movedToSupportFacing: string[] = [];

  for (const line of customerFacingLines) {
    if (isUnsafeCustomerFacingLine(line)) {
      movedToSupportFacing.push(`Rejected from customerFacing as unsafe or insufficiently verified: ${line}`);
    } else {
      safeCustomerFacingLines.push(line);
    }
  }

  const customerFacing = joinLines(safeCustomerFacingLines);
  const supportFacing = mergeSupportFacing(
    params.supportFacing,
    movedToSupportFacing.length > 0 ? movedToSupportFacing.join("\n") : null,
    existing?.supportFacing ?? null,
    params.input.knowledgeRetrievalFailureReason
      ? "Knowledge retrieval failed or timed out for this topic."
      : null
  );
  const compactSummary = compactString(params.summary);
  const summary = compactSummary && !isNoRelevantKnowledgeText(compactSummary)
    ? compactSummary
    : fallbackSummary({
        input: params.input,
        candidateChunks: params.candidateChunks,
        supportFacing
      });

  return normalizeSupportKnowledgeSummary({
    summary,
    customerFacing,
    supportFacing
  }) ?? {
    summary,
    customerFacing,
    supportFacing
  };
}

function supportKnowledgeSummaryForFallback(
  input: SynthesizeRetrievedKnowledgeInput,
  candidateChunks: CandidateKnowledgeChunk[]
): RetrievedKnowledgeSynthesis["supportKnowledgeSummary"] {
  const existing = getExistingSupportKnowledgeSummary(input);
  const supportFacing = mergeSupportFacing(
    existing?.supportFacing ?? null,
    input.knowledgeRetrievalFailureReason
      ? "Knowledge retrieval failed or timed out for this topic."
      : null
  );

  const summary = fallbackSummary({
    input,
    candidateChunks,
    supportFacing
  });

  return normalizeSupportKnowledgeSummary({
    summary,
    customerFacing: null,
    supportFacing
  }) ?? {
    summary,
    customerFacing: null,
    supportFacing
  };
}

function safeFallback(
  input: SynthesizeRetrievedKnowledgeInput,
  candidateChunks: CandidateKnowledgeChunk[],
  reason: string
): RetrievedKnowledgeSynthesis {
  const topicId = getTopicId(input, candidateChunks);
  const supportKnowledgeSummary = supportKnowledgeSummaryForFallback(
    input,
    candidateChunks
  );

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

function fromNewRawFormat(params: {
  input: SynthesizeRetrievedKnowledgeInput;
  candidateChunks: CandidateKnowledgeChunk[];
  raw: RawRetrievedKnowledgeSynthesis;
}): RetrievedKnowledgeSynthesis["supportKnowledgeSummary"] | null {
  if (
    params.raw.summary === undefined &&
    params.raw.customerFacing === undefined &&
    params.raw.supportFacing === undefined
  ) {
    return null;
  }

  return postProcessSupportKnowledgeSummary({
    input: params.input,
    candidateChunks: params.candidateChunks,
    summary: compactString(params.raw.summary),
    customerFacing: compactString(params.raw.customerFacing),
    supportFacing: compactString(params.raw.supportFacing)
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
  supportKnowledgeSummary: RetrievedKnowledgeSynthesis["supportKnowledgeSummary"];
}): number {
  if (
    !params.supportKnowledgeSummary.customerFacing &&
    !params.supportKnowledgeSummary.supportFacing
  ) {
    return 0;
  }

  const rawCount = typeof params.rawCount === "number" &&
    Number.isFinite(params.rawCount)
    ? Math.max(0, Math.floor(params.rawCount))
    : params.sourceReferences.length || params.candidateChunks.length;

  return Math.min(rawCount, params.candidateChunks.length);
}

function legacySupportKnowledgeSummary(params: {
  input: SynthesizeRetrievedKnowledgeInput;
  candidateChunks: CandidateKnowledgeChunk[];
  raw: RawRetrievedKnowledgeSynthesis;
  relevantFacts: string[];
  applicableInstructions: string[];
  possibleFields: string[];
  unresolvedPoints: string[];
}): RetrievedKnowledgeSynthesis["supportKnowledgeSummary"] {
  const legacyCustomerFacing = unique([
    ...params.relevantFacts,
    ...params.applicableInstructions,
    ...params.possibleFields.map((field) => `Customer-answerable field: ${field}`),
    ...params.unresolvedPoints
  ]).join("\n") || null;
  const legacySupportFacing = unique([
    ...stringArray(params.raw.internalNotes),
    ...stringArray(params.raw.doNotClaim),
    ...stringArray(params.raw.limitations)
  ]).join("\n") || null;

  return postProcessSupportKnowledgeSummary({
    input: params.input,
    candidateChunks: params.candidateChunks,
    summary: null,
    customerFacing: legacyCustomerFacing,
    supportFacing: legacySupportFacing
  });
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
  const possibleFields = hasAcceptedSource ? stringArray(raw.possibleFields) : [];
  const unresolvedPoints = hasAcceptedSource
    ? stringArray(raw.unresolvedPoints)
    : [];
  const supportKnowledgeSummary = fromNewRawFormat({
    input: input.input,
    candidateChunks: input.candidateChunks,
    raw
  }) ?? legacySupportKnowledgeSummary({
    input: input.input,
    candidateChunks: input.candidateChunks,
    raw,
    relevantFacts,
    applicableInstructions,
    possibleFields,
    unresolvedPoints
  });
  const retrievedChunkCount = sanitizeRetrievedChunkCount({
    rawCount: raw.retrievedChunkCount,
    sourceReferences,
    candidateChunks: input.candidateChunks,
    supportKnowledgeSummary
  });
  const limitations = unique([
    ...technicalLimitations(input.input),
    ...stringArray(raw.limitations),
    ...(!supportKnowledgeSummary.customerFacing
      ? ["No usable customer-facing knowledge found for this topic."]
      : [])
  ]);
  const topicId = getTopicId(input.input, input.candidateChunks);

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