/**
 * Shared LLM types.
 */

import type {
  LLMModelConfig
} from "./llm-config";

export interface MessageContentText {
  type: "text";
  text: string;
}

export interface MessageContentImage {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "low" | "high" | "auto";
  };
}

export type MessageContent =
  | MessageContentText
  | MessageContentImage;

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string | MessageContent[];
}

export interface LLMRequestBody {
  model: string;
  messages: LLMMessage[];
  temperature?: number;
  max_tokens?: number;
}

export interface LLMUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  [key: string]: unknown;
}

export interface LLMResponseChoice {
  message: {
    role: string;
    content: string;
  };
  index: number;
  finish_reason: string;
}

export interface LLMResponse {
  id?: string;
  model?: string;
  choices: LLMResponseChoice[];
  usage?: LLMUsage;
  error?: {
    message: string;
    type?: string;
    code?: string;
  };
}

export interface LLMClientResult {
  success: boolean;
  content?: string;
  usage?: LLMUsage;
  model?: string;
  preset?: string;
  responseId?: string;
  error?: string;
}

export interface CallLLMOptions {
  preset?: string;
  config?: Partial<LLMModelConfig>;
  temperature?: number;
  maxTokens?: number;
  logUsage?: boolean;

  /**
   * Optional one-shot override.
   * Normal token budgets should come from llm-config presets.
   */
  maxEstimatedTotalTokens?: number;
}

/**
 * Shared LLM types.
 */

export type LLMProvider =
  | "openai"
  | "mistral"
  | "anthropic"
  | "custom";

export interface LLMModelConfig {
  provider: LLMProvider;
  model: string;
  apiBaseUrl: string;
  apiKey: string;
  maxRetries: number;
  timeoutMs: number;
  maxEstimatedTotalTokens: number;
}

export interface LLMModelDefinition {
  envPrefix: string;
  defaultModel?: string;
  defaultProvider?: LLMProvider;
  defaultMaxEstimatedTotalTokens: number;
}

export interface MessageContentText {
  type: "text";
  text: string;
}

export interface MessageContentImage {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "low" | "high" | "auto";
  };
}

export type MessageContent =
  | MessageContentText
  | MessageContentImage;

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string | MessageContent[];
}

export interface LLMRequestBody {
  model: string;
  messages: LLMMessage[];
  temperature?: number;
  max_tokens?: number;
}

export interface LLMUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  [key: string]: unknown;
}

export interface LLMResponseChoice {
  message: {
    role: string;
    content: string;
  };
  index: number;
  finish_reason: string;
}

export interface LLMResponse {
  id?: string;
  model?: string;
  choices: LLMResponseChoice[];
  usage?: LLMUsage;
  error?: {
    message: string;
    type?: string;
    code?: string;
  };
}

export interface LLMClientResult {
  success: boolean;
  content?: string;
  usage?: LLMUsage;
  tokenEstimate?: LLMTokenEstimate;
  model?: string;
  preset?: string;
  responseId?: string;
  error?: string;
}
export interface CallLLMOptions {
  preset?: string;
  config?: Partial<LLMModelConfig>;
  temperature?: number;
  maxTokens?: number;
  logUsage?: boolean;

  /**
   * Optional one-shot override.
   * Normal token budgets should come from llm-config presets.
   */
  maxEstimatedTotalTokens?: number;
}

export interface LLMTokenEstimate {
  textTokens: number;
  imageTokens: number;
  outputTokens: number;
  totalTokens: number;
}