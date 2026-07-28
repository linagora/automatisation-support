import {HttpSupportRagClient} from "./httpSupportRagClient";

function createDefaultSupportRagClient(): HttpSupportRagClient {
  const baseUrl = process.env.SUPPORT_RAG_API_URL;
  const apiKey = process.env.SUPPORT_RAG_API_KEY;
  const model = process.env.SUPPORT_RAG_MODEL;

  console.info("[support-rag] create_default_client", {
    hasApiUrl: typeof baseUrl === "string" && baseUrl.trim() !== "",
    hasApiKey: typeof apiKey === "string" && apiKey.trim() !== "",
    hasModel: typeof model === "string" && model.trim() !== "",
    apiUrlPreview: previewUrl(baseUrl),
    model: model ?? null
  });

  if (!baseUrl || baseUrl.trim() === "") {
    console.error("[support-rag] missing_env", {
      missing: "SUPPORT_RAG_API_URL"
    });

    throw new Error("support_rag_client_missing_env");
  }

  if (!apiKey || apiKey.trim() === "") {
    console.error("[support-rag] missing_env", {
      missing: "SUPPORT_RAG_API_KEY"
    });

    throw new Error("support_rag_client_missing_env");
  }

  if (!model || model.trim() === "") {
    console.error("[support-rag] missing_env", {
      missing: "SUPPORT_RAG_MODEL"
    });

    throw new Error("support_rag_client_missing_env");
  }

  return new HttpSupportRagClient({
    baseUrl,
    apiKey,
    model
  });
}

function previewUrl(value: string | undefined): string | null {
  if (!value || value.trim() === "") {
    return null;
  }

  try {
    const url = new URL(value);

    return `${url.protocol}//${url.host}`;
  } catch {
    return "[invalid-url]";
  }
}

export {
  createDefaultSupportRagClient
};