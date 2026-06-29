import type {
  KnowledgeChunk,
  RetrievalRequest,
  RetrieveSupportKnowledgeInput,
  SupportKnowledgeRetriever
} from "../../typesSupportProcessingPipelineV2.types";

type HttpSupportKnowledgeRetrieverOptions = {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs?: number;
};

type OpenRagExtra = {
  sources?: unknown[];
};

function buildOpenRagPrompt(queryText: string): string {
  return [
    "Retrieve support knowledge for an internal support assistant.",
    "",
    "Do not write a customer-facing reply.",
    "Do not invent steps not present in the retrieved documents.",
    "Return concise operational knowledge only:",
    "- known behavior",
    "- safe troubleshooting checks",
    "- useful fields to ask the user",
    "- limitations",
    "- claims to avoid",
    "- source-sensitive notes",
    "",
    "Support issue:",
    queryText
  ].join("\n");
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

function getOpenRagSources(payload: unknown): unknown[] {
  const data = payload as {
    extra?: unknown;
  };
  const extra = parseOpenRagExtra(data.extra);

  return Array.isArray(extra.sources) ? extra.sources : [];
}

function getOpenRagScore(sources: unknown[]): number {
  const firstSource = sources[0] as {
    relevance_score?: unknown;
  } | undefined;

  return typeof firstSource?.relevance_score === "number"
    ? firstSource.relevance_score
    : 1;
}

function getTopicId(params: {
  request: RetrievalRequest;
  input: RetrieveSupportKnowledgeInput;
}): KnowledgeChunk["topicId"] {
  return params.request.topicId ?? params.input.topicEvidence.topicId ?? null;
}

class HttpSupportKnowledgeRetriever implements SupportKnowledgeRetriever {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(options: HttpSupportKnowledgeRetrieverOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  async retrieve(input: RetrieveSupportKnowledgeInput): Promise<KnowledgeChunk[]> {
    const chunks: KnowledgeChunk[] = [];

    for (
      let requestIndex = 0;
      requestIndex < input.knowledgeEnrichmentPlan.retrievalRequests.length;
      requestIndex += 1
    ) {
      const request =
        input.knowledgeEnrichmentPlan.retrievalRequests[requestIndex];
      const queryText = request.queryText.trim();

      if (queryText === "") {
        continue;
      }

      const payload = await this.retrieveOne(queryText);
      const content = getOpenRagContent(payload).trim();

      if (content === "") {
        continue;
      }

      const sources = getOpenRagSources(payload);

      chunks.push({
        topicId: getTopicId({
          request,
          input
        }),
        sourceId: `openrag_${requestIndex}`,
        content,
        score: getOpenRagScore(sources),
        metadata: {
          retriever: "openrag",
          model: this.model,
          sourceCount: sources.length,
          sources
        }
      });
    }

    return chunks;
  }

  private async retrieveOne(queryText: string): Promise<unknown> {
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
          messages: [
            {
              role: "user",
              content: buildOpenRagPrompt(queryText)
            }
          ],
          temperature: 0.1,
          max_tokens: 1024,
          stream: false,
          metadata: {
            use_map_reduce: false,
            spoken_style_answer: false,
            websearch: false
          }
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error(
            `support_knowledge_retriever_openrag_auth_${response.status}`
          );
        }

        if (response.status === 422) {
          throw new Error("support_knowledge_retriever_openrag_payload_422");
        }

        throw new Error(
          `support_knowledge_retriever_openrag_http_${response.status}`
        );
      }

      return response.json();
    } finally {
      clearTimeout(timeout);
    }
  }
}

export {
  buildOpenRagPrompt,
  getOpenRagContent,
  getOpenRagSources,
  HttpSupportKnowledgeRetriever
};

export type {
  HttpSupportKnowledgeRetrieverOptions
};
