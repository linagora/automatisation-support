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
    this.timeoutMs = options.timeoutMs ?? 30_000;
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

    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: this.model,
          messages: input.messages,
          temperature: input.temperature ?? 0.1,
          max_tokens: input.maxTokens ?? 1200,
          stream: false,
          metadata: {
            use_map_reduce: false,
            spoken_style_answer: false,
            websearch: false,
            ...(input.metadata ?? {})
          }
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error(`support_rag_auth_${response.status}`);
        }

        if (response.status === 422) {
          throw new Error("support_rag_payload_422");
        }

        throw new Error(`support_rag_http_${response.status}`);
      }

      return response.json();
    } finally {
      clearTimeout(timeout);
    }
  }
}

export {
  HttpSupportRagClient
};
