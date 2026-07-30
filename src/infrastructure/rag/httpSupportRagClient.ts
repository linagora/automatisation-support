import type {
  SupportRagCallInput,
  SupportRagCallOutput,
  SupportRagClient
} from "./supportRagClient";

type HttpSupportRagClientOptions = {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs?: number;
};

type OpenRagExtra = {
  sources?: unknown[];
};

type OpenRagRequestPayload = {
  model: string;
  messages: SupportRagCallInput["messages"];
  temperature: number;
  max_tokens: number;
  stream: false;
  metadata: Record<string, unknown>;
};

function parseOpenRagExtra(value: unknown): OpenRagExtra {
  if (!value) {
    return {};
  }

  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);

      return typeof parsed === "object" && parsed !== null
        ? parsed as OpenRagExtra
        : {};
    } catch {
      return {};
    }
  }

  return typeof value === "object" && value !== null
    ? value as OpenRagExtra
    : {};
}

function getOpenRagContent(payload: unknown): string {
  const data = payload as {
    choices?: Array<{
      message?: {
        content?: unknown;
      };
    }>;
  };
  const content = data.choices?.[0]?.message?.content;

  return typeof content === "string" ? content : "";
}

function getOpenRagSources(payload: unknown): unknown[] {
  const data = payload as {
    extra?: unknown;
  };
  const extra = parseOpenRagExtra(data.extra);

  return Array.isArray(extra.sources) ? extra.sources : [];
}

class HttpSupportRagClient implements SupportRagClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(options: HttpSupportRagClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.timeoutMs = options.timeoutMs ?? 60_000;
  }

  async call(input: SupportRagCallInput): Promise<SupportRagCallOutput> {
    const payload = await this.callRaw(input);

    return {
      content: getOpenRagContent(payload).trim(),
      sources: getOpenRagSources(payload),
      rawPayload: payload
    };
  }

  private async callRaw(input: SupportRagCallInput): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    const url = `${this.baseUrl}/v1/chat/completions`;
    const requestPayload = this.buildRequestPayload(input);

    console.info("[support-rag] request", {
      url,
      model: this.model,
      messageCount: requestPayload.messages.length,
      timeoutMs: this.timeoutMs,
      payloadPreview: safeJsonPreview(redactSecrets(requestPayload), 1000)
    });

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestPayload),
        signal: controller.signal
      });

      const responseText = await response.text();

      if (!response.ok) {
        console.error("[support-rag] response_error", {
          url,
          status: response.status,
          statusText: response.statusText,
          bodyPreview: safeTextPreview(responseText, 2000)
        });

        if (response.status === 401 || response.status === 403) {
          throw new Error(`support_rag_auth_${response.status}`);
        }

        if (response.status === 422) {
          throw new Error("support_rag_payload_422");
        }

        throw new Error(`support_rag_http_${response.status}`);
      }

      console.info("[support-rag] response_ok", {
        url,
        status: response.status,
        bodyPreview: safeTextPreview(responseText, 1000)
      });

      try {
        return JSON.parse(responseText) as unknown;
      } catch (error) {
        console.error("[support-rag] invalid_json", {
          url,
          status: response.status,
          bodyPreview: safeTextPreview(responseText, 2000),
          errorName: getErrorName(error),
          errorMessage: getErrorMessage(error),
          errorStack: getErrorStack(error)
        });

        throw new Error("support_rag_invalid_json");
      }
    } catch (error) {
      console.error("[support-rag] thrown", {
        url,
        errorName: getErrorName(error),
        errorMessage: getErrorMessage(error),
        errorStack: getErrorStack(error)
      });

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildRequestPayload(input: SupportRagCallInput): OpenRagRequestPayload {
    return {
      model: this.model,
      messages: input.messages,
      temperature: input.temperature ?? 0.1,
      max_tokens: input.maxTokens ?? 2000,
      stream: false,
      metadata: {
        use_map_reduce: false,
        spoken_style_answer: false,
        websearch: false,
        ...(input.metadata ?? {})
      }
    };
  }
}

function safeTextPreview(value: string, maxLength: number): string {
  return value.length > maxLength
    ? `${value.slice(0, maxLength)}...[truncated]`
    : value;
}

function safeJsonPreview(value: unknown, maxLength: number): string {
  try {
    return safeTextPreview(JSON.stringify(value, null, 2), maxLength);
  } catch {
    return "[unserializable]";
  }
}

function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactSecrets(item));
  }

  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(value)) {
      const normalizedKey = key.toLowerCase();

      if (
        normalizedKey.includes("authorization") ||
        normalizedKey.includes("apikey") ||
        normalizedKey.includes("api_key") ||
        normalizedKey.includes("token") ||
        normalizedKey.includes("secret") ||
        normalizedKey.includes("password")
      ) {
        output[key] = "[redacted]";
        continue;
      }

      output[key] = redactSecrets(nestedValue);
    }

    return output;
  }

  return value;
}

function getErrorName(error: unknown): string | null {
  return error instanceof Error ? error.name : null;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getErrorStack(error: unknown): string | null {
  return error instanceof Error ? error.stack ?? null : null;
}

export {
  HttpSupportRagClient
};
