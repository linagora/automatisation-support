import type {
  SelectCatalogKnowledgeForTopicInput,
  SelectedCatalogKnowledgeForTopic
} from "../typesSupportProcessingPipelineV2.types";
import type {
  LLMMessage
} from "../../../llm/llm-client";

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
  selectedGenericKnowledgeIds?: unknown;
  scopeReason?: unknown;
  rejectedFieldNames?: unknown;
  warnings?: unknown;
};

export type {
  SelectCatalogKnowledgeForTopicInput,
  SelectedCatalogKnowledgeForTopic
};
