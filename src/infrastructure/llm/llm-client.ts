/**
 * LLM Client
 *
 * Handles API calls to the LLM service:
 * - resolves model configuration
 * - estimates token usage before sending
 * - blocks the call if token estimation is missing or invalid
 * - checks the preset token budget
 * - manages retries
 * - normalizes the API response
 */

import {
  getModelConfig,
  createModelConfig
} from "./llm-config";

import {
  estimateLLMTokenUsage
} from "./llm-token-estimator";

import type {
  CallLLMOptions,
  LLMClientResult,
  LLMMessage,
  LLMModelConfig,
  LLMRequestBody,
  LLMResponse,
  LLMTokenEstimate,
  LLMUsage
} from "./types.llm-types";

function sleep(ms: number): Promise<void> {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

function normalizeApiBaseUrl(apiBaseUrl: string): string {
  return apiBaseUrl.replace(/\/+$/, "");
}

function shouldLogUsage(options: CallLLMOptions): boolean {
  return options.logUsage === true || process.env.LLM_LOG_USAGE === "true";
}

function shouldLogEstimates(options: CallLLMOptions): boolean {
  return options.logEstimates === true ||
    process.env.LLM_LOG_ESTIMATES === "true";
}

function formatStage(options: CallLLMOptions): string {
  return typeof options.stage === "string" && options.stage.trim() !== ""
    ? `stage=${options.stage.trim()} `
    : "";
}

function formatUsage(usage: LLMUsage | undefined): string {
  if (!usage) {
    return "usage not provided by API";
  }

  return [
    `prompt_tokens=${usage.prompt_tokens ?? "unknown"}`,
    `completion_tokens=${usage.completion_tokens ?? "unknown"}`,
    `total_tokens=${usage.total_tokens ?? "unknown"}`
  ].join(", ");
}

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
    `[LLM usage] ${formatStage(options)}preset=${preset} ` +
    `model=${model} ${formatUsage(usage)}`
  );
}

function logEstimateIfEnabled(
  options: CallLLMOptions,
  preset: string,
  model: string,
  estimate: LLMTokenEstimate
): void {
  if (!shouldLogEstimates(options)) {
    return;
  }

  console.log(
    `[LLM estimate] ${formatStage(options)}preset=${preset} model=${model} ` +
    `text_tokens≈${estimate.textTokens}, ` +
    `image_tokens≈${estimate.imageTokens}, ` +
    `output_tokens=${estimate.outputTokens}, ` +
    `total_tokens≈${estimate.totalTokens}`
  );
}

function assertValidTokenEstimate(
  estimate: LLMTokenEstimate | undefined
): asserts estimate is LLMTokenEstimate {
  if (!estimate) {
    throw new Error("missing_token_estimate");
  }

  const values = [
    estimate.textTokens,
    estimate.imageTokens,
    estimate.outputTokens,
    estimate.totalTokens
  ];

  const hasInvalidValue = values.some(function (value) {
    return (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < 0
    );
  });

  if (hasInvalidValue) {
    throw new Error("invalid_token_estimate");
  }
}

function assertTokenBudget(
  estimate: LLMTokenEstimate,
  config: LLMModelConfig,
  options: CallLLMOptions
): void {
  const maxEstimatedTotalTokens =
    options.maxEstimatedTotalTokens ??
    config.maxEstimatedTotalTokens;

  if (estimate.totalTokens <= maxEstimatedTotalTokens) {
    return;
  }

  throw new Error(
    [
      "estimated_total_tokens_exceeded",
      `${estimate.totalTokens}/${maxEstimatedTotalTokens}`,
      `text=${estimate.textTokens}`,
      `images=${estimate.imageTokens}`,
      `output=${estimate.outputTokens}`
    ].join(":")
  );
}

function isNonRetryableLLMError(error: Error): boolean {
  return (
    error.message.startsWith("API returned 400:") ||
    error.message.startsWith("API returned 401:") ||
    error.message.startsWith("API returned 403:") ||
    error.message.startsWith("API returned 404:") ||
    error.message.includes("maximum context length")
  );
}

