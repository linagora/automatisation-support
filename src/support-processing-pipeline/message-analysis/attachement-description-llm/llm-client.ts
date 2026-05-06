/**
 * LLM Client
 *
 * This file handles API calls to the LLM service.
 * It manages retries, error handling, and response parsing.
 * Supports multiple model presets for different use cases.
 * Supports vision capabilities (image analysis).
 * Supports token usage tracking when the API returns usage data.
 */

import { getModelConfig, createModelConfig, type LLMModelConfig } from "./llm-config";

/**
 * Content item for vision messages (text or image)
 */
interface MessageContentText {
  type: "text";
  text: string;
}

interface MessageContentImage {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "low" | "high" | "auto";
  };
}

type MessageContent = MessageContentText | MessageContentImage;

/**
 * LLM Message - can be simple string (text-only) or array of content items (vision)
 */
interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string | MessageContent[];
}

interface LLMRequestBody {
  model: string;
  messages: LLMMessage[];
  temperature?: number;
  max_tokens?: number;
}

/**
 * Token usage returned by OpenAI-compatible APIs.
 *
 * Not every provider returns this field.
 * Some providers may add extra fields, so we allow unknown additional keys.
 */
interface LLMUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;

  /**
   * Some APIs may return additional details:
   * - prompt_tokens_details
   * - completion_tokens_details
   * - input_tokens
   * - output_tokens
   * - etc.
   */
  [key: string]: unknown;
}

interface LLMResponseChoice {
  message: {
    role: string;
    content: string;
  };
  index: number;
  finish_reason: string;
}

interface LLMResponse {
  id?: string;
  model?: string;
  choices: LLMResponseChoice[];
  usage?: LLMUsage;
  error?: {
    message: string;
    type: string;
    code: string;
  };
}

interface LLMClientResult {
  success: boolean;
  content?: string;
  usage?: LLMUsage;
  model?: string;
  preset?: string;
  responseId?: string;
  error?: string;
}

interface CallLLMOptions {
  /** Model preset to use (default: "default") */
  preset?: string;
  /** Custom model configuration (overrides preset) */
  config?: Partial<LLMModelConfig>;
  /** Temperature for generation (default: 0.3) */
  temperature?: number;
  /** Maximum tokens to generate (default: 2000) */
  maxTokens?: number;
  /** If true, logs token usage in the terminal when available */
  logUsage?: boolean;
}

/**
 * Sleep for a given number of milliseconds
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after the delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

/**
 * Normalize API base URL to avoid double slashes.
 * Example:
 * https://ai.linagora.com/api/ -> https://ai.linagora.com/api
 */
function normalizeApiBaseUrl(apiBaseUrl: string): string {
  return apiBaseUrl.replace(/\/+$/, "");
}

/**
 * Decide if usage should be logged.
 *
 * You can enable it in two ways:
 * 1. Pass { logUsage: true } when calling callLLM / callVisionLLM
 * 2. Add LLM_LOG_USAGE=true in your .env
 */
function shouldLogUsage(options: CallLLMOptions): boolean {
  return options.logUsage === true || process.env.LLM_LOG_USAGE === "true";
}

/**
 * Format usage information for terminal logs.
 */
function formatUsage(usage: LLMUsage | undefined): string {
  if (!usage) {
    return "usage not provided by API";
  }

  const promptTokens = usage.prompt_tokens ?? "unknown";
  const completionTokens = usage.completion_tokens ?? "unknown";
  const totalTokens = usage.total_tokens ?? "unknown";

  return [
    `prompt_tokens=${promptTokens}`,
    `completion_tokens=${completionTokens}`,
    `total_tokens=${totalTokens}`
  ].join(", ");
}

/**
 * Log usage information if enabled.
 */
function logUsageIfEnabled(
  options: CallLLMOptions,
  preset: string,
  model: string,
  usage: LLMUsage | undefined
): void {
  if (!shouldLogUsage(options)) {
    return;
  }

  console.log(
    `[LLM usage] preset=${preset}, model=${model}, ${formatUsage(usage)}`
  );
}

/**
 * Make a single API call to the LLM service
 * @param config - The LLM configuration
 * @param messages - The messages to send
 * @param temperature - Temperature for generation
 * @param maxTokens - Maximum tokens to generate
 * @returns The LLM response or null if failed
 */
