import type {
  SelectCatalogKnowledgeForTopicInput,
  SelectedCatalogKnowledgeForTopic
} from "../typesSupportProcessingPipelineV2.types";
import type {
  LLMMessage
} from "../../../infrastructure/llm/llm-client";
import type {
  KnownTopicField
} from "./buildCandidateFieldsForTopicSelector";

export type SelectCatalogKnowledgeForTopicPrompt = {
  messages: LLMMessage[];
};

export type RequestSelectCatalogKnowledgeForTopicInput = {
  prompt: SelectCatalogKnowledgeForTopicPrompt;
};

export type RawSelectCatalogKnowledgeForTopic = {
  status: "completed" | "failed";
  parsedResponse?: unknown;
  rawResponse?: string;
  error?: {
    message: string;
  };
};

export type FormatSelectCatalogKnowledgeForTopicOutputInput = {
  input: SelectCatalogKnowledgeForTopicInput;
  rawSelectCatalogKnowledgeForTopic: RawSelectCatalogKnowledgeForTopic;
};

export type RawSelectedCatalogKnowledgeForTopic = {
  selectedFieldNames?: unknown;
  directQuestionGuidance?: unknown;
  diagnosticFlow?: unknown;
  sufficientlyQualified?: unknown;
  reason?: unknown;
};

export type {
  KnownTopicField
};

export type {
  SelectCatalogKnowledgeForTopicInput,
  SelectedCatalogKnowledgeForTopic
};