function resolveConfig(options: CallLLMOptions): LLMModelConfig {
  if (options.config) {
    return createModelConfig(options.config);
  }

  return getModelConfig(options.preset || "default");
}

async function makeAPICall(
  config: LLMModelConfig,
  messages: LLMMessage[],
  temperature: number,
  maxTokens: number,
  responseFormat?: CallLLMOptions["responseFormat"]
): Promise<LLMResponse> {
  const requestBody: LLMRequestBody = {
    model: config.model,
    messages,
    temperature,
    max_tokens: maxTokens,
    ...(responseFormat ? { response_format: responseFormat } : {})
  };

  const controller = new AbortController();

  const timeoutId = setTimeout(function () {
    controller.abort();
  }, config.timeoutMs);

  try {
    const response = await fetch(
      `${normalizeApiBaseUrl(config.apiBaseUrl)}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(`API returned ${response.status}: ${errorText}`);
    }

    return await response.json() as LLMResponse;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timeout");
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Unknown error occurred");
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractContentFromResponse(response: LLMResponse): string {
  if (response.error) {
    throw new Error(`API error: ${response.error.message}`);
  }

  const firstChoice = response.choices?.[0];

  if (!firstChoice) {
    throw new Error("No choices in API response");
  }

  const content = firstChoice.message?.content;

  if (typeof content !== "string") {
    throw new Error("Invalid message content in API response");
  }

  return content;
}

function buildSuccessResult(
  response: LLMResponse,
  content: string,
  config: LLMModelConfig,
  preset: string,
  tokenEstimate: LLMTokenEstimate
): LLMClientResult {
  const result: LLMClientResult = {
    success: true,
    content,
    model: response.model || config.model,
    preset,
    tokenEstimate
  };

  if (response.usage) {
    result.usage = response.usage;
  }

  if (response.id) {
    result.responseId = response.id;
  }

  return result;
}

async function callLLM(
  messages: LLMMessage[],
  options: CallLLMOptions = {}
): Promise<LLMClientResult> {
  const preset = options.preset || "default";

  let config: LLMModelConfig;

  try {
    config = resolveConfig(options);
  } catch (error) {
    return {
      success: false,
      preset,
      error:
        error instanceof Error
          ? `Configuration error: ${error.message}`
          : "Configuration error"
    };
  }

  const temperature = options.temperature ?? 0.3;
  const maxTokens = options.maxTokens ?? 2000;

  let tokenEstimate: LLMTokenEstimate;

  try {
    const estimatedUsage = estimateLLMTokenUsage(
      messages,
      maxTokens
    );

    assertValidTokenEstimate(estimatedUsage);

    tokenEstimate = estimatedUsage;

    assertTokenBudget(
      tokenEstimate,
      config,
      options
    );

    logEstimateIfEnabled(
      options,
      preset,
      config.model,
      tokenEstimate
    );
  } catch (error) {
    return {
      success: false,
      model: config.model,
      preset,
      error:
        error instanceof Error
          ? error.message
          : "llm_token_estimation_failed"
    };
  }

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await makeAPICall(
        config,
        messages,
        temperature,
        maxTokens,
        options.responseFormat
);
      const content = extractContentFromResponse(response);

      const result = buildSuccessResult(
        response,
        content,
        config,
        preset,
        tokenEstimate
      );

      logUsageIfEnabled(
        options,
        preset,
        result.model || config.model,
        response.usage
      );

      return result;
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error("Unknown error");

      if (isNonRetryableLLMError(lastError)) {
        return {
          success: false,
          model: config.model,
          preset,
          error: lastError.message,
          tokenEstimate
        };
      }

      if (attempt < config.maxRetries) {
        await sleep(Math.pow(2, attempt) * 1000);
      }
    }
  }

  return {
    success: false,
    model: config.model,
    preset,
    error: `Failed after ${config.maxRetries} attempts: ${lastError?.message}`,
    tokenEstimate
  };
}

export {
  callLLM
};

export type {
  CallLLMOptions,
  LLMClientResult,
  LLMMessage,
  LLMUsage,
  MessageContent,
  MessageContentImage,
  MessageContentText
} from "./types.llm-types";
