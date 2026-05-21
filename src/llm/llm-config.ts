/**
 * LLM Configuration
 *
 * Defines model presets and resolves environment-based configuration.
 */

import type {
  LLMModelConfig,
  LLMModelDefinition,
  LLMProvider
} from "./types.llm-types";

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_TIMEOUT_MS = 60000;
const DEFAULT_TOKEN_BUDGET = 5000;

const MODEL_DEFINITIONS: Record<string, LLMModelDefinition> = {
  imageAnalysis: {
    envPrefix: "LLM_IMAGE",
    defaultModel: "mistralai/mistral-small-3.2-24b-instruct",
    defaultProvider: "mistral",
    defaultMaxEstimatedTotalTokens: 5000
  },

  videoAnalysis: {
    envPrefix: "LLM_VIDEO",
    defaultModel: "mistralai/mistral-small-3.2-24b-instruct",
    defaultProvider: "mistral",
    defaultMaxEstimatedTotalTokens: 30000
  },

  quickDecision: {
    envPrefix: "LLM_QUICK",
    defaultModel: "mistralai/mistral-small-3.2-24b-instruct",
    defaultProvider: "mistral",
    defaultMaxEstimatedTotalTokens: 5000
  },

  fullWeightMessageAnalysis: {
    envPrefix: "LLM_FULL",
    defaultModel: "gpt-4",
    defaultProvider: "openai",
    defaultMaxEstimatedTotalTokens: 15000
  },

  ragSearch: {
    envPrefix: "LLM_RAG",
    defaultModel: "mistralai/mistral-small-3.2-24b-instruct",
    defaultProvider: "mistral",
    defaultMaxEstimatedTotalTokens: 5000
  },

  default: {
    envPrefix: "LLM",
    defaultModel: "mistralai/mistral-small-3.2-24b-instruct",
    defaultProvider: "mistral",
    defaultMaxEstimatedTotalTokens: 5000
  }
};

function getEnvWithFallback(
  names: string[],
  defaultValue?: string
): string | undefined {
  for (const name of names) {
    const value = process.env[name];

    if (value) {
      return value;
    }
  }

  return defaultValue;
}

function getNumberEnvWithFallback(
  names: string[],
  defaultValue: number
): number {
  const value = getEnvWithFallback(names);
  const parsedValue = value ? Number(value) : NaN;

  return Number.isFinite(parsedValue) && parsedValue > 0
    ? parsedValue
    : defaultValue;
}

function getRequiredEnv(
  value: string | undefined,
  errorMessage: string
): string {
  if (!value) {
    throw new Error(errorMessage);
  }

  return value;
}

function getModelConfig(
  presetName: string = "default"
): LLMModelConfig {
  const definition = MODEL_DEFINITIONS[presetName];

  if (!definition) {
    throw new Error(
      `Unknown model preset: ${presetName}. Available: ${getAvailablePresets().join(", ")}`
    );
  }

  const prefix = definition.envPrefix;

  const apiBaseUrl = getRequiredEnv(
    getEnvWithFallback([
      `${prefix}_API_HOST`,
      `${prefix}_API_BASE_URL`,
      "LLM_API_HOST",
      "OPENAI_API_HOST"
    ]),
    `API host not configured for preset "${presetName}". Set ${prefix}_API_HOST or LLM_API_HOST.`
  );

  const apiKey = getRequiredEnv(
    getEnvWithFallback([
      `${prefix}_API_KEY`,
      "LLM_API_KEY",
      "OPENAI_API_KEY"
    ]),
    `API key not configured for preset "${presetName}". Set ${prefix}_API_KEY or LLM_API_KEY.`
  );

  const model = getEnvWithFallback([
    `${prefix}_MODEL`,
    "LLM_MODEL"
  ], definition.defaultModel);

  const provider = getEnvWithFallback([
    `${prefix}_PROVIDER`,
    "LLM_PROVIDER"
  ], definition.defaultProvider) as LLMProvider | undefined;

  const maxEstimatedTotalTokens = getNumberEnvWithFallback([
    `${prefix}_MAX_ESTIMATED_TOTAL_TOKENS`,
    "LLM_MAX_ESTIMATED_TOTAL_TOKENS"
  ], definition.defaultMaxEstimatedTotalTokens);

  return {
    provider: provider ?? "custom",
    model: model ?? "unknown",
    apiBaseUrl,
    apiKey,
    maxRetries: DEFAULT_MAX_RETRIES,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    maxEstimatedTotalTokens
  };
}

function createModelConfig(
  config: Partial<LLMModelConfig>
): LLMModelConfig {
  return {
    provider: config.provider ?? "custom",
    model: config.model ?? "unknown",
    apiBaseUrl: config.apiBaseUrl ?? "",
    apiKey: config.apiKey ?? "",
    maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
    timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxEstimatedTotalTokens:
      config.maxEstimatedTotalTokens ?? DEFAULT_TOKEN_BUDGET
  };
}

function getAvailablePresets(): string[] {
  return Object.keys(MODEL_DEFINITIONS);
}

export {
  getModelConfig,
  createModelConfig,
  getAvailablePresets,
  MODEL_DEFINITIONS
};