async function makeAPICall(
  config: LLMModelConfig,
  messages: LLMMessage[],
  temperature: number,
  maxTokens: number
): Promise<LLMResponse | null> {
  const requestBody: LLMRequestBody = {
    model: config.model,
    messages: messages,
    temperature: temperature,
    max_tokens: maxTokens
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(function () {
    controller.abort();
  }, config.timeoutMs);

  try {
    const apiBaseUrl = normalizeApiBaseUrl(config.apiBaseUrl);

    const response = await fetch(`${apiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json() as LLMResponse;
    return data;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new Error("Request timeout");
      }

      throw error;
    }

    throw new Error("Unknown error occurred");
  }
}

/**
 * Resolve configuration from options
 * @param options - Call options
 * @returns {LLMModelConfig} Resolved configuration
 */
function resolveConfig(options: CallLLMOptions): LLMModelConfig {
  if (options.config) {
    // If custom config is provided, merge with defaults
    return createModelConfig(options.config);
  }

  // Otherwise use preset
  return getModelConfig(options.preset || "default");
}

/**
 * Call the LLM API with retry logic
 * @param messages - The messages to send to the LLM (supports vision format)
 * @param options - Optional configuration options
 * @returns The result of the API call
 */
async function callLLM(
  messages: LLMMessage[],
  options: CallLLMOptions = {}
): Promise<LLMClientResult> {
  let config: LLMModelConfig;
  const preset = options.preset || "default";

  try {
    config = resolveConfig(options);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Configuration error";

    return {
      success: false,
      preset,
      error: `Configuration error: ${errorMessage}`
    };
  }

  const temperature = options.temperature ?? 0.3;
  const maxTokens = options.maxTokens ?? 2000;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await makeAPICall(config, messages, temperature, maxTokens);

      if (!response) {
        throw new Error("Empty response from API");
      }

      if (response.error) {
        throw new Error(`API error: ${response.error.message}`);
      }

      if (!response.choices || response.choices.length === 0) {
        throw new Error("No choices in API response");
      }

      const firstChoice = response.choices[0];

      if (!firstChoice.message || typeof firstChoice.message.content !== "string") {
        throw new Error("Invalid message content in API response");
      }

      const content = firstChoice.message.content;
      const model = response.model || config.model;

      logUsageIfEnabled(options, preset, model, response.usage);

      const result: LLMClientResult = {
        success: true,
        content,
        model,
        preset
      };

      if (response.usage) {
        result.usage = response.usage;
      }

      if (response.id) {
        result.responseId = response.id;
      }

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown error");

      if (attempt < config.maxRetries) {
        const delayMs = Math.pow(2, attempt) * 1000;
        await sleep(delayMs);
      }
    }
  }

  return {
    success: false,
    model: config.model,
    preset,
    error: `Failed after ${config.maxRetries} attempts: ${lastError?.message}`
  };
}

/**
 * Call LLM with the vision preset (optimized for image/video analysis)
 * @param messages - The messages to send (can include image URLs)
 * @param options - Optional overrides
 * @returns The result of the API call
 */
async function callVisionLLM(
  messages: LLMMessage[],
  options: Omit<CallLLMOptions, "preset"> = {}
): Promise<LLMClientResult> {
  return callLLM(messages, { ...options, preset: "vision" });
}

/**
 * Call LLM with the fast preset (optimized for quick responses)
 * @param messages - The messages to send
 * @param options - Optional overrides
 * @returns The result of the API call
 */
async function callFastLLM(
  messages: LLMMessage[],
  options: Omit<CallLLMOptions, "preset"> = {}
): Promise<LLMClientResult> {
  return callLLM(messages, { ...options, preset: "fast" });
}

/**
 * Call LLM with the premium preset (optimized for complex reasoning)
 * @param messages - The messages to send
 * @param options - Optional overrides
 * @returns The result of the API call
 */
async function callPremiumLLM(
  messages: LLMMessage[],
  options: Omit<CallLLMOptions, "preset"> = {}
): Promise<LLMClientResult> {
  return callLLM(messages, { ...options, preset: "premium" });
}

/**
 * Build a vision message with text and image URLs
 * @param text - The text prompt
 * @param imageUrls - Array of image URLs to analyze
 * @returns A user message compatible with vision models
 */
function buildVisionMessage(text: string, imageUrls: string[]): LLMMessage {
  const content: MessageContent[] = [
    { type: "text", text }
  ];

  for (const url of imageUrls) {
    content.push({
      type: "image_url",
      image_url: {
        url: url,
        detail: "auto"
      }
    });
  }

  return {
    role: "user",
    content
  };
}

/**
 * Parse the LLM response content into a structured object
 * @param content - The raw content from the LLM
 * @returns Parsed object or null if parsing failed
 */
function parseLLMResponse(content: string): Record<string, unknown> | null {
  try {
    const cleaned = content
      .replace(/^```json\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export {
  callLLM,
  callVisionLLM,
  callFastLLM,
  callPremiumLLM,
  buildVisionMessage,
  parseLLMResponse
};

export type {
  LLMMessage,
  LLMClientResult,
  CallLLMOptions,
  MessageContent,
  MessageContentText,
  MessageContentImage,
  LLMUsage
};