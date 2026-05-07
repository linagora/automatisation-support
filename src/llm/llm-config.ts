/**
 * LLM Configuration
 *
 * This file manages configurations for multiple LLM providers and models.
 * It supports different model presets for different use cases with flexible
 * environment variable naming.
 */

type LLMProvider = "openai" | "mistral" | "anthropic" | "custom";

interface LLMModelConfig {
  provider: LLMProvider;
  model: string;
  apiBaseUrl: string;
  apiKey: string;
  maxRetries: number;
  timeoutMs: number;
}

interface LLMModelDefinition {
  name: string;
  envPrefix: string;
  defaultModel?: string;
  defaultProvider?: LLMProvider;
}

/**
 * Predefined model configurations for different use cases
 */
const MODEL_DEFINITIONS: Record<string, LLMModelDefinition> = {
  // Image analysis - optimized for analyzing screenshots and images
  imageAnalysis: {
    name: "imageAnalysis",
    envPrefix: "LLM_IMAGE",
    defaultModel: "mistralai/mistral-small-3.2-24b-instruct",
    defaultProvider: "mistral"
  },
  // Video analysis - optimized for analyzing video content
  videoAnalysis: {
    name: "videoAnalysis",
    envPrefix: "LLM_VIDEO",
    defaultModel: "mistralai/mistral-small-3.2-24b-instruct",
    defaultProvider: "mistral"
  },
  // Quick decision - for fast, simple decisions
  quickDecision: {
    name: "quickDecision",
    envPrefix: "LLM_QUICK",
    defaultModel: "mistralai/mistral-small-3.2-24b-instruct",
    defaultProvider: "mistral"
  },
  // Full analysis - for complex reasoning and full analysis
  fullAnalysis: {
    name: "fullAnalysis",
    envPrefix: "LLM_FULL",
    defaultModel: "gpt-4",
    defaultProvider: "openai"
  },
  // RAG search - for retrieval-augmented generation
  ragSearch: {
    name: "ragSearch",
    envPrefix: "LLM_RAG",
    defaultModel: "mistralai/mistral-small-3.2-24b-instruct",
    defaultProvider: "mistral"
  },
  // Default fallback - general purpose
  default: {
    name: "default",
    envPrefix: "LLM",
    defaultModel: "mistralai/mistral-small-3.2-24b-instruct",
    defaultProvider: "mistral"
  }
};

/**
 * Get environment variable with multiple fallback options
 * @param names - Array of environment variable names to try
 * @param defaultValue - Default value if none found
 * @returns The value or default
 */
function getEnvWithFallback(names: string[], defaultValue?: string): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (value) {
      return value;
    }
  }
  return defaultValue;
}

/**
 * Build configuration for a specific model preset
 * @param presetName - Name of the preset
 * @returns {LLMModelConfig} The complete configuration for this preset
 * @throws {Error} If required environment variables are not set
 */
function getModelConfig(presetName: string = "default"): LLMModelConfig {
  const definition = MODEL_DEFINITIONS[presetName];

  if (!definition) {
    throw new Error(`Unknown model preset: ${presetName}. Available: ${Object.keys(MODEL_DEFINITIONS).join(", ")}`);
  }

  const prefix = definition.envPrefix;

  // Try preset-specific variables first, then fall back to generic ones
  const apiBaseUrl = getEnvWithFallback([
    `${prefix}_API_HOST`,
    `${prefix}_API_BASE_URL`,
    "LLM_API_HOST",
    "OPENAI_API_HOST"
  ]);

  const apiKey = getEnvWithFallback([
    `${prefix}_API_KEY`,
    "LLM_API_KEY",
    "OPENAI_API_KEY"
  ]);

  const model = getEnvWithFallback([
    `${prefix}_MODEL`,
    "LLM_MODEL"
  ], definition.defaultModel);

  const provider = (getEnvWithFallback([
    `${prefix}_PROVIDER`,
    "LLM_PROVIDER"
  ]) as LLMProvider) || definition.defaultProvider;

  if (!apiBaseUrl) {
    throw new Error(
      `API host not configured for preset "${presetName}". ` +
      `Set ${prefix}_API_HOST or LLM_API_HOST environment variable.`
    );
  }

  if (!apiKey) {
    throw new Error(
      `API key not configured for preset "${presetName}". ` +
      `Set ${prefix}_API_KEY or LLM_API_KEY environment variable.`
    );
  }

  return {
    provider: provider || "custom",
    model: model || "unknown",
    apiBaseUrl,
    apiKey,
    maxRetries: 3,
    timeoutMs: 60000
  };
}

/**
 * Create a custom model configuration on the fly
 * Useful when you need a specific configuration not covered by presets
 * @param config - Partial configuration to override
 * @returns {LLMModelConfig} Complete configuration
 */
function createModelConfig(config: Partial<LLMModelConfig>): LLMModelConfig {
  return {
    provider: config.provider || "custom",
    model: config.model || "unknown",
    apiBaseUrl: config.apiBaseUrl || "",
    apiKey: config.apiKey || "",
    maxRetries: config.maxRetries || 3,
    timeoutMs: config.timeoutMs || 60000
  };
}

/**
 * Get list of available model presets
 * @returns Array of preset names
 */
function getAvailablePresets(): string[] {
  return Object.keys(MODEL_DEFINITIONS);
}

export {
  getModelConfig,
  createModelConfig,
  getAvailablePresets,
  MODEL_DEFINITIONS
};

export type {
  LLMModelConfig,
  LLMModelDefinition,
  LLMProvider
};
