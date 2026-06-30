import type {
  KnowledgeChunk,
  RetrievedKnowledgeSynthesis,
  SynthesizeRetrievedKnowledgeInput
} from "../typesSupportProcessingPipelineV2.types";
import type {
  LLMMessage
} from "../../llm/llm-client";

export type CandidateKnowledgeChunk = {
  topicId: string | number | null;
  sourceId: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
};

export type SynthesizeRetrievedKnowledgePrompt = {
  messages: LLMMessage[];
};

export type BuildSynthesizeRetrievedKnowledgePromptInput = {
  input: SynthesizeRetrievedKnowledgeInput;
  candidateChunks: CandidateKnowledgeChunk[];
};

export type RequestSynthesizeRetrievedKnowledgeInput = {
  prompt: SynthesizeRetrievedKnowledgePrompt;
};

export type RawRetrievedKnowledgeSynthesis = {
  relevantFacts?: unknown;
  applicableInstructions?: unknown;
  possibleFields?: unknown;
  unresolvedPoints?: unknown;
  sourceReferences?: unknown;
  limitations?: unknown;
  doNotClaim?: unknown;
  internalNotes?: unknown;
  retrievedChunkCount?: unknown;
};

export type RawSynthesizeRetrievedKnowledge = {
  status: "completed" | "failed";
  parsedResponse?: unknown;
  rawResponse?: string;
  error?: {
    message: string;
  };
};

export type FormatSynthesizeRetrievedKnowledgeOutputInput = {
  input: SynthesizeRetrievedKnowledgeInput;
  candidateChunks: CandidateKnowledgeChunk[];
  rawSynthesizeRetrievedKnowledge: RawSynthesizeRetrievedKnowledge;
};

export type SynthesizeRetrievedKnowledgeRequester = (
  input: RequestSynthesizeRetrievedKnowledgeInput
) => Promise<RawSynthesizeRetrievedKnowledge>;

export type {
  KnowledgeChunk,
  RetrievedKnowledgeSynthesis,
  SynthesizeRetrievedKnowledgeInput
};